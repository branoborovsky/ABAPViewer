import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Package, 
  FileCode, 
  Table as TableIcon, 
  Folder, 
  ChevronRight, 
  ChevronDown, 
  Database,
  Upload,
  Terminal,
  Type,
  Cpu,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  MessageSquare,
  Code2,
  Settings,
  X,
  Globe,
  Plus,
  FolderPlus,
  Check,
  Home,
  ArrowUp,
  File
} from 'lucide-react';
import JSZip from 'jszip';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import abap from 'react-syntax-highlighter/dist/esm/languages/prism/abap';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { invoke } from '@tauri-apps/api/core';
import ABAP_EXPORT_SCRIPT from './exporter.abap?raw';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const decodeBase64 = (str: string) => {
  if (!str) return "";
  try {
    const binary = window.atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return str;
  }
};

interface ABAPObject {
  system: string;
  package: string;
  type: string;
  name: string;
  description: string;
  parent_name?: string;
  parentName?: string;
  parent?: string;
}

interface FullObject extends ABAPObject {
  content: string;
  raw_json: any;
}

SyntaxHighlighter.registerLanguage('abap', abap);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('xml', markup);
SyntaxHighlighter.registerLanguage('xslt', markup);

const isTauri = !!(window as any).__TAURI_INTERNALS__;

