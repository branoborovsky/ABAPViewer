import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Database
  const databasesDir = path.resolve(os.homedir(), ".abap_viewer_databases");
  if (!fs.existsSync(databasesDir)) {
    fs.mkdirSync(databasesDir, { recursive: true });
  }

  let dbPath = path.resolve(databasesDir, "abap_viewer.db");
  const configPath = path.resolve(databasesDir, "config.json");

  const getKnownDatabases = () => {
    if (fs.existsSync(configPath)) {
      try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const addKnownDatabase = (p: string) => {
    const known = getKnownDatabases();
    if (!known.includes(p)) {
      known.push(p);
      fs.writeFileSync(configPath, JSON.stringify(known, null, 2));
    }
  };

  const removeKnownDatabase = (p: string) => {
    const known = getKnownDatabases().filter((k: string) => k !== p);
    fs.writeFileSync(configPath, JSON.stringify(known, null, 2));
  };
  
  // Ensure default db exists
  if (!fs.existsSync(dbPath)) {
    const tempDb = new Database(dbPath);
    tempDb.close();
  }

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

  app.use(express.json({ limit: '200mb' }));

  // API Routes
  app.get("/api/databases", (req, res) => {
    try {
      const defaultFiles = fs.readdirSync(databasesDir)
        .filter(f => f.endsWith(".db"))
        .map(f => path.resolve(databasesDir, f));
      
      const knownPaths = getKnownDatabases();
      const allPaths = Array.from(new Set([...defaultFiles, ...knownPaths]));
      
      const databases = allPaths
        .filter(p => fs.existsSync(p))
        .map(p => ({
          name: path.basename(p),
          path: p,
          active: p === dbPath
        }));
      
      res.json({ databases, currentPath: dbPath });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/databases/create", (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    
    let newDbPath: string;
    if (path.isAbsolute(name)) {
      newDbPath = name.endsWith(".db") ? name : `${name}.db`;
      addKnownDatabase(newDbPath);
    } else {
      const fileName = name.endsWith(".db") ? name : `${name}.db`;
      newDbPath = path.resolve(databasesDir, fileName);
    }
    
    try {
      if (fs.existsSync(newDbPath)) {
        db.close();
        dbPath = newDbPath;
        db = new Database(dbPath);
        initTables(db);
        return res.json({ success: true, path: newDbPath, switched: true });
      }
      
      const newDb = new Database(newDbPath);
      initTables(newDb);
      newDb.close();
      
      res.json({ success: true, path: newDbPath });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/databases/switch", (req, res) => {
    const { path: targetPath } = req.body;
    if (!targetPath) return res.status(400).json({ error: "Path is required" });
    
    try {
      if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ error: "Database file not found" });
      }
      
      db.close();
      dbPath = targetPath;
      db = new Database(dbPath);
      initTables(db);
      
      // If it's an external path, make sure it's in known databases
      if (!targetPath.startsWith(databasesDir)) {
        addKnownDatabase(targetPath);
      }
      
      res.json({ success: true, currentPath: dbPath });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/databases", (req, res) => {
    const { path: targetPath } = req.body;
    if (!targetPath) return res.status(400).json({ error: "Path is required" });
    
    try {
      if (!fs.existsSync(targetPath)) {
        removeKnownDatabase(targetPath);
        return res.json({ success: true, message: "Reference removed" });
      }
      
      if (targetPath === dbPath) {
        return res.status(400).json({ error: "Cannot delete active database" });
      }
      
      // If it's in the default dir, delete the file
      if (targetPath.startsWith(databasesDir)) {
        fs.unlinkSync(targetPath);
      } else {
        // Just remove from known list if it's external
        removeKnownDatabase(targetPath);
      }
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/fs/ls", (req, res) => {
    const targetPath = (req.query.path as string) || os.homedir();
    try {
      if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ error: "Path not found" });
      }
      
      const stats = fs.statSync(targetPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: "Not a directory" });
      }

      const items = fs.readdirSync(targetPath, { withFileTypes: true })
        .filter(item => !item.name.startsWith('.')) // Hide hidden files
        .map(item => {
          const fullPath = path.join(targetPath, item.name);
          let isDirectory = item.isDirectory();
          
          // Handle symlinks
          if (item.isSymbolicLink()) {
            try {
              isDirectory = fs.statSync(fullPath).isDirectory();
            } catch (e) {}
          }

          return {
            name: item.name,
            path: fullPath,
            isDirectory
          };
        })
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

      res.json({
        currentPath: targetPath,
        parentPath: path.dirname(targetPath),
        items,
        sep: path.sep
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

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
        FROM objects_fts
        JOIN objects o ON objects_fts.rowid = o.id
        WHERE objects_fts MATCH ?
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

  app.delete("/api/object/:system/:packageName/:objectName", (req, res) => {
    const { system, packageName, objectName } = req.params;
    try {
      db.prepare("DELETE FROM objects WHERE system = ? AND package = ? AND name = ?").run(system, packageName, objectName);
      // Also delete sub-objects if any
      db.prepare("DELETE FROM objects WHERE system = ? AND package = ? AND parent_name = ?").run(system, packageName, objectName);
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
