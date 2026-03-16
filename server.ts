import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Database
  let dbPath = path.resolve(process.cwd(), "abap_viewer.db");
  let db = new Database(dbPath);
  
  const initTables = (database: any) => {
    database.exec(`
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
  };

  initTables(db);

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/settings", (req, res) => {
    res.json({ dbPath });
  });

  app.post("/api/settings", (req, res) => {
    const { newPath } = req.body;
    if (!newPath) return res.status(400).json({ error: "Path is required" });
    
    try {
      db.close();
      dbPath = newPath;
      db = new Database(dbPath);
      initTables(db);
      res.json({ success: true, dbPath });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

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
    const query = req.query.q as string;
    if (!query) return res.json([]);
    
    try {
      // Try FTS5 search first with prefix matching
      const sanitizedQuery = query.replace(/"/g, '""');
      const ftsQuery = `"${sanitizedQuery}"*`;
      
      const results = db.prepare(`
        SELECT o.id, o.name, o.type, o.description, snippet(objects_fts, 2, '<b>', '</b>', '...', 15) as snippet
        FROM objects_fts f
        JOIN objects o ON f.rowid = o.id
        WHERE objects_fts MATCH ?
        GROUP BY o.system, o.package, o.name, o.type
        ORDER BY rank
        LIMIT 50
      `).all(ftsQuery);
      res.json(results);
    } catch (err) {
      console.error("FTS search failed, falling back to LIKE", err);
      // Fallback to LIKE if FTS query is invalid
      const results = db.prepare(`
        SELECT id, name, type, description, '' as snippet
        FROM objects
        WHERE name LIKE ? OR description LIKE ? OR content LIKE ?
        LIMIT 50
      `).all(`%${query}%`, `%${query}%`, `%${query}%`);
      res.json(results);
    }
  });

  app.post("/api/import", (req, res) => {
    const { objects } = req.body; 
    const insert = db.prepare(`
      INSERT INTO objects (system, package, type, name, parent_name, description, content, raw_json)
      VALUES (@system, @package, @type, @name, @parent_name, @description, @content, @raw_json)
    `);

    const transaction = db.transaction((objs) => {
      for (const obj of objs) {
        insert.run({
          system: obj.system,
          package: obj.package,
          type: obj.type,
          name: obj.name,
          parent_name: obj.parent_name || null,
          description: obj.description || "",
          content: obj.content || "",
          raw_json: typeof obj.raw_json === 'string' ? obj.raw_json : JSON.stringify(obj.raw_json || obj)
        });
      }
    });

    try {
      transaction(objects);
      res.json({ success: true, count: objects.length });
    } catch (err: any) {
      console.error("Import failed", err);
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