export default function App() {
  const [treeData, setTreeData] = useState<ABAPObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<FullObject | null>(null);
  const [activeSubObject, setActiveSubObject] = useState<string>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [currentProcessingFile, setCurrentProcessingFile] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [importLogs]);
  const [importStats, setImportStats] = useState({ total: 0, current: 0, success: 0, error: 0, phase: '' });
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [deleteConfirmation, setDeleteConfirmation] = useState<{system: string, pkg: string, name?: string} | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [highlightTerm, setHighlightTerm] = useState('');
  const [showExportScript, setShowExportScript] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dbPath, setDbPath] = useState('');
  const [newDbPath, setNewDbPath] = useState('');
  const [databases, setDatabases] = useState<any[]>([]);
  const [newDbName, setNewDbName] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [confirmClearCheckbox, setConfirmClearCheckbox] = useState(false);
  const [dbToDelete, setDbToDelete] = useState<string | null>(null);
  const [isDeletingDb, setIsDeletingDb] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [fsCurrentPath, setFsCurrentPath] = useState('');
  const [fsItems, setFsItems] = useState<any[]>([]);
  const [fsParentPath, setFsParentPath] = useState('');
  const [fsSep, setFsSep] = useState('/');
  const [fsLoading, setFsLoading] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (highlightTerm && selectedObject) {
      setTimeout(() => {
        const container = document.querySelector('.syntax-highlighter-container');
        if (container) {
          const highlightedLine = container.querySelector('.highlighted-line');
          if (highlightedLine) {
            highlightedLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 200);
    }
  }, [highlightTerm, selectedObject, activeSubObject]);

  useEffect(() => {
    fetchTree();
    fetchSettings();
    fetchDatabases();
  }, []);

  const fetchDatabases = async () => {
    try {
      if (isTauri) {
        const dbs = await invoke('get_databases');
        setDatabases(dbs as any[]);
        return;
      }
      const res = await fetch('/api/databases');
      if (res.ok) {
        const data = await res.json();
        setDatabases(data.databases);
      }
    } catch (err) {
      console.error("Failed to fetch databases", err);
    }
  };

  const browseFileSystem = async (path?: string) => {
    setFsLoading(true);
    try {
      if (isTauri) {
        const data = await invoke('ls_fs', { path }) as any;
        setFsCurrentPath(data.currentPath);
        setFsParentPath(data.parentPath);
        setFsItems(data.items);
        setFsSep(data.sep || '/');
        setIsFileExplorerOpen(true);
        return;
      }
      const url = `/api/fs/ls${path ? `?path=${encodeURIComponent(path)}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFsCurrentPath(data.currentPath);
        setFsParentPath(data.parentPath);
        setFsItems(data.items);
        setFsSep(data.sep || '/');
        setIsFileExplorerOpen(true);
      }
    } catch (err) {
      console.error("Failed to browse file system", err);
    } finally {
      setFsLoading(false);
    }
  };

  const switchDatabase = async (path: string) => {
    try {
      if (isTauri) {
        await invoke('set_db_path', { path });
        await fetchSettings();
        await fetchDatabases();
        await fetchTree();
        setSelectedObject(null);
        return;
      }
      const res = await fetch('/api/databases/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      if (res.ok) {
        await fetchSettings();
        await fetchDatabases();
        await fetchTree();
        setSelectedObject(null);
      }
    } catch (err) {
      console.error("Failed to switch database", err);
    }
  };

  const createDatabase = async () => {
    if (!newDbName) return;
    try {
      if (isTauri) {
        const dbName = newDbName.endsWith('.db') ? newDbName : `${newDbName}.db`;
        try {
          await invoke('set_db_path', { path: dbName });
          setNewDbName('');
          await fetchSettings();
          await fetchDatabases();
          await fetchTree();
          setSelectedObject(null);
        } catch (err: any) {
          alert(`Chyba pri vytváraní databázy: ${err}`);
        }
        return;
      }
      const res = await fetch('/api/databases/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDbName })
      });
      if (res.ok) {
        const data = await res.json();
        setNewDbName('');
        await fetchDatabases();
        if (data.switched) {
          await fetchSettings();
          await fetchTree();
          setSelectedObject(null);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Chyba pri vytváraní databázy.");
      }
    } catch (err) {
      console.error("Failed to create database", err);
    }
  };

  const deleteDatabase = async (path: string) => {
    setDbToDelete(path);
  };

  const confirmDeleteDatabase = async () => {
    if (!dbToDelete) return;
    setIsDeletingDb(true);
    try {
      if (isTauri) {
        await invoke('delete_database', { path: dbToDelete });
        await fetchDatabases();
        setDbToDelete(null);
        return;
      }
      const res = await fetch('/api/databases', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dbToDelete })
      });
      if (res.ok) {
        await fetchDatabases();
        setDbToDelete(null);
      } else {
        const data = await res.json();
        console.error("Delete failed", data.error);
      }
    } catch (err) {
      console.error("Failed to delete database", err);
    } finally {
      setIsDeletingDb(false);
    }
  };

  const fetchSettings = async () => {
    try {
      if (isTauri) {
        const path = await invoke('get_db_path');
        setDbPath(path as string);
        setNewDbPath(path as string);
      } else {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setDbPath(data.dbPath);
          setNewDbPath(data.dbPath);
        }
      }
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      if (isTauri) {
        await invoke('set_db_path', { path: newDbPath });
        setDbPath(newDbPath);
      } else {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPath: newDbPath })
        });
        if (res.ok) {
          const data = await res.json();
          setDbPath(data.dbPath);
        }
      }
      setIsSettingsOpen(false);
      fetchTree();
    } catch (err) {
      console.error("Failed to save settings", err);
      alert("Chyba pri ukladaní nastavení.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const clearDatabase = () => {
    setIsClearModalOpen(true);
    setConfirmClearCheckbox(false);
  };

  const handleActualClear = async () => {
    if (!confirmClearCheckbox) return;
    
    try {
      if (isTauri) {
        await invoke('clear_database');
        setTreeData([]);
        setSelectedObject(null);
        setSearchResults([]);
        setNavigationHistory([]);
        setImportLogs([]);
        setIsClearModalOpen(false);
      } else {
        const res = await fetch('/api/clear', { method: 'POST' });
        if (res.ok) {
          setTreeData([]);
          setSelectedObject(null);
          setSearchResults([]);
          setNavigationHistory([]);
          setImportLogs([]);
          setIsClearModalOpen(false);
        }
      }
    } catch (err) {
      console.error("Failed to clear database", err);
      alert("Chyba pri vymazávaní databázy.");
    }
  };

  const fetchTree = async () => {
    try {
      if (isTauri) {
        const data = await invoke('get_tree');
        setTreeData(data as any);
      } else {
        const res = await fetch('/api/tree');
        if (res.ok) {
          const data = await res.json();
          setTreeData(data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch tree", err);
    }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      if (isTauri) {
        const data = await invoke('search_objects', { query: q });
        setSearchResults(data as any);
      } else {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      }
    } catch (err) {
      console.error("Search failed", err);
    }
  };

  const selectObject = async (name: string, addToHistory = true, term = '') => {
    try {
      let data;
      if (isTauri) {
        data = await invoke('get_object', { name });
      } else {
        const res = await fetch(`/api/object/${name}`);
        if (res.ok) {
          data = await res.json();
        }
      }

      if (data) {
        if (addToHistory && selectedObject) {
          setNavigationHistory(prev => [...prev, selectedObject.name]);
        }
        
        setSelectedObject(data as any);
        setActiveSubObject('main');
        setSearchResults([]);
        setSearchQuery('');
        setHighlightTerm(term);
      }
    } catch (err) {
      console.error("Failed to load object", err);
    }
  };

  const handleObjectClick = (name: string, type?: string) => {
    if (name) selectObject(name);
  };

  const goBack = () => {
    if (navigationHistory.length === 0) return;
    const prevName = navigationHistory[navigationHistory.length - 1];
    setNavigationHistory(prev => prev.slice(0, -1));
    selectObject(prevName, false);
  };

  const handleCodeDoubleClick = () => {
    const selection = window.getSelection();
    if (!selection) return;
    
    const selectedText = selection.toString().trim().toUpperCase();
    if (!selectedText) return;

    // Try to find object with this name
    // Prefer objects in the same system if possible
    const found = treeData.find(obj => obj.name === selectedText && obj.system === selectedObject?.system) ||
                  treeData.find(obj => obj.name === selectedText);

    if (found) {
      selectObject(found.name);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLogs([]);
    setCurrentProcessingFile('');
    setImportStats({ total: 0, current: 0, success: 0, error: 0, phase: 'Otváram ZIP archív...' });
    setIsImporting(true);
    
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const jsonFiles = Object.entries(contents.files).filter(([name]) => name.endsWith('.json'));
      
      setImportStats(prev => ({ ...prev, total: jsonFiles.length, phase: 'Spracovávam súbory...' }));
      const objects: any[] = [];

      for (const [filename, zipEntry] of jsonFiles) {
        setImportStats(prev => ({ ...prev, current: prev.current + 1 }));
        setCurrentProcessingFile(filename);
        const text = await zipEntry.async('string');
        try {
          const obj = JSON.parse(text);
          objects.push(obj);
          setImportStats(prev => ({ ...prev, success: prev.success + 1 }));
        } catch (e) {
          setImportStats(prev => ({ ...prev, error: prev.error + 1 }));
          setImportLogs(prev => [...prev.slice(-5000), `[CHYBA] ${filename}: Neplatný JSON`]);
        }
      }

      if (objects.length > 0) {
        setImportStats(prev => ({ ...prev, phase: 'Ukladám do databázy...' }));
        
        // Flatten objects for both Web and Desktop to ensure consistent processing
        const flattened: any[] = [];
        objects.forEach(obj => {
          // 1. Main object
          const oType = obj.objectType || obj.type;
          
          // Handle Base64 encoding if present (especially for SIAC/HTML)
          if (obj.encoding === 'base64') {
            if (obj.source) obj.source = decodeBase64(obj.source);
            if (obj.content) obj.content = decodeBase64(obj.content);
            if (obj.definition) obj.definition = decodeBase64(obj.definition);
            if (obj.implementation) obj.implementation = decodeBase64(obj.implementation);
          }

          let searchableContent = (obj.source || "") + "\n" + (obj.definition || "") + "\n" + (obj.implementation || "") + "\n" + (obj.flowLogic || "");
          if (oType === 'DOMA') {
            searchableContent += `\n${obj.dataType || obj.datatype || obj.type || ""} ${obj.length || obj.len || ""} ${obj.decimals || obj.dec || ""}`;
            if (obj.fixedValues) {
              searchableContent += "\n" + obj.fixedValues.map((v: any) => `${v.low || ""} ${v.text || ""}`).join(" ");
            }
          } else if (oType === 'DTEL') {
            searchableContent += `\n${obj.domain || ""} ${obj.dataType || obj.datatype || obj.type || ""} ${obj.length || obj.len || ""}`;
            const labels = obj.labels || obj.texts;
            if (labels) {
              searchableContent += "\n" + Object.values(labels).join(" ");
            }
          } else if (oType === 'TRAN') {
            searchableContent += `\n${obj.program || ""} ${obj.screen || ""} ${obj.tcodeType || ""}`;
          } else if (oType === 'TTYP') {
            searchableContent += `\n${obj.lineType || ""} ${obj.accessMode || ""} ${obj.keyCategory || ""}`;
          } else if (oType === 'MSAG') {
            if (obj.messages) {
              searchableContent += "\n" + obj.messages.map((m: any) => `${m.number || ""} ${m.text || ""}`).join(" ");
            }
          } else if (oType === 'SIAC') {
            searchableContent += "\n" + (obj.source || obj.content || "");
          }

          flattened.push({
            system: obj.system,
            package: obj.package,
            type: oType,
            name: obj.name,
            parent_name: null,
            description: obj.description || "",
            content: searchableContent,
            raw_json: JSON.stringify(obj)
          });

          // 2. Sub-objects (Includes, Functions, Dynpros)
          if (obj.subObjects && obj.subObjects.length > 0) {
            obj.subObjects.forEach((sub: any) => {
              let subContent = (sub.source || "") + "\n" + (sub.flowLogic || "") + "\n" + 
                             (sub.elements ? sub.elements.map((el: any) => `${el.name} ${el.text}`).join(" ") : "");
              if (sub.parameters) subContent += "\n" + JSON.stringify(sub.parameters);

              flattened.push({
                system: obj.system,
                package: obj.package,
                type: sub.type,
                name: sub.name,
                parent_name: obj.name,
                description: sub.description || "",
                content: subContent,
                raw_json: JSON.stringify(sub)
              });
            });
          }

          // 3. Class Methods
          if ((obj.objectType === 'CLAS' || obj.type === 'CLAS') && obj.components?.methods) {
            obj.components.methods.forEach((meth: any) => {
              let methSource = meth.source || "";
              if (!methSource && obj.implementation) {
                const escapedName = meth.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`METHOD\\s+${escapedName}\\s*\\.(.*?)\\s+ENDMETHOD`, 'is');
                const match = obj.implementation.match(regex);
                if (match) {
                  methSource = match[0];
                } else {
                  const regexAlt = new RegExp(`METHOD\\s+${escapedName}\\b(.*?)\\bENDMETHOD`, 'is');
                  const matchAlt = obj.implementation.match(regexAlt);
                  if (matchAlt) methSource = matchAlt[0];
                }
              }
              
              flattened.push({
                system: obj.system,
                package: obj.package,
                type: 'METH',
                name: meth.name,
                parent_name: obj.name,
                description: meth.description || "",
                content: methSource || meth.name,
                raw_json: JSON.stringify({ ...meth, type: 'METH', source: methSource })
              });
            });
          }
        });

        if (isTauri) {
          await invoke('import_objects', { objects: flattened });
        } else {
          await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objects: flattened })
          });
        }
        await fetchTree();
      } else {
        setImportStats(prev => ({ ...prev, phase: 'Žiadne dáta' }));
      }
      
      setImportStats(prev => ({ ...prev, phase: 'Dokončené' }));
      setCurrentProcessingFile('');
    } catch (err) {
      console.error("Import failed", err);
      setImportLogs(prev => [...prev, `FATÁLNA CHYBA: ${err instanceof Error ? err.message : String(err)}`]);
      setImportStats(prev => ({ ...prev, phase: 'Chyba' }));
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedNodes(newExpanded);
  };

  const handleDeletePackage = async (e: React.MouseEvent, system: string, pkg: string) => {
    e.stopPropagation();
    setDeleteConfirmation({ system, pkg });
  };

  const handleDeleteObject = async (e: React.MouseEvent, system: string, pkg: string, name: string) => {
    e.stopPropagation();
    setDeleteConfirmation({ system, pkg, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { system, pkg, name } = deleteConfirmation;
    
    console.log('Confirming delete for:', { system, pkg, name });
    setDeleteConfirmation(null);

    try {
      if (name) {
        // Delete single object
        if (isTauri) {
          await invoke('delete_object', { system, pkg, name });
          console.log('Delete object successful (Tauri)');
          await fetchTree();
          if (selectedObject?.name === name) {
            setSelectedObject(null);
          }
        } else {
          const url = `/api/object/${encodeURIComponent(system)}/${encodeURIComponent(pkg)}/${encodeURIComponent(name)}`;
          const res = await fetch(url, { method: 'DELETE' });
          if (res.ok) {
            await fetchTree();
            if (selectedObject?.name === name) {
              setSelectedObject(null);
            }
          } else {
            const errorData = await res.json();
            alert(`Chyba pri mazaní objektu: ${errorData.error || res.statusText}`);
          }
        }
      } else {
        // Delete entire package
        if (isTauri) {
          await invoke('delete_package', { system, pkg });
          console.log('Delete package successful (Tauri)');
          await fetchTree();
          if (selectedObject?.system === system && selectedObject?.package === pkg) {
            setSelectedObject(null);
          }
        } else {
          const url = `/api/package/${encodeURIComponent(system)}/${encodeURIComponent(pkg)}`;
          const res = await fetch(url, { method: 'DELETE' });
          if (res.ok) {
            await fetchTree();
            if (selectedObject?.system === system && selectedObject?.package === pkg) {
              setSelectedObject(null);
            }
          } else {
            const errorData = await res.json();
            alert(`Chyba pri mazaní paketu: ${errorData.error || res.statusText}`);
          }
        }
      }
    } catch (err) {
      console.error("Delete request failed", err);
      alert("Chyba pri komunikácii so serverom.");
    }
  };

  const groupedTree = useMemo(() => {
    const root: any = {};
    
    // Helper to get parent name regardless of casing
    const getParentName = (obj: ABAPObject) => obj.parent_name || obj.parentName || obj.parent || "";

    // Create a set of objects that are already children to avoid double display at top level
    const childSet = new Set(treeData.filter(obj => getParentName(obj) !== "").map(obj => `${obj.system}|${obj.package}|${obj.name}`));

    // First pass: build structure without sub-objects
    treeData.forEach(obj => {
      const pName = getParentName(obj);
      if (pName !== "") return; // Skip sub-objects for now
      
      // Also skip if this object is already a child of another object
      if (childSet.has(`${obj.system}|${obj.package}|${obj.name}`)) return;

      if (!root[obj.system]) root[obj.system] = {};
      if (!root[obj.system][obj.package]) root[obj.system][obj.package] = {};
      
      let category = 'Ostatné';
      const type = (obj.type || '').toUpperCase().trim();
      
      if (type === 'PROG' || type === 'REPORT') category = 'Programy';
      else if (type === 'TABL') category = 'Tabuľky';
      else if (type === 'FUGR') category = 'Funkčné skupiny';
      else if (type === 'CLAS') category = 'Triedy';
      else if (type === 'INTF') category = 'Rozhrania';
      else if (type === 'XSLT') category = 'Transformácie';
      else if (type === 'TTYP') category = 'Tabuľkové typy';
      else if (type === 'DTEL') category = 'Dátové prvky';
      else if (type === 'DOMA') category = 'Domény';
      else if (type === 'MSAG') category = 'Správy';
      else if (type === 'TRAN') category = 'Transakcie';
      else if (type === 'SIAC') category = 'HTML Šablóny';
      else if (type === 'SHLP') category = 'Search Helpy';
      else if (type === 'VIEW') category = 'Pohľady';
      else if (type === 'ENQU') category = 'Zámky';

      if (!root[obj.system][obj.package][category]) root[obj.system][obj.package][category] = {};
      
      root[obj.system][obj.package][category][obj.name] = {
        ...obj,
        children: []
      };
    });

    // Second pass: attach sub-objects to parents
    treeData.forEach(obj => {
      const pName = getParentName(obj);
      if (pName === "") return;

      const parentSys = root[obj.system];
      if (!parentSys) return;
      const parentPkg = parentSys[obj.package];
      if (!parentPkg) return;

      // Find parent in any category within the same package
      let found = false;
      for (const cat in parentPkg) {
        const parent = parentPkg[cat][pName];
        if (parent) {
          const type = (parent.type || '').toUpperCase().trim();
          if (type === 'PROG' || type === 'FUGR') {
            const subType = (obj.type || '').toUpperCase().trim();
            let folderName = 'Ostatné';
            if (subType === 'DYNP') folderName = 'Dynpra';
            else if (subType === 'REPS') folderName = 'Includes';
            else if (subType === 'FUNC') folderName = 'Funkčné moduly';
            
            if (!parent.groupedChildren) parent.groupedChildren = {};
            if (!parent.groupedChildren[folderName]) parent.groupedChildren[folderName] = [];
            parent.groupedChildren[folderName].push(obj);
          } else {
            parent.children.push(obj);
          }
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.warn(`Parent ${pName} not found for object ${obj.name} in package ${obj.package}`);
      }
    });

    console.log("Grouped Tree:", root);
    return root;
  }, [treeData]);

  return (
    <div className={cn(
      "flex h-screen bg-[#1e1e1e] text-[#cccccc] font-sans selection:bg-[#264f78]",
      isResizing && "cursor-col-resize select-none"
    )}>
      {/* Sidebar */}
      <div 
        className="flex flex-col border-r border-[#333333] bg-[#252526] shrink-0"
        style={{ width: sidebarWidth }}
      >
        <div className="p-4 border-b border-[#333333] flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white">
            <Cpu className="w-5 h-5 text-blue-400" />
            <span>ABAP Viewer</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowExportScript(true)}
              className="p-1 rounded hover:bg-[#333333] text-[#858585] hover:text-blue-400 transition-colors"
              title="Zobraziť ABAP exportný program"
            >
              <Code2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1 rounded hover:bg-[#333333] text-[#858585] hover:text-gray-200 transition-colors"
              title="Nastavenia"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={clearDatabase}
              className="p-1 rounded hover:bg-[#333333] text-[#858585] hover:text-red-400 transition-colors"
              title="Vymazať celú databázu"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <label className="cursor-pointer hover:text-white transition-colors p-1 rounded hover:bg-[#333333] text-[#858585]">
              <Upload className="w-4 h-4" />
              <input type="file" className="hidden" accept=".zip" onChange={handleFileUpload} />
            </label>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-2 relative">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-[#858585]" />
            <input 
              type="text"
              placeholder="Full-text vyhľadávanie..."
              className="w-full bg-[#3c3c3c] border-none rounded py-1.5 pl-8 pr-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-[#252526] border border-[#454545] shadow-xl z-50 max-h-96 overflow-y-auto">
              {searchResults.map(res => (
                <div 
                  key={res.id}
                  className="p-2 hover:bg-[#2a2d2e] cursor-pointer border-b border-[#333333]"
                  onClick={() => selectObject(res.name, true, searchQuery)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-400/10 px-1 rounded">{res.type}</span>
                    <span className="text-sm font-bold text-white">{res.name}</span>
                  </div>
                  <div className="text-xs text-[#858585] truncate">{res.description}</div>
                  <div className="text-[10px] text-[#666] mt-1 italic search-snippet" dangerouslySetInnerHTML={{ __html: res.snippet }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tree View */}
        <div className="flex-1 overflow-y-auto p-2 text-sm select-none">
          {Object.entries(groupedTree).map(([sys, packages]: any) => (
            <div key={sys}>
              <div 
                className="flex items-center gap-1 py-1 px-1 hover:bg-[#2a2d2e] cursor-pointer rounded group"
                onClick={() => toggleNode(sys)}
              >
                <div className="w-4 flex justify-center">
                  {expandedNodes.has(sys) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </div>
                <Database className="w-4 h-4 text-amber-500" />
                <span className="font-semibold group-hover:text-white">{sys}</span>
              </div>
              
              {expandedNodes.has(sys) && (
                <div className="ml-4">
                  {Object.entries(packages).map(([pkg, categories]: any) => (
                    <div key={pkg}>
                      <div 
                        className="flex items-center gap-1 py-1 px-1 hover:bg-[#2a2d2e] cursor-pointer rounded group"
                        onClick={() => toggleNode(`${sys}-${pkg}`)}
                      >
                        <div className="w-4 flex justify-center">
                          {expandedNodes.has(`${sys}-${pkg}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </div>
                        <Package className="w-4 h-4 text-blue-400" />
                        <span className="group-hover:text-white flex-1 truncate">{pkg}</span>
                        <button 
                          onClick={(e) => handleDeletePackage(e, sys, pkg)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                          title="Vymazať paket"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {expandedNodes.has(`${sys}-${pkg}`) && (
                        <div className="ml-4">
                          {Object.entries(categories).map(([cat, objs]: any) => (
                            <div key={cat}>
                              <div 
                                className="flex items-center gap-1 py-1 px-1 hover:bg-[#2a2d2e] cursor-pointer rounded opacity-80 group"
                                onClick={() => toggleNode(`${sys}-${pkg}-${cat}`)}
                              >
                                <div className="w-4 flex justify-center">
                                  {expandedNodes.has(`${sys}-${pkg}-${cat}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </div>
                                <Folder className="w-4 h-4 text-gray-400" />
                                <span className="text-[10px] uppercase tracking-wider group-hover:text-white">{cat}</span>
                              </div>

                              {expandedNodes.has(`${sys}-${pkg}-${cat}`) && (
                                <div className="ml-4 border-l border-[#333333]">
                                  {Object.values(objs).map((obj: any) => (
                                    <div key={`${obj.system}-${obj.package}-${obj.name}`}>
                                      <div 
                                        className={cn(
                                          "flex items-center gap-2 py-1 px-3 hover:bg-[#2a2d2e] cursor-pointer rounded m-0.5 group",
                                          selectedObject?.name === obj.name && "bg-[#37373d] text-white"
                                        )}
                                        onClick={() => {
                                          if (obj.children.length > 0 || (obj.groupedChildren && Object.keys(obj.groupedChildren).length > 0)) toggleNode(`obj-${obj.system}-${obj.package}-${obj.name}`);
                                          selectObject(obj.name);
                                        }}
                                      >
                                        <div className="w-3 flex justify-center">
                                          {(obj.children.length > 0 || (obj.groupedChildren && Object.keys(obj.groupedChildren).length > 0)) && (expandedNodes.has(`obj-${obj.system}-${obj.package}-${obj.name}`) ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />)}
                                        </div>
                                        {obj.type === 'TABL' ? <TableIcon className="w-3.5 h-3.5 text-green-500" /> : 
                                         obj.type === 'CLAS' ? <Cpu className="w-3.5 h-3.5 text-purple-400" /> :
                                         obj.type === 'SIAC' ? <Globe className="w-3.5 h-3.5 text-blue-400" /> :
                                         <FileCode className="w-3.5 h-3.5 text-blue-300" />}
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <span className="truncate group-hover:text-white leading-tight">{obj.name}</span>
                                          {obj.description && <span className="text-[9px] text-[#858585] truncate leading-tight">{obj.description}</span>}
                                        </div>
                                        <button 
                                          onClick={(e) => handleDeleteObject(e, obj.system, obj.package, obj.name)}
                                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                                          title="Vymazať objekt"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>

                                      {expandedNodes.has(`obj-${obj.system}-${obj.package}-${obj.name}`) && (obj.children.length > 0 || (obj.groupedChildren && Object.keys(obj.groupedChildren).length > 0)) && (
                                        <div className="ml-6 border-l border-[#444]">
                                          {obj.groupedChildren ? (
                                            Object.entries(obj.groupedChildren).sort().map(([folderName, children]: any) => (
                                              <div key={folderName}>
                                                <div 
                                                  className="flex items-center gap-1 py-1 px-1 hover:bg-[#2a2d2e] cursor-pointer rounded opacity-80 group"
                                                  onClick={() => toggleNode(`folder-${obj.system}-${obj.package}-${obj.name}-${folderName}`)}
                                                >
                                                  <div className="w-4 flex justify-center">
                                                    {expandedNodes.has(`folder-${obj.system}-${obj.package}-${obj.name}-${folderName}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                  </div>
                                                  <Folder className="w-4 h-4 text-gray-400" />
                                                  <span className="text-[10px] uppercase tracking-wider group-hover:text-white">{folderName}</span>
                                                </div>
                                                {expandedNodes.has(`folder-${obj.system}-${obj.package}-${obj.name}-${folderName}`) && (
                                                  <div className="ml-4 border-l border-[#333333]">
                                                    {children.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((child: any) => (
                                                      <div 
                                                        key={`${child.system}-${child.package}-${child.name}`}
                                                        className={cn(
                                                          "flex items-center gap-2 py-1 px-3 hover:bg-[#2a2d2e] cursor-pointer rounded m-0.5 text-[12px]",
                                                          selectedObject?.name === child.name && "bg-[#37373d] text-white"
                                                        )}
                                                        onClick={() => selectObject(child.name)}
                                                      >
                                                        <div className="w-3 flex justify-center">
                                                          {child.type === 'METH' ? <Zap className="w-2.5 h-2.5 text-yellow-500" /> : 
                                                           child.type === 'FUNC' ? <Code2 className="w-2.5 h-2.5 text-blue-400" /> :
                                                           <div className="w-1 h-1 rounded-full bg-gray-500" />}
                                                        </div>
                                                        <span className="text-[9px] font-mono text-[#666] w-8 uppercase flex-shrink-0">{child.type}</span>
                                                        <div className="flex flex-col min-w-0 flex-1">
                                                          <span className="truncate leading-tight">{child.name}</span>
                                                          {child.description && <span className="text-[9px] text-[#858585] truncate leading-tight">{child.description}</span>}
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            ))
                                          ) : (
                                            obj.children.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((child: any) => (
                                              <div 
                                                key={`${child.system}-${child.package}-${child.name}`}
                                                className={cn(
                                                  "flex items-center gap-2 py-1 px-3 hover:bg-[#2a2d2e] cursor-pointer rounded m-0.5 text-[12px]",
                                                  selectedObject?.name === child.name && "bg-[#37373d] text-white"
                                                )}
                                                onClick={() => selectObject(child.name)}
                                              >
                                                <div className="w-3 flex justify-center">
                                                  {child.type === 'METH' ? <Zap className="w-2.5 h-2.5 text-yellow-500" /> : 
                                                   child.type === 'FUNC' ? <Code2 className="w-2.5 h-2.5 text-blue-400" /> :
                                                   <div className="w-1 h-1 rounded-full bg-gray-500" />}
                                                </div>
                                                <span className="text-[9px] font-mono text-[#666] w-8 uppercase flex-shrink-0">{child.type}</span>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                  <span className="truncate leading-tight">{child.name}</span>
                                                  {child.description && <span className="text-[9px] text-[#858585] truncate leading-tight">{child.description}</span>}
                                                </div>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        className={cn(
          "w-1 hover:bg-blue-500/50 cursor-col-resize transition-colors z-50 shrink-0",
          isResizing && "bg-blue-500"
        )}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
        {selectedObject ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-[#333333] bg-[#252526] flex items-center justify-between">
              <div className="flex items-center gap-4">
                {navigationHistory.length > 0 && (
                  <button 
                    onClick={goBack}
                    className="p-1.5 hover:bg-[#333333] rounded transition-colors text-[#858585] hover:text-white"
                    title="Späť"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-white">{selectedObject.name}</h1>
                    <span className="px-2 py-0.5 bg-[#333333] rounded text-[10px] font-mono uppercase text-blue-400 border border-blue-400/30">{selectedObject.type}</span>
                  </div>
                  <p className="text-sm text-[#858585] mt-1">{selectedObject.description}</p>
                </div>
              </div>
              <div className="text-right text-[10px] text-[#666] font-mono">
                <div>SYS: {selectedObject.system}</div>
                <div>PKG: {selectedObject.package}</div>
                {selectedObject.parent_name && <div className="text-blue-400/70">PARENT: {selectedObject.parent_name}</div>}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto">
              {selectedObject.type === 'TABL' ? (
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <TableIcon className="w-5 h-5 text-green-500" />
                    <h2 className="text-lg font-semibold text-white">Table Definition</h2>
                  </div>
                  <div className="rounded-lg border border-[#333333] overflow-hidden">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#252526] text-left text-[#858585] uppercase text-[10px] tracking-wider">
                          <th className="p-3 border-b border-[#333333]">Field Name</th>
                          <th className="p-3 border-b border-[#333333] text-center">Key</th>
                          <th className="p-3 border-b border-[#333333]">Data Element</th>
                          <th className="p-3 border-b border-[#333333]">Domain</th>
                          <th className="p-3 border-b border-[#333333]">Type</th>
                          <th className="p-3 border-b border-[#333333]">Length</th>
                          <th className="p-3 border-b border-[#333333]">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedObject?.raw_json?.fields?.map((f: any) => (
                          <tr key={f.name} className="hover:bg-[#2a2d2e] transition-colors">
                            <td className="p-3 border-b border-[#333333] font-mono text-blue-300">{f.name}</td>
                            <td className="p-3 border-b border-[#333333] text-center">
                              {f.key && <span className="text-amber-500 font-bold">X</span>}
                            </td>
                            <td className="p-3 border-b border-[#333333] text-blue-400/80 font-mono text-[11px]">{f.dataElement || '-'}</td>
                            <td className="p-3 border-b border-[#333333] text-purple-400/80 font-mono text-[11px]">{f.domain || '-'}</td>
                            <td className="p-3 border-b border-[#333333] text-[#ccc]">{f.type || f.dataType || f.datatype || '-'}</td>
                            <td className="p-3 border-b border-[#333333] text-[#858585]">{f.length || f.len || '-'}</td>
                            <td className="p-3 border-b border-[#333333] text-[#858585]">{f.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : selectedObject.type === 'DOMA' ? (
                <div className="p-6 space-y-8">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-purple-500" />
                    <h2 className="text-lg font-semibold text-white">Domain Details</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#252526] p-4 rounded-lg border border-[#333333] space-y-4">
                      <h3 className="text-xs font-bold text-[#858585] uppercase tracking-wider">Definition</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#858585]">Data Type</span>
                          <span className="text-blue-400 font-mono">{selectedObject.raw_json?.dataType || selectedObject.raw_json?.datatype || selectedObject.raw_json?.type || selectedObject.raw_json?.DATATYPE || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#858585]">Length</span>
                          <span className="text-white font-mono">{selectedObject.raw_json?.length || selectedObject.raw_json?.len || selectedObject.raw_json?.LENG || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#858585]">Decimals</span>
                          <span className="text-white font-mono">{selectedObject.raw_json?.decimals || selectedObject.raw_json?.dec || selectedObject.raw_json?.DECIMALS || '0'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#858585]">Output Length</span>
                          <span className="text-white font-mono">{selectedObject.raw_json?.outputLength || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#858585]">Conv. Exit</span>
                          <span className="text-amber-400 font-mono">{selectedObject.raw_json?.convexit || '-'}</span>
                        </div>
                      </div>
                    </div>

                    {selectedObject.raw_json?.fixedValues && selectedObject.raw_json.fixedValues.length > 0 && (
                      <div className="bg-[#252526] p-4 rounded-lg border border-[#333333] space-y-4">
                        <h3 className="text-xs font-bold text-[#858585] uppercase tracking-wider">Fixed Values</h3>
                        <div className="max-h-64 overflow-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-[#666] border-b border-[#333]">
                                <th className="pb-2">Value</th>
                                <th className="pb-2">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedObject.raw_json.fixedValues.map((v: any, i: number) => (
                                <tr key={i} className="border-b border-[#333]/50">
                                  <td className="py-1.5 font-mono text-blue-300">{v.low}{v.high ? ` - ${v.high}` : ''}</td>
                                  <td className="py-1.5 text-[#858585]">{v.text}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : selectedObject.type === 'DTEL' ? (
                <div className="p-6 space-y-8">
                  <div className="flex items-center gap-2">
                    <Type className="w-5 h-5 text-blue-500" />
                    <h2 className="text-lg font-semibold text-white">Data Element Details</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#252526] p-4 rounded-lg border border-[#333333] space-y-4">
                      <h3 className="text-xs font-bold text-[#858585] uppercase tracking-wider">Definition</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#858585]">Domain</span>
                          <span className="text-purple-400 font-mono cursor-pointer hover:underline" onClick={() => handleObjectClick(selectedObject.raw_json?.domain, 'DOMA')}>
                            {selectedObject.raw_json?.domain || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#858585]">Data Type</span>
                          <span className="text-blue-400 font-mono">{selectedObject.raw_json?.dataType || selectedObject.raw_json?.datatype || selectedObject.raw_json?.type || selectedObject.raw_json?.DATATYPE || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#858585]">Length</span>
                          <span className="text-white font-mono">{selectedObject.raw_json?.length || selectedObject.raw_json?.len || selectedObject.raw_json?.LENG || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#858585]">Decimals</span>
                          <span className="text-white font-mono">{selectedObject.raw_json?.decimals || selectedObject.raw_json?.dec || selectedObject.raw_json?.DECIMALS || '0'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#252526] p-4 rounded-lg border border-[#333333] space-y-4">
                      <h3 className="text-xs font-bold text-[#858585] uppercase tracking-wider">Field Labels</h3>
                      <div className="space-y-3">
                        {['short', 'medium', 'long', 'heading'].map(label => (
                          <div key={label} className="space-y-1">
                            <span className="text-[10px] text-[#666] uppercase">{label}</span>
                            <div className="text-sm text-white bg-[#1e1e1e] p-2 rounded border border-[#333]">
                              {selectedObject.raw_json?.labels?.[label] || selectedObject.raw_json?.texts?.[label] || '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedObject.type === 'TRAN' ? (
                <div className="p-6 space-y-8">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-semibold text-white">Transaction Details</h2>
                  </div>

                  <div className="max-w-2xl bg-[#252526] p-6 rounded-lg border border-[#333333] space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-[#858585] uppercase tracking-wider">Transaction Code</span>
                        <div className="text-2xl font-mono text-amber-500">{selectedObject.name}</div>
                      </div>
                      
                      <div className="h-px bg-[#333333]" />

                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-[#858585] uppercase tracking-wider">Program</span>
                          <div className="text-blue-400 font-mono cursor-pointer hover:underline" onClick={() => handleObjectClick(selectedObject.raw_json?.program, 'PROG')}>
                            {selectedObject.raw_json?.program || '-'}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-[#858585] uppercase tracking-wider">Screen Number</span>
                          <div className="text-white font-mono">{selectedObject.raw_json?.screen || '-'}</div>
                        </div>
                      </div>

                      {selectedObject.raw_json?.tcodeType && (
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-[#858585] uppercase tracking-wider">Transaction Type</span>
                          <div className="text-[#ccc]">{selectedObject.raw_json.tcodeType}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : selectedObject.type === 'TTYP' ? (
                <div className="p-6 space-y-8">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-400" />
                    <h2 className="text-lg font-semibold text-white">Table Type Details</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#252526] p-4 rounded-lg border border-[#333333] space-y-4">
                      <h3 className="text-xs font-bold text-[#858585] uppercase tracking-wider">Line Type</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#858585]">Line Type</span>
                          <span className="text-blue-400 font-mono cursor-pointer hover:underline" onClick={() => handleObjectClick(selectedObject.raw_json?.lineType)}>
                            {selectedObject.raw_json?.lineType || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#858585]">Kind</span>
                          <span className="text-white">{selectedObject.raw_json?.lineTypeKind || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#252526] p-4 rounded-lg border border-[#333333] space-y-4">
                      <h3 className="text-xs font-bold text-[#858585] uppercase tracking-wider">Attributes</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#858585]">Access Mode</span>
                          <span className="text-amber-400">{selectedObject.raw_json?.accessMode || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#858585]">Key Category</span>
                          <span className="text-white">{selectedObject.raw_json?.keyCategory || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedObject.type === 'MSAG' ? (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-red-400" />
                      <h2 className="text-lg font-semibold text-white">Message Class</h2>
                    </div>
                    {selectedObject.raw_json?.masterLanguage && (
                      <div className="text-xs text-[#858585]">
                        Master Language: <span className="text-blue-400 font-mono">{selectedObject.raw_json.masterLanguage}</span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-[#333333] overflow-hidden">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#252526] text-left text-[#858585] uppercase text-[10px] tracking-wider">
                          <th className="p-3 border-b border-[#333333] w-20">Number</th>
                          <th className="p-3 border-b border-[#333333]">Message Text</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedObject?.raw_json?.messages?.map((m: any) => (
                          <tr key={m.number} className="hover:bg-[#2a2d2e] transition-colors">
                            <td className="p-3 border-b border-[#333333] font-mono text-amber-500">{m.number}</td>
                            <td className="p-3 border-b border-[#333333] text-[#ccc]">
                              {m.text}
                              {m.selfExplanatory && <span className="ml-2 text-[10px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 uppercase tracking-tighter">Self-explanatory</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : selectedObject.type === 'SIAC' ? (
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-[#333333] flex items-center justify-between bg-[#252526]">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-white">HTML Šablóna: {selectedObject.name}</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <SyntaxHighlighter 
                      language="xml" 
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, padding: '2rem', fontSize: '12px', background: 'transparent' }}
                      showLineNumbers
                    >
                      {selectedObject.raw_json?.source || selectedObject.raw_json?.content || ""}
                    </SyntaxHighlighter>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* Sub-objects Tabs (Includes/Functions/Dynpros) */}
                  {((selectedObject?.raw_json?.subObjects && selectedObject.raw_json.subObjects.length > 0) || selectedObject.type === 'CLAS') && (
                    <div className="flex border-b border-[#333333] bg-[#252526] overflow-x-auto scrollbar-hide">
                      <button 
                        onClick={() => setActiveSubObject('main')}
                        className={cn(
                          "px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors",
                          activeSubObject === 'main' ? "border-blue-500 bg-[#1e1e1e] text-white" : "border-transparent text-[#858585] hover:text-white"
                        )}
                      >
                        {selectedObject.type === 'CLAS' ? 'Definition' : 'Main Source'}
                      </button>
                      
                      {selectedObject.type === 'CLAS' && (
                        <button 
                          onClick={() => setActiveSubObject('implementation')}
                          className={cn(
                            "px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors",
                            activeSubObject === 'implementation' ? "border-blue-500 bg-[#1e1e1e] text-white" : "border-transparent text-[#858585] hover:text-white"
                          )}
                        >
                          Implementation
                        </button>
                      )}

                      {selectedObject?.raw_json?.subObjects?.map((sub: any) => (
                        <button 
                          key={sub.name} 
                          onClick={() => setActiveSubObject(sub.name)}
                          className={cn(
                            "px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors",
                            activeSubObject === sub.name ? "border-blue-500 bg-[#1e1e1e] text-white" : "border-transparent text-[#858585] hover:text-white"
                          )}
                        >
                          {sub.name} <span className="text-[9px] opacity-50 ml-1">({sub.type})</span>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Parameters / Components Section */}
                    {(() => {
                      const currentObj = activeSubObject === 'main' ? selectedObject?.raw_json : 
                                       activeSubObject === 'implementation' ? selectedObject?.raw_json :
                                       selectedObject?.raw_json?.subObjects?.find((s: any) => s.name === activeSubObject);
                      
                      if (!currentObj) return null;

                      return (
                        <div className="flex flex-col h-full">
                          {/* Metadata for Function Module, Class or Method */}
                          {(currentObj.type === 'FUNC' || currentObj.type === 'METH' || (selectedObject.type === 'CLAS' && activeSubObject === 'main')) && (
                            <div className="p-4 bg-[#252526]/50 border-b border-[#333333] overflow-y-auto max-h-64">
                              {currentObj.parameters && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {Object.entries(currentObj.parameters).map(([pType, pList]: [string, any]) => (
                                    pList && pList.length > 0 && (
                                      <div key={pType} className="space-y-1">
                                        <h4 className="text-[10px] uppercase font-bold text-blue-400 tracking-widest">{pType}</h4>
                                        <div className="text-[11px] space-y-1">
                                          {pList.map((p: any) => (
                                            <div key={p.name} className="flex gap-2 items-start">
                                              <span className="font-mono text-white">{p.name}</span>
                                              <span className="text-[#666]">TYPE</span>
                                              <span className="text-blue-300">{p.type}</span>
                                              {p.optional && <span className="text-[9px] bg-[#333] px-1 rounded text-[#858585]">OPT</span>}
                                              <span className="text-[#858585] italic ml-auto">{p.description}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  ))}
                                </div>
                              )}

                              {selectedObject.type === 'CLAS' && activeSubObject === 'main' && currentObj.components && (
                                <div className="space-y-4">
                                  {currentObj.components.attributes && currentObj.components.attributes.length > 0 && (
                                    <div className="space-y-1">
                                      <h4 className="text-[10px] uppercase font-bold text-green-400 tracking-widest">Attributes</h4>
                                      <div className="text-[11px] space-y-1">
                                        {currentObj.components.attributes.map((a: any) => (
                                          <div key={a.name} className="flex gap-2">
                                            <span className={cn("text-[9px] px-1 rounded", 
                                              a.visibility === 'PUBLIC' ? 'bg-green-900/30 text-green-400' : 
                                              a.visibility === 'PROTECTED' ? 'bg-amber-900/30 text-amber-400' : 'bg-red-900/30 text-red-400'
                                            )}>{a.visibility}</span>
                                            <span className="font-mono text-white">{a.name}</span>
                                            <span className="text-[#666]">TYPE</span>
                                            <span className="text-blue-300">{a.type}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {currentObj.components.methods && currentObj.components.methods.length > 0 && (
                                    <div className="space-y-1">
                                      <h4 className="text-[10px] uppercase font-bold text-blue-400 tracking-widest">Methods</h4>
                                      <div className="text-[11px] space-y-1">
                                        {currentObj.components.methods.map((m: any) => (
                                          <div key={m.name} className="flex gap-2">
                                            <span className={cn("text-[9px] px-1 rounded", 
                                              m.visibility === 'PUBLIC' ? 'bg-green-900/30 text-green-400' : 
                                              m.visibility === 'PROTECTED' ? 'bg-amber-900/30 text-amber-400' : 'bg-red-900/30 text-red-400'
                                            )}>{m.visibility}</span>
                                            <span className="font-mono text-white">{m.name}</span>
                                            <span className="text-[#858585] italic">{m.description}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Dynpro Elements */}
                          {currentObj.type === 'DYNP' && currentObj.elements && (
                            <div className="p-4 bg-[#252526]/50 border-b border-[#333333] overflow-y-auto max-h-64">
                              <h4 className="text-[10px] uppercase font-bold text-amber-400 tracking-widest mb-2">Screen Elements</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                                {currentObj.elements.map((el: any, idx: number) => (
                                  <div key={idx} className="bg-[#1e1e1e] p-1.5 rounded border border-[#333] flex flex-col">
                                    <span className="text-white font-bold">{el.name}</span>
                                    <span className="text-[#858585]">{el.type} - {el.text}</span>
                                    <span className="text-[#666] mt-1">L:{el.line} C:{el.col}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Source Code */}
                          <div 
                            className="flex-1 relative overflow-hidden cursor-text syntax-highlighter-container"
                            onDoubleClick={handleCodeDoubleClick}
                            title="Dvojklik pre navigáciu na objekt"
                          >
                            <SyntaxHighlighter 
                              language={
                                selectedObject?.type === 'TABL' ? 'sql' : 
                                selectedObject?.type === 'XSLT' ? 'xml' : 
                                'abap'
                              } 
                              style={vscDarkPlus}
                              customStyle={{ margin: 0, padding: '1.5rem', height: '100%', fontSize: '13px', background: 'transparent' }}
                              showLineNumbers
                              wrapLines={true}
                              lineProps={(lineNumber) => {
                                const code = activeSubObject === 'implementation' ? selectedObject?.raw_json?.implementation :
                                             activeSubObject === 'main' ? (selectedObject?.raw_json?.definition || selectedObject?.raw_json?.source || selectedObject?.raw_json?.flowLogic || selectedObject?.content) :
                                             (currentObj?.flowLogic || currentObj?.source || "");
                                
                                if (highlightTerm && code) {
                                  const lines = code.split('\n');
                                  const line = lines[lineNumber - 1];
                                  if (line && line.toLowerCase().includes(highlightTerm.toLowerCase())) {
                                    return { 
                                      className: 'highlighted-line',
                                      style: { display: 'block', backgroundColor: 'rgba(59, 130, 246, 0.2)', borderLeft: '2px solid #3b82f6' } 
                                    };
                                  }
                                }
                                return {};
                              }}
                            >
                              {activeSubObject === 'implementation' ? selectedObject?.raw_json?.implementation :
                               activeSubObject === 'main' ? (selectedObject?.raw_json?.definition || selectedObject?.raw_json?.source || selectedObject?.raw_json?.flowLogic || selectedObject?.content) :
                               (currentObj?.flowLogic || currentObj?.source || "")}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#454545]">
            <Terminal className="w-24 h-24 mb-4 opacity-10" />
            <p className="text-xl font-light tracking-wide">Vyberte objekt zo stromu alebo nahrajte ZIP export</p>
            <div className="mt-8 flex gap-4">
              <label className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md cursor-pointer transition-all shadow-lg hover:shadow-blue-500/20 flex items-center gap-2 font-medium">
                <Upload className="w-4 h-4" />
                Nahrať ZIP
                <input type="file" className="hidden" accept=".zip" onChange={handleFileUpload} />
              </label>
            </div>
            <div className="mt-12 max-w-md text-center text-xs text-[#666] leading-relaxed">
              Tento prehliadač podporuje ABAP programy, funkčné skupiny, tabuľky a XSLT transformácie. 
              Dáta sú uložené lokálne v SQLite databáze s podporou full-text vyhľadávania.
            </div>
          </div>
        )}
      </div>

      {isImporting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-6">
          <div className="bg-[#252526] rounded-xl shadow-2xl border border-[#454545] flex flex-col max-w-2xl w-full max-h-[80vh] overflow-hidden min-h-0">
            {/* Header */}
            <div className="p-6 border-b border-[#333333] flex items-center justify-between bg-[#2d2d2d]">
              <div className="flex items-center gap-3">
                {importStats.phase === 'Dokončené' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : importStats.phase === 'Chyba' ? (
                  <AlertCircle className="w-6 h-6 text-red-500" />
                ) : (
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                )}
                <h2 className="text-xl font-bold text-white">Import SAP objektov</h2>
              </div>
              <div className="text-xs font-mono text-[#858585] bg-[#1e1e1e] px-2 py-1 rounded">
                {importStats.phase}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 p-6 bg-[#1e1e1e]/50">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-[#666] font-bold">Celkovo</span>
                <span className="text-xl font-mono text-white">{importStats.total}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-[#666] font-bold">Spracované</span>
                <span className="text-xl font-mono text-blue-400">{importStats.current}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-[#666] font-bold">Úspešné</span>
                <span className="text-xl font-mono text-green-500">{importStats.success}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-[#666] font-bold">Chyby</span>
                <span className="text-xl font-mono text-red-500">{importStats.error}</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="px-6">
              <div className="w-full bg-[#333] h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${importStats.total > 0 ? (importStats.current / importStats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Logs Area */}
            <div className="flex-1 p-6 overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-[#858585]">
                  <Terminal className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Protokol spracovania</span>
                </div>
                {currentProcessingFile && importStats.phase !== 'Dokončené' && (
                  <div className="text-[10px] font-mono text-blue-400 truncate max-w-[300px]">
                    Spracovávam: {currentProcessingFile}
                  </div>
                )}
              </div>
              <div 
                ref={scrollRef}
                className="flex-1 bg-[#1e1e1e] rounded border border-[#333] p-4 font-mono text-[11px] overflow-y-auto space-y-1 min-h-0"
              >
                {importLogs.length === 0 ? (
                  <div className="text-[#454545] italic">Žiadne chyby počas spracovania...</div>
                ) : (
                  importLogs.map((log, idx) => (
                    <div key={idx} className={cn(
                      log.includes('[CHYBA]') || log.includes('FATÁLNA') ? "text-red-400" : 
                      log.includes('[OK]') ? "text-green-400/70" : "text-[#858585]"
                    )}>
                      {log}
                    </div>
                  ))
                )}
                {importStats.phase !== 'Dokončené' && importStats.phase !== 'Chyba' && (
                  <div className="animate-pulse text-blue-400">...</div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#333333] flex justify-end bg-[#2d2d2d]">
              {(importStats.phase === 'Dokončené' || importStats.phase === 'Chyba') && (
                <button 
                  onClick={() => setIsImporting(false)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-all shadow-lg hover:shadow-blue-500/20"
                >
                  Zavrieť protokol
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-[#252526] p-6 rounded-lg shadow-2xl border border-[#454545] max-w-md w-full">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Potvrdenie vymazania</h3>
            </div>
            <p className="text-[#cccccc] mb-6">
              {deleteConfirmation.name ? (
                <>Naozaj chcete vymazať objekt <span className="text-white font-mono font-bold">{deleteConfirmation.name}</span> z balíčka <span className="text-white font-mono font-bold">{deleteConfirmation.pkg}</span>?</>
              ) : (
                <>Naozaj chcete vymazať všetky dáta paketu <span className="text-white font-mono font-bold">{deleteConfirmation.pkg}</span> zo systému <span className="text-white font-mono font-bold">{deleteConfirmation.system}</span>?</>
              )}
              <br /><br />
              Táto akcia je nevratná.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 rounded bg-[#333333] hover:bg-[#444444] text-white transition-colors text-sm font-medium"
              >
                Zrušiť
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white transition-colors text-sm font-medium"
              >
                Vymazať dáta
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportScript && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-6">
          <div className="bg-[#252526] rounded-xl shadow-2xl border border-[#454545] flex flex-col max-w-4xl w-full h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-[#333333] flex items-center justify-between bg-[#2d2d2d]">
              <div className="flex items-center gap-3">
                <Code2 className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-bold text-white">ABAP Exportný Program</h2>
              </div>
              <button 
                onClick={() => setShowExportScript(false)}
                className="text-[#858585] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden relative bg-[#1e1e1e]">
              <div className="absolute top-4 right-4 z-10">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(ABAP_EXPORT_SCRIPT);
                    alert("Kód bol skopírovaný do schránky");
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-all shadow-lg"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Kopírovať kód
                </button>
              </div>
              <div className="h-full overflow-auto">
                <SyntaxHighlighter 
                  language="abap" 
                  style={vscDarkPlus}
                  customStyle={{ margin: 0, padding: '2rem', fontSize: '12px', background: 'transparent' }}
                  showLineNumbers
                >
                  {ABAP_EXPORT_SCRIPT}
                </SyntaxHighlighter>
              </div>
            </div>
            <div className="p-4 border-t border-[#333333] flex justify-between items-center bg-[#2d2d2d]">
              <p className="text-xs text-[#858585]">
                Tento program vygeneruje ZIP súbor so všetkými objektmi v balíčku, ktorý následne nahráte do tohto prehliadača.
              </p>
              <button 
                onClick={() => setShowExportScript(false)}
                className="px-6 py-2 bg-[#333333] hover:bg-[#444444] text-white rounded-md transition-colors font-medium"
              >
                Zavrieť
              </button>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[#252526] border border-[#333333] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#333333] flex items-center justify-between bg-[#2d2d2d]">
              <div className="flex items-center gap-2 font-bold text-white">
                <Settings className="w-5 h-5 text-blue-400" />
                <span>Správa databáz</span>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 hover:bg-[#333333] rounded text-[#858585] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              {/* Database List */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#858585] uppercase tracking-wider block">
                  Dostupné databázy
                </label>
                <div className="space-y-2">
                  {databases.map((db) => (
                    <div 
                      key={db.path}
                      className={cn(
                        "p-3 rounded border flex items-center justify-between group transition-all",
                        db.active 
                          ? "bg-blue-500/10 border-blue-500/50" 
                          : "bg-[#1e1e1e] border-[#333333] hover:border-[#444444]"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Database className={cn("w-4 h-4", db.active ? "text-blue-400" : "text-[#666]")} />
                        <div className="flex flex-col min-w-0">
                          <span className={cn("text-sm font-medium truncate", db.active ? "text-white" : "text-[#cccccc]")}>
                            {db.name}
                          </span>
                          <span className="text-[10px] text-[#666] truncate font-mono">
                            {db.path}
                          </span>
                        </div>
                      </div>
                      {db.active ? (
                        <Check className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : (
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => switchDatabase(db.path)}
                            className="px-2 py-1 bg-[#333] hover:bg-[#444] text-[10px] text-white rounded transition-all"
                          >
                            Prepnúť
                          </button>
                          <button 
                            onClick={() => deleteDatabase(db.path)}
                            className="p-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded transition-all"
                            title="Vymazať databázu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Create or Add Database */}
              <div className="space-y-3 pt-4 border-t border-[#333333]">
                <label className="text-xs font-bold text-[#858585] uppercase tracking-wider block">
                  Pridať alebo vytvoriť databázu
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FolderPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                    <input 
                      type="text" 
                      value={newDbName}
                      onChange={(e) => setNewDbName(e.target.value)}
                      className="w-full bg-[#1e1e1e] border border-[#333333] rounded pl-10 pr-10 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Názov alebo absolútna cesta k .db súboru"
                      onKeyDown={(e) => e.key === 'Enter' && createDatabase()}
                    />
                    <button 
                      onClick={() => browseFileSystem()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[#333] rounded text-[#858585] hover:text-white transition-colors"
                      title="Prehliadať súbory"
                    >
                      <Folder className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    onClick={createDatabase}
                    disabled={!newDbName}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Pridať
                  </button>
                </div>
                <p className="text-[10px] text-[#666]">
                  Zadajte názov pre novú databázu v predvolenom priečinku, alebo celú cestu pre existujúci súbor kdekoľvek v systéme.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-[#333333] flex justify-end bg-[#2d2d2d]">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-all"
              >
                Hotovo
              </button>
            </div>
          </div>
        </div>
      )}

      {isFileExplorerOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-[#252526] border border-[#333333] rounded-lg shadow-2xl w-full max-w-2xl h-[70vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-[#333333] flex items-center justify-between bg-[#2d2d2d]">
              <div className="flex items-center gap-2 font-bold text-white">
                <Folder className="w-5 h-5 text-blue-400" />
                <span>Prehliadač súborov</span>
              </div>
              <button 
                onClick={() => setIsFileExplorerOpen(false)}
                className="text-[#858585] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-[#1e1e1e] border-b border-[#333333] flex items-center gap-2">
              <button 
                onClick={() => browseFileSystem()}
                className="p-1.5 hover:bg-[#333] rounded text-[#858585] hover:text-white transition-colors"
                title="Domov"
              >
                <Home className="w-4 h-4" />
              </button>
              <button 
                onClick={() => browseFileSystem(fsParentPath)}
                disabled={fsCurrentPath === fsParentPath}
                className="p-1.5 hover:bg-[#333] rounded text-[#858585] hover:text-white transition-colors disabled:opacity-30"
                title="Hore"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <div className="flex-1 bg-[#252526] border border-[#333333] rounded px-3 py-1 text-xs text-[#cccccc] font-mono truncate">
                {fsCurrentPath}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {fsLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1">
                  {fsItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => {
                        if (item.isDirectory) {
                          browseFileSystem(item.path);
                        } else {
                          setNewDbName(item.path);
                          setIsFileExplorerOpen(false);
                        }
                      }}
                      className="flex items-center gap-3 p-2 hover:bg-[#2d2d2d] rounded text-left transition-colors group"
                    >
                      {item.isDirectory ? (
                        <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <File className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                      <span className="text-sm text-[#cccccc] truncate flex-1 group-hover:text-white">
                        {item.name}
                      </span>
                      {item.isDirectory && (
                        <ChevronRight className="w-3 h-3 text-[#666] opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#333333] flex justify-between items-center bg-[#2d2d2d]">
              <p className="text-[10px] text-[#666]">
                Vyberte adresár pre vytvorenie novej databázy, alebo existujúci .db súbor.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    const pathWithSep = fsCurrentPath.endsWith(fsSep) ? fsCurrentPath : fsCurrentPath + fsSep;
                    setNewDbName(pathWithSep);
                    setIsFileExplorerOpen(false);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                >
                  Vybrať tento priečinok
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dbToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-[#252526] border border-red-900/50 rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-[#333333] flex items-center justify-between bg-red-950/20">
              <div className="flex items-center gap-2 font-bold text-red-400">
                <Trash2 className="w-5 h-5" />
                <span>Vymazať databázu</span>
              </div>
              <button 
                onClick={() => setDbToDelete(null)}
                className="text-[#858585] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#cccccc]">
                Naozaj chcete vymazať tento databázový súbor? Táto operácia je <span className="text-red-400 font-bold uppercase">nevratná</span> a všetky dáta v tejto databáze budú stratené.
              </p>
              <div className="bg-[#1e1e1e] p-3 rounded border border-[#333333] text-[10px] font-mono text-[#858585] break-all">
                {dbToDelete}
              </div>
            </div>

            <div className="p-4 border-t border-[#333333] flex justify-end gap-3 bg-[#2d2d2d]">
              <button 
                onClick={() => setDbToDelete(null)}
                className="px-4 py-2 text-sm text-[#cccccc] hover:text-white transition-colors"
              >
                Zrušiť
              </button>
              <button 
                onClick={confirmDeleteDatabase}
                disabled={isDeletingDb}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white transition-colors text-sm font-medium flex items-center gap-2"
              >
                {isDeletingDb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Potvrdiť vymazanie
              </button>
            </div>
          </div>
        </div>
      )}

      {isClearModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-[#252526] border border-red-900/50 rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-[#333333] flex items-center justify-between bg-red-950/20">
              <div className="flex items-center gap-2 font-bold text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>Kritická operácia</span>
              </div>
              <button 
                onClick={() => setIsClearModalOpen(false)}
                className="p-1 hover:bg-red-900/20 rounded text-[#858585] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-white">Vymazať celú databázu?</h3>
                <p className="text-sm text-[#858585]">
                  Táto akcia nenávratne odstráni všetky importované ABAP objekty, balíčky a systémy z vašej lokálnej databázy.
                </p>
              </div>

              <div className="bg-red-950/10 border border-red-900/20 p-4 rounded-lg space-y-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="pt-0.5">
                    <input 
                      type="checkbox" 
                      checked={confirmClearCheckbox}
                      onChange={(e) => setConfirmClearCheckbox(e.target.checked)}
                      className="w-4 h-4 rounded border-[#333333] bg-[#3c3c3c] text-red-600 focus:ring-red-600 focus:ring-offset-[#1e1e1e]"
                    />
                  </div>
                  <span className="text-sm text-[#cccccc] group-hover:text-white transition-colors">
                    Rozumiem, že táto operácia je trvalá a dáta nebude možné obnoviť.
                  </span>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-[#333333] flex justify-end gap-3 bg-[#2d2d2d]">
              <button 
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 text-sm text-[#cccccc] hover:text-white transition-colors"
              >
                Zrušiť
              </button>
              <button 
                onClick={handleActualClear}
                disabled={!confirmClearCheckbox}
                className={cn(
                  "px-6 py-2 rounded-md transition-all font-bold flex items-center gap-2",
                  confirmClearCheckbox 
                    ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20" 
                    : "bg-[#333333] text-[#666666] cursor-not-allowed"
                )}
              >
                <Trash2 className="w-4 h-4" />
                Vymazať všetko
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
