import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Database
  const db = new Database("abap_viewer.db");
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS objects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      system TEXT,
      package TEXT,
      type TEXT,
      name TEXT,
      parent_name TEXT,
      description TEXT,
      content TEXT,
      raw_json TEXT
    );
    
    CREATE VIRTUAL TABLE IF NOT EXISTS objects_fts USING fts5(
      name, 
      description, 
      content,
      content='objects',
      content_rowid='id'
    );

    -- Triggers for FTS
    CREATE TRIGGER IF NOT EXISTS objects_ai AFTER INSERT ON objects BEGIN
      INSERT INTO objects_fts(rowid, name, description, content) VALUES (new.id, new.name, new.description, new.content);
    END;
    CREATE TRIGGER IF NOT EXISTS objects_ad AFTER DELETE ON objects BEGIN
      INSERT INTO objects_fts(objects_fts, rowid, name, description, content) VALUES('delete', old.id, old.name, old.description, old.content);
    END;
    CREATE TRIGGER IF NOT EXISTS objects_au AFTER UPDATE ON objects BEGIN
      INSERT INTO objects_fts(objects_fts, rowid, name, description, content) VALUES('delete', old.id, old.name, old.description, old.content);
      INSERT INTO objects_fts(rowid, name, description, content) VALUES (new.id, new.name, new.description, new.content);
    END;
  `);

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/tree", (req, res) => {
    const rows = db.prepare("SELECT system, package, type, name, parent_name, description FROM objects ORDER BY system, package, type, name").all();
    res.json(rows);
  });

  app.get("/api/object/:name", (req, res) => {
    const row = db.prepare("SELECT * FROM objects WHERE name = ?").get(req.params.name);
    if (row) {
      res.json({ ...row, raw_json: JSON.parse(row.raw_json as string) });
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });

  app.get("/api/search", (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    
    const results = db.prepare(`
      SELECT o.id, o.name, o.type, o.description, snippet(objects_fts, 2, '<b>', '</b>', '...', 10) as snippet
      FROM objects_fts f
      JOIN objects o ON f.rowid = o.id
      WHERE objects_fts MATCH ?
      GROUP BY o.system, o.package, o.name, o.type
      ORDER BY rank
      LIMIT 50
    `).all(query);
    
    res.json(results);
  });

  app.post("/api/import", (req, res) => {
    const { objects } = req.body; 
    const insert = db.prepare(`
      INSERT INTO objects (system, package, type, name, parent_name, description, content, raw_json)
      VALUES (@system, @package, @type, @name, @parent_name, @description, @content, @raw_json)
    `);

    const transaction = db.transaction((objs) => {
      for (const obj of objs) {
        // 1. Insert the main object
        let searchableContent = (obj.source || "") + "\n" + (obj.definition || "") + "\n" + (obj.implementation || "") + "\n" + (obj.flowLogic || "");
        
        insert.run({
          system: obj.system,
          package: obj.package,
          type: obj.objectType,
          name: obj.name,
          parent_name: null,
          description: obj.description,
          content: searchableContent,
          raw_json: JSON.stringify(obj)
        });

        // 2. If it's a FUGR or has subObjects, insert them as separate searchable entries linked to parent
        if (obj.subObjects && obj.subObjects.length > 0) {
          for (const sub of obj.subObjects) {
            let subContent = (sub.source || "") + "\n" + (sub.flowLogic || "") + "\n" + 
                           (sub.elements ? sub.elements.map((el: any) => `${el.name} ${el.text}`).join(" ") : "");
            
            if (sub.parameters) subContent += "\n" + JSON.stringify(sub.parameters);

            insert.run({
              system: obj.system,
              package: obj.package,
              type: sub.type,
              name: sub.name,
              parent_name: obj.name,
              description: sub.description || "",
              content: subContent,
              raw_json: JSON.stringify(sub)
            });
          }
        }
      }
    });

    try {
      transaction(objects);
      res.json({ success: true, count: objects.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/clear", (req, res) => {
    db.prepare("DELETE FROM objects").run();
    db.prepare("DELETE FROM objects_fts").run();
    res.json({ success: true });
  });

  app.delete("/api/package/:system/:packageName", (req, res) => {
    const { system, packageName } = req.params;
    try {
      db.prepare("DELETE FROM objects WHERE system = ? AND package = ?").run(system, packageName);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
