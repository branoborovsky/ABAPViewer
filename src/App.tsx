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
  ArrowLeft
} from 'lucide-react';
import JSZip from 'jszip';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import abap from 'react-syntax-highlighter/dist/esm/languages/prism/abap';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { invoke } from '@tauri-apps/api/core';

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
}

interface FullObject extends ABAPObject {
  content: string;
  raw_json: any;
}

SyntaxHighlighter.registerLanguage('abap', abap);
SyntaxHighlighter.registerLanguage('sql', sql);

export default function App() {
  const [treeData, setTreeData] = useState<ABAPObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<FullObject | null>(null);
  const [activeSubObject, setActiveSubObject] = useState<string>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [deleteConfirmation, setDeleteConfirmation] = useState<{system: string, pkg: string} | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);

  useEffect(() => {
    fetchTree();
  }, []);

  const isTauri = !!(window as any).__TAURI_INTERNALS__;

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

  const selectObject = async (name: string, addToHistory = true) => {
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

    setIsImporting(true);
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const objects: any[] = [];

      for (const [filename, zipEntry] of Object.entries(contents.files)) {
        if (filename.endsWith('.json')) {
          const text = await zipEntry.async('string');
          try {
            objects.push(JSON.parse(text));
          } catch (e) {
            console.warn(`Failed to parse ${filename}`, e);
          }
        }
      }

      if (objects.length > 0) {
        if (isTauri) {
          await invoke('import_objects', { objects });
        } else {
          await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objects })
          });
        }
        await fetchTree();
      }
    } catch (err) {
      console.error("Import failed", err);
      alert("Chyba pri importe ZIP súboru.");
    } finally {
      setIsImporting(false);
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

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { system, pkg } = deleteConfirmation;
    
    console.log('Confirming delete for:', { system, pkg });
    setDeleteConfirmation(null);

    try {
      if (isTauri) {
        await invoke('delete_package', { system, package: pkg });
        console.log('Delete successful (Tauri)');
        await fetchTree();
        if (selectedObject?.system === system && selectedObject?.package === pkg) {
          setSelectedObject(null);
        }
      } else {
        const url = `/api/package/${encodeURIComponent(system)}/${encodeURIComponent(pkg)}`;
        console.log('Calling delete API:', url);
        
        const res = await fetch(url, {
          method: 'DELETE'
        });
        
        if (res.ok) {
          console.log('Delete successful');
          await fetchTree();
          if (selectedObject?.system === system && selectedObject?.package === pkg) {
            setSelectedObject(null);
          }
        } else {
          const errorData = await res.json();
          console.error('Delete failed on server:', errorData);
          alert(`Chyba pri mazaní: ${errorData.error || res.statusText}`);
        }
      }
    } catch (err) {
      console.error("Delete request failed", err);
      alert("Chyba pri komunikácii so serverom.");
    }
  };

  const groupedTree = useMemo(() => {
    const root: any = {};
    
    // Create a set of objects that are already children to avoid double display at top level
    const childSet = new Set(treeData.filter(obj => obj.parent_name).map(obj => `${obj.system}|${obj.package}|${obj.name}`));

    // First pass: build structure without sub-objects
    treeData.forEach(obj => {
      if (obj.parent_name) return; // Skip sub-objects for now
      
      // Also skip if this object is already a child of another object (e.g. an include in a program)
      if (childSet.has(`${obj.system}|${obj.package}|${obj.name}`)) return;

      if (!root[obj.system]) root[obj.system] = {};
      if (!root[obj.system][obj.package]) root[obj.system][obj.package] = {};
      
      // Group by category for better UX
      let category = 'Ostatné';
      if (obj.type === 'PROG') category = 'Programy';
      else if (obj.type === 'TABL') category = 'Tabuľky';
      else if (obj.type === 'FUGR') category = 'Funkčné skupiny';
      else if (obj.type === 'CLAS') category = 'Triedy';
      else if (obj.type === 'XSLT') category = 'Transformácie';

      if (!root[obj.system][obj.package][category]) root[obj.system][obj.package][category] = {};
      
      root[obj.system][obj.package][category][obj.name] = {
        ...obj,
        children: []
      };
    });

    // Second pass: attach sub-objects to parents
    treeData.forEach(obj => {
      if (!obj.parent_name) return;

      // Find parent in the tree
      for (const sys in root) {
        for (const pkg in root[sys]) {
          for (const cat in root[sys][pkg]) {
            if (root[sys][pkg][cat][obj.parent_name]) {
              root[sys][pkg][cat][obj.parent_name].children.push(obj);
              return;
            }
          }
        }
      }
    });

    return root;
  }, [treeData]);

  return (
    <div className="flex h-screen bg-[#1e1e1e] text-[#cccccc] font-sans selection:bg-[#264f78]">
      {/* Sidebar */}
      <div className="w-80 flex flex-col border-r border-[#333333] bg-[#252526]">
        <div className="p-4 border-b border-[#333333] flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white">
            <Cpu className="w-5 h-5 text-blue-400" />
            <span>ABAP Viewer</span>
          </div>
          <label className="cursor-pointer hover:text-white transition-colors p-1 rounded hover:bg-[#333333]">
            <Upload className="w-4 h-4" />
            <input type="file" className="hidden" accept=".zip" onChange={handleFileUpload} />
          </label>
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
                  onClick={() => selectObject(res.name)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-400/10 px-1 rounded">{res.type}</span>
                    <span className="text-sm font-bold text-white">{res.name}</span>
                  </div>
                  <div className="text-xs text-[#858585] truncate">{res.description}</div>
                  <div className="text-[10px] text-[#666] mt-1 italic" dangerouslySetInnerHTML={{ __html: res.snippet }} />
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
                                    <div key={obj.name}>
                                      <div 
                                        className={cn(
                                          "flex items-center gap-2 py-1 px-3 hover:bg-[#2a2d2e] cursor-pointer rounded m-0.5 group",
                                          selectedObject?.name === obj.name && "bg-[#37373d] text-white"
                                        )}
                                        onClick={() => {
                                          if (obj.children.length > 0) toggleNode(`obj-${obj.name}`);
                                          selectObject(obj.name);
                                        }}
                                      >
                                        <div className="w-3 flex justify-center">
                                          {obj.children.length > 0 && (expandedNodes.has(`obj-${obj.name}`) ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />)}
                                        </div>
                                        {obj.type === 'TABL' ? <TableIcon className="w-3.5 h-3.5 text-green-500" /> : <FileCode className="w-3.5 h-3.5 text-blue-300" />}
                                        <span className="truncate group-hover:text-white">{obj.name}</span>
                                      </div>

                                      {expandedNodes.has(`obj-${obj.name}`) && obj.children.length > 0 && (
                                        <div className="ml-6 border-l border-[#444]">
                                          {obj.children.map((child: any) => (
                                            <div 
                                              key={child.name}
                                              className={cn(
                                                "flex items-center gap-2 py-1 px-3 hover:bg-[#2a2d2e] cursor-pointer rounded m-0.5 text-[12px]",
                                                selectedObject?.name === child.name && "bg-[#37373d] text-white"
                                              )}
                                              onClick={() => selectObject(child.name)}
                                            >
                                              <span className="text-[9px] font-mono text-[#666] w-8 uppercase">{child.type}</span>
                                              <span className="truncate">{child.name}</span>
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
                          {/* Metadata for Function Module or Class */}
                          {(currentObj.type === 'FUNC' || (selectedObject.type === 'CLAS' && activeSubObject === 'main')) && (
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
                            className="flex-1 relative overflow-hidden cursor-text"
                            onDoubleClick={handleCodeDoubleClick}
                            title="Dvojklik pre navigáciu na objekt"
                          >
                            <SyntaxHighlighter 
                              language={selectedObject?.type === 'TABL' ? 'sql' : 'abap'} 
                              style={vscDarkPlus}
                              customStyle={{ margin: 0, padding: '1.5rem', height: '100%', fontSize: '13px', background: 'transparent' }}
                              showLineNumbers
                            >
                              {activeSubObject === 'implementation' ? selectedObject?.raw_json?.implementation :
                               activeSubObject === 'main' ? (selectedObject?.raw_json?.definition || selectedObject?.raw_json?.source || selectedObject?.content) :
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100]">
          <div className="bg-[#252526] p-10 rounded-xl shadow-2xl border border-[#454545] flex flex-col items-center max-w-sm w-full">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-xl font-bold text-white">Importujem SAP objekty</p>
            <p className="text-sm text-[#858585] mt-3 text-center">Spracovávam JSON súbory a indexujem databázu pre rýchle vyhľadávanie.</p>
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
              Naozaj chcete vymazať všetky dáta paketu <span className="text-white font-mono font-bold">{deleteConfirmation.pkg}</span> zo systému <span className="text-white font-mono font-bold">{deleteConfirmation.system}</span>? 
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
    </div>
  );
}
