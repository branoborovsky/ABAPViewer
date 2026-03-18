import React, { useState, useEffect, useMemo } from 'react';
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
  Cpu,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Code2,
  Settings,
  X
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

export default function App() {
  const [treeData, setTreeData] = useState<ABAPObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<FullObject | null>(null);
  const [activeSubObject, setActiveSubObject] = useState<string>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
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
  const [isSavingSettings, setIsSavingSettings] = useState(false);

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
  }, []);

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

  const isTauri = !!(window as any).__TAURI_INTERNALS__;

  const clearDatabase = async () => {
    if (!confirm("Naozaj chcete vymazať celú databázu?")) return;
    try {
      const res = await fetch('/api/clear', { method: 'POST' });
      if (res.ok) {
        setTreeData([]);
        setSelectedObject(null);
      }
    } catch (err) {
      console.error("Failed to clear database", err);
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
        const text = await zipEntry.async('string');
        try {
          const obj = JSON.parse(text);
          objects.push(obj);
          setImportStats(prev => ({ ...prev, success: prev.success + 1 }));
          setImportLogs(prev => [...prev.slice(-8), `[OK] ${filename}`]);
        } catch (e) {
          setImportStats(prev => ({ ...prev, error: prev.error + 1 }));
          setImportLogs(prev => [...prev.slice(-8), `[CHYBA] ${filename}: Neplatný JSON`]);
        }
      }

      if (objects.length > 0) {
        setImportStats(prev => ({ ...prev, phase: 'Ukladám do databázy...' }));
        setImportLogs(prev => [...prev, `Odosielam ${objects.length} objektov do DB...`]);
        
        // Flatten objects for both Web and Desktop to ensure consistent processing
        const flattened: any[] = [];
        objects.forEach(obj => {
          // 1. Main object
          const searchableContent = (obj.source || "") + "\n" + (obj.definition || "") + "\n" + (obj.implementation || "") + "\n" + (obj.flowLogic || "");
          flattened.push({
            system: obj.system,
            package: obj.package,
            type: obj.objectType || obj.type,
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
        setImportLogs(prev => [...prev, "Databáza bola úspešne aktualizovaná."]);
        await fetchTree();
      } else {
        setImportLogs(prev => [...prev, "Nenašli sa žiadne platné JSON objekty na import."]);
      }
      
      setImportStats(prev => ({ ...prev, phase: 'Dokončené' }));
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
        if (parentPkg[cat][pName]) {
          parentPkg[cat][pName].children.push(obj);
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
                                          if (obj.children.length > 0) toggleNode(`obj-${obj.system}-${obj.package}-${obj.name}`);
                                          selectObject(obj.name);
                                        }}
                                      >
                                        <div className="w-3 flex justify-center">
                                          {obj.children.length > 0 && (expandedNodes.has(`obj-${obj.system}-${obj.package}-${obj.name}`) ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />)}
                                        </div>
                                        {obj.type === 'TABL' ? <TableIcon className="w-3.5 h-3.5 text-green-500" /> : 
                                         obj.type === 'CLAS' ? <Cpu className="w-3.5 h-3.5 text-purple-400" /> :
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

                                      {expandedNodes.has(`obj-${obj.system}-${obj.package}-${obj.name}`) && obj.children.length > 0 && (
                                        <div className="ml-6 border-l border-[#444]">
                                          {obj.children.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((child: any) => (
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
                            <td className="p-3 border-b border-[#333333] text-[#ccc]">{f.type}</td>
                            <td className="p-3 border-b border-[#333333] text-[#858585]">{f.length}</td>
                            <td className="p-3 border-b border-[#333333] text-[#858585]">{f.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
          <div className="bg-[#252526] rounded-xl shadow-2xl border border-[#454545] flex flex-col max-w-2xl w-full max-h-[80vh] overflow-hidden">
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
            <div className="flex-1 p-6 overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 mb-2 text-[#858585]">
                <Terminal className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Protokol spracovania</span>
              </div>
              <div className="flex-1 bg-[#1e1e1e] rounded border border-[#333] p-4 font-mono text-[11px] overflow-y-auto space-y-1">
                {importLogs.map((log, idx) => (
                  <div key={idx} className={cn(
                    log.includes('[CHYBA]') || log.includes('FATÁLNA') ? "text-red-400" : 
                    log.includes('[OK]') ? "text-green-400/70" : "text-[#858585]"
                  )}>
                    {log}
                  </div>
                ))}
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
          <div className="bg-[#252526] border border-[#333333] rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#333333] flex items-center justify-between bg-[#2d2d2d]">
              <div className="flex items-center gap-2 font-bold text-white">
                <Settings className="w-5 h-5 text-blue-400" />
                <span>Nastavenia</span>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 hover:bg-[#333333] rounded text-[#858585] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#cccccc] block">
                  Cesta k databáze (SQLite)
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newDbPath}
                    onChange={(e) => setNewDbPath(e.target.value)}
                    className="flex-1 bg-[#3c3c3c] border border-[#333333] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="napr. abap_viewer.db"
                  />
                </div>
                <p className="text-xs text-[#858585]">
                  Aktuálna cesta: <span className="text-[#cccccc] font-mono">{dbPath}</span>
                </p>
              </div>

              <div className="bg-[#1e1e1e] p-3 rounded border border-[#333333] text-xs text-[#858585] space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p>Zmena cesty k databáze vytvorí nový súbor alebo sa pripojí k existujúcemu na danej ceste.</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#333333] flex justify-end gap-3 bg-[#2d2d2d]">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm text-[#cccccc] hover:text-white transition-colors"
              >
                Zrušiť
              </button>
              <button 
                onClick={saveSettings}
                disabled={isSavingSettings || newDbPath === dbPath}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2"
              >
                {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Uložiť nastavenia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
