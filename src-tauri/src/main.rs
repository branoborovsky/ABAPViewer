#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Serialize, Deserialize, Debug, Clone)]
struct AbapObject {
    id: Option<i32>,
    system: String,
    package: String,
    #[serde(rename = "type")]
    obj_type: String,
    name: String,
    parent_name: Option<String>,
    description: String,
    content: Option<String>,
    raw_json: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct TreeItem {
    system: String,
    package: String,
    #[serde(rename = "type")]
    obj_type: String,
    name: String,
    parent_name: Option<String>,
    description: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct SearchResult {
    id: i32,
    name: String,
    #[serde(rename = "type")]
    obj_type: String,
    description: String,
    snippet: String,
}

struct DbState(Mutex<Connection>);

fn init_db(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS objects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          system TEXT,
          package TEXT,
          type TEXT,
          name TEXT,
          parent_name TEXT,
          description TEXT,
          content TEXT,
          raw_json TEXT
        )",
        [],
    )?;

    // FTS5 is not always available in bundled rusqlite, but let's try
    // If it fails, we'll just have a regular table
    let _ = conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS objects_fts USING fts5(
          name, 
          description, 
          content,
          content='objects',
          content_rowid='id'
        )",
        [],
    );

    let _ = conn.execute(
        "CREATE TRIGGER IF NOT EXISTS objects_ai AFTER INSERT ON objects BEGIN
          INSERT INTO objects_fts(rowid, name, description, content) VALUES (new.id, new.name, new.description, new.content);
        END",
        [],
    );

    Ok(())
}

#[tauri::command]
fn get_tree(state: State<DbState>) -> Result<Vec<TreeItem>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT system, package, type, name, parent_name, description FROM objects ORDER BY system, package, type, name")
        .map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map([], |row| {
        Ok(TreeItem {
            system: row.get(0)?,
            package: row.get(1)?,
            obj_type: row.get(2)?,
            name: row.get(3)?,
            parent_name: row.get(4)?,
            description: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

#[tauri::command]
fn get_object(state: State<DbState>, name: String) -> Result<serde_json::Value, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, system, package, type, name, parent_name, description, content, raw_json FROM objects WHERE name = ?")
        .map_err(|e| e.to_string())?;
    
    let row = stmt.query_row([name], |row| {
        let raw_json_str: String = row.get(8)?;
        let parsed_json: serde_json::Value = serde_json::from_str(&raw_json_str).unwrap_or(serde_json::Value::Null);
        
        let mut result = serde_json::Map::new();
        result.insert("id".to_string(), serde_json::Value::from(row.get::<_, i32>(0)?));
        result.insert("system".to_string(), serde_json::Value::from(row.get::<_, String>(1)?));
        result.insert("package".to_string(), serde_json::Value::from(row.get::<_, String>(2)?));
        result.insert("type".to_string(), serde_json::Value::from(row.get::<_, String>(3)?));
        result.insert("name".to_string(), serde_json::Value::from(row.get::<_, String>(4)?));
        result.insert("parent_name".to_string(), serde_json::Value::from(row.get::<_, Option<String>>(5)?));
        result.insert("description".to_string(), serde_json::Value::from(row.get::<_, String>(6)?));
        result.insert("content".to_string(), serde_json::Value::from(row.get::<_, Option<String>>(7)?));
        result.insert("raw_json".to_string(), parsed_json);
        
        Ok(serde_json::Value::Object(result))
    }).map_err(|e| e.to_string())?;

    Ok(row)
}

#[tauri::command]
fn search_objects(state: State<DbState>, query: String) -> Result<Vec<SearchResult>, String> {
    let conn = state.0.lock().unwrap();
    
    // Simple search if FTS5 is not working or as fallback
    let mut stmt = conn.prepare("
        SELECT id, name, type, description, '' as snippet
        FROM objects
        WHERE name LIKE ? OR description LIKE ? OR content LIKE ?
        LIMIT 50
    ").map_err(|e| e.to_string())?;

    let q = format!("%{}%", query);
    let rows = stmt.query_map([&q, &q, &q], |row| {
        Ok(SearchResult {
            id: row.get(0)?,
            name: row.get(1)?,
            obj_type: row.get(2)?,
            description: row.get(3)?,
            snippet: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

#[tauri::command]
fn import_objects(state: State<DbState>, objects: Vec<serde_json::Value>) -> Result<usize, String> {
    let mut conn = state.0.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    let count = objects.len();
    {
        let mut stmt = tx.prepare("
            INSERT INTO objects (system, package, type, name, parent_name, description, content, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ").map_err(|e| e.to_string())?;

        for obj in objects {
            let system = obj["system"].as_str().unwrap_or("").to_string();
            let package = obj["package"].as_str().unwrap_or("").to_string();
            let obj_type = obj["objectType"].as_str().unwrap_or("").to_string();
            let name = obj["name"].as_str().unwrap_or("").to_string();
            let description = obj["description"].as_str().unwrap_or("").to_string();
            
            let source = obj["source"].as_str().unwrap_or("");
            let definition = obj["definition"].as_str().unwrap_or("");
            let implementation = obj["implementation"].as_str().unwrap_or("");
            let flow_logic = obj["flowLogic"].as_str().unwrap_or("");
            
            let content = format!("{}\n{}\n{}\n{}", source, definition, implementation, flow_logic);
            let raw_json = serde_json::to_string(&obj).unwrap_or_default();

            stmt.execute(params![
                system, package, obj_type, name, Option::<String>::None, description, content, raw_json
            ]).map_err(|e| e.to_string())?;

            // Handle sub-objects if any
            if let Some(sub_objects) = obj["subObjects"].as_array() {
                for sub in sub_objects {
                    let sub_type = sub["type"].as_str().unwrap_or("").to_string();
                    let sub_name = sub["name"].as_str().unwrap_or("").to_string();
                    let sub_desc = sub["description"].as_str().unwrap_or("").to_string();
                    let sub_source = sub["source"].as_str().unwrap_or("");
                    let sub_flow = sub["flowLogic"].as_str().unwrap_or("");
                    let sub_content = format!("{}\n{}", sub_source, sub_flow);
                    let sub_raw = serde_json::to_string(&sub).unwrap_or_default();

                    stmt.execute(params![
                        system, package, sub_type, sub_name, Some(name.clone()), sub_desc, sub_content, sub_raw
                    ]).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}

#[tauri::command]
fn clear_database(state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM objects", []).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_package(state: State<DbState>, system: String, package: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM objects WHERE system = ? AND package = ?", [system, package]).map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
  let conn = Connection::open("abap_viewer.db").expect("failed to open database");
  init_db(&conn).expect("failed to initialize database");

  tauri::Builder::default()
    .manage(DbState(Mutex::new(conn)))
    .invoke_handler(tauri::generate_handler![
        get_tree, 
        get_object, 
        search_objects, 
        import_objects, 
        clear_database,
        delete_package
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
