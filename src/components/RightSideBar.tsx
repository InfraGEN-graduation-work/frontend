import React, { useState, useRef, useEffect } from 'react';
import type { NodeData, FileGroup, Edge, SelectionArea, CloudProvider, CloudSettings } from '../types';
import type { ViewportState } from '../MainPage';

interface RightSideBarProps {
  nodes: NodeData[];
  setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
  edges: Edge[];
  activeTab: 'Project' | 'Settings' | 'Validation';
  setActiveTab: React.Dispatch<React.SetStateAction<'Project' | 'Settings' | 'Validation'>>;
  saveHistory: () => void;
  files: FileGroup[];
  setFiles: React.Dispatch<React.SetStateAction<FileGroup[]>>;
  targetFileIds: string[];
  setTargetFileIds: React.Dispatch<React.SetStateAction<string[]>>;
  markFilesAsModified: () => void;
  deleteRightPanelItems: (fileIds: string[], nodeIds: string[]) => void;
  selectedFileId: string | null;
  setSelectedFileId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedNodeIds: string[];
  viewport: ViewportState;
  zoomLevel: number;
  setFocusNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  validationErrors: { name: string; desc: string; targetNodeId?: string; isGlobal?: boolean; targetField?: string; isProjectTab?: boolean }[];
  resetTrigger: number;
  setSelection: React.Dispatch<React.SetStateAction<SelectionArea>>; 
  setIsSelectMode: React.Dispatch<React.SetStateAction<boolean>>; 
  cloudProvider: CloudProvider;
  includeLocal: boolean;
  setIncludeLocal: React.Dispatch<React.SetStateAction<boolean>>;
  cloudSettings: CloudSettings;
  setCloudSettings: React.Dispatch<React.SetStateAction<CloudSettings>>;
}

const RightSideBar: React.FC<RightSideBarProps> = ({ 
  nodes, setNodes, edges, activeTab, setActiveTab, saveHistory, files, setFiles, targetFileIds, setTargetFileIds, markFilesAsModified, deleteRightPanelItems,
  selectedFileId, setSelectedFileId, setSelectedNodeIds, selectedNodeIds, viewport, zoomLevel, setFocusNodeId, validationErrors, resetTrigger,
  setSelection, setIsSelectMode, cloudProvider, includeLocal, setIncludeLocal, cloudSettings, setCloudSettings
}) => {
  const [dragOverFileId, setDragOverFileId] = useState<string | null>(null);
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);
  const [isDragOverUnassigned, setIsDragOverUnassigned] = useState(false);
  
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [isTargetBoxCollapsed, setIsTargetBoxCollapsed] = useState(false);
  const [isUnassignedCollapsed, setIsUnassignedCollapsed] = useState(false);
  const [collapsedTargetFiles, setCollapsedTargetFiles] = useState<string[]>([]);

  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);

  const [collapsedErrorGroups, setCollapsedErrorGroups] = useState<string[]>([]);

  const clearCanvasSelectionArea = () => {
    setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
    setIsSelectMode(false);
  };

  useEffect(() => {
    if (resetTrigger > 0) {
      setIsMultiSelectMode(false);
      setCheckedItems(new Set());
      setEditingFileId(null);
      setIsTargetBoxCollapsed(true);
      setIsUnassignedCollapsed(true);
      setCollapsedTargetFiles([...targetFileIds]); 
      setOpenDropdownKey(null);
      setHighlightedField(null);
      setCollapsedErrorGroups([]); 
    }
  }, [resetTrigger, targetFileIds]);

  const wasDroppedInTarget = useRef(false);
  const unassignedNodes = nodes.filter((canvasNode) => !files.some((file) => file.nodeIds.includes(canvasNode.id)));

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleNodeDragStart = (e: React.DragEvent, nodeId: string) => {
    e.stopPropagation();
    let dragIds = [nodeId];

    if (isMultiSelectMode && checkedItems.has(nodeId)) {
      dragIds = Array.from(checkedItems).filter(id => id.startsWith('node-'));
    } 
    else if (!isMultiSelectMode && selectedNodeIds.includes(nodeId) && selectedNodeIds.length > 1) {
      dragIds = [...selectedNodeIds];
    }
    
    e.dataTransfer.setData('rightBarNodeIds', JSON.stringify(dragIds));
  };

  const handleFileDragStart = (e: React.DragEvent, fileId: string) => {
    if (editingFileId === fileId) return; 
    e.stopPropagation();
    let dragIds = [fileId];
    if (isMultiSelectMode && checkedItems.has(fileId)) {
      dragIds = Array.from(checkedItems).filter(id => id.startsWith('file-'));
    }
    e.dataTransfer.setData('rightBarFileIds', JSON.stringify(dragIds));
    wasDroppedInTarget.current = false;
  };

  const handleFileDragEnd = (_e: React.DragEvent, fileId: string) => {
    if (!wasDroppedInTarget.current) {
      saveHistory();
      let dragIds = [fileId];
      if (isMultiSelectMode && checkedItems.has(fileId)) {
        dragIds = Array.from(checkedItems).filter(id => id.startsWith('file-'));
      }
      setTargetFileIds((prev) => prev.filter(id => !dragIds.includes(id)));
      if (isMultiSelectMode) setCheckedItems(new Set());
    }
    wasDroppedInTarget.current = false;
  };

  const handleDropNodeToFile = (e: React.DragEvent, fileId: string) => {
    e.preventDefault();
    setDragOverFileId(null);
    const data = e.dataTransfer.getData('rightBarNodeIds');
    if (!data) return;
    const nodeIds: string[] = JSON.parse(data);

    saveHistory();
    markFilesAsModified();
    setFiles((prev) => prev.map((f) => {
      let filteredNodeIds = f.nodeIds.filter(id => !nodeIds.includes(id));
      if (f.id === fileId) {
        filteredNodeIds = [...filteredNodeIds, ...nodeIds.filter(id => !filteredNodeIds.includes(id))];
      }
      return { ...f, nodeIds: filteredNodeIds };
    }));

    if (isMultiSelectMode) setCheckedItems(new Set());
  };

  const handleDropToUnassigned = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverUnassigned(false);
    const data = e.dataTransfer.getData('rightBarNodeIds');
    if (!data) return;
    const nodeIds: string[] = JSON.parse(data);

    saveHistory();
    markFilesAsModified();
    setFiles((prev) => prev.map((f) => ({ ...f, nodeIds: f.nodeIds.filter(id => !nodeIds.includes(id)) })));
    if (isMultiSelectMode) setCheckedItems(new Set());
  };

  const handleDropFileToTarget = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTarget(false);
    const data = e.dataTransfer.getData('rightBarFileIds');
    if (!data) return;
    const fileIds: string[] = JSON.parse(data);

    wasDroppedInTarget.current = true;
    let hasConflict = false;
    fileIds.forEach(id => { if (targetFileIds.includes(id)) hasConflict = true; });

    if (hasConflict) {
      if (window.confirm('이미 존재하는 파일이 포함되어 있습니다. 최신 상태로 덮어쓰시겠습니까?')) {
        saveHistory();
        setTargetFileIds(prev => Array.from(new Set([...prev, ...fileIds])));
      }
    } else {
      saveHistory();
      setTargetFileIds(prev => Array.from(new Set([...prev, ...fileIds])));
    }

    if (isMultiSelectMode) setCheckedItems(new Set());
  };

  const handleAddFile = () => {
    saveHistory();
    const newId = `file-${Date.now()}`;
    const newFile: FileGroup = { id: newId, name: '', isGenerated: false, nodeIds: [], isExpanded: true };
    setFiles([...files, newFile]);
    setEditingFileId(newId);
    setEditingName('');
  };

  const saveFileNameEdit = (id: string) => {
    const finalName = editingName.trim() || '새 파일';
    saveHistory();
    setFiles((prev) => prev.map(f => f.id === id ? { ...f, name: finalName, isGenerated: false } : f));
    setEditingFileId(null);
  };

  const toggleMainExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFiles(prev => prev.map(f => f.id === id ? { ...f, isExpanded: !f.isExpanded } : f));
  };

  const toggleTargetExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCollapsedTargetFiles(prev => prev.includes(id) ? prev.filter(fileId => fileId !== id) : [...prev, id]);
  };

  const toggleFileCheck = (fileId: string, childNodeIds: string[]) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(fileId)) {
      newChecked.delete(fileId);
      childNodeIds.forEach(id => newChecked.delete(id));
    } else {
      newChecked.add(fileId);
      childNodeIds.forEach(id => newChecked.add(id));
    }
    setCheckedItems(newChecked);
  };

  const toggleNodeCheck = (nodeId: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(nodeId)) newChecked.delete(nodeId);
    else newChecked.add(nodeId);
    setCheckedItems(newChecked);
  };

  const handleDeleteItems = () => {
    const fileIdsToDelete = files.map(f => f.id).filter(id => checkedItems.has(id));
    const nodeIdsToDelete = nodes.map(n => n.id).filter(id => checkedItems.has(id));
    deleteRightPanelItems(fileIdsToDelete, nodeIdsToDelete);
    setCheckedItems(new Set()); 
  };

  const handleDownloadItems = () => {
    const selectedFiles = files.filter(f => checkedItems.has(f.id));
    const filesWithCode = selectedFiles.filter(f => f.generatedFiles && f.generatedFiles.length > 0);

    if (filesWithCode.length > 0) {
      filesWithCode.forEach(fileGroup => {
        const gFiles = fileGroup.generatedFiles || [];
        if (gFiles.length > 0) {
          gFiles.forEach(gf => {
            const blob = new Blob([gf.content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileGroup.name}_${gf.fileName}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          });
        }
      });
    } else alert("다운로드 할 수 없습니다. (먼저 코드를 Generate 해주세요)");
  };

  const cancelSelectionMode = () => {
    setIsMultiSelectMode(false);
    setCheckedItems(new Set());
  };

  const handleBackgroundClick = (_e: React.MouseEvent) => {
    setOpenDropdownKey(null);
    if (isMultiSelectMode) return;
    clearCanvasSelectionArea();
    setSelectedNodeIds([]);
    setSelectedFileId(null);
  };

  const handleFileClick = (e: React.MouseEvent, fileId: string, nodeIds: string[]) => {
    e.stopPropagation();
    if (isMultiSelectMode) {
      toggleFileCheck(fileId, nodeIds);
      return;
    }
    clearCanvasSelectionArea();
    if (selectedFileId === fileId) { setSelectedFileId(null); setSelectedNodeIds([]); } 
    else { setSelectedFileId(fileId); setSelectedNodeIds(nodeIds); }
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      if (isMultiSelectMode) {
        toggleNodeCheck(nodeId);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
        setIsSelectMode(false);
        
        let currentSelected = [...selectedNodeIds];
        if (currentSelected.includes(nodeId)) {
          currentSelected = currentSelected.filter(id => id !== nodeId);
        } else {
          currentSelected.push(nodeId);
        }
        
        setSelectedNodeIds(currentSelected);
        setSelectedFileId(null);
        
        if (currentSelected.length === 1) {
          setFocusNodeId(currentSelected[0]);
        } else {
          setFocusNodeId(null);
        }
        return;
      }

      clearCanvasSelectionArea();
      if (selectedNodeIds.includes(nodeId) && selectedNodeIds.length === 1) {
        setSelectedNodeIds([]); setSelectedFileId(null);
      } else {
        setSelectedNodeIds([nodeId]); setSelectedFileId(null); setFocusNodeId(nodeId);
      }
  };

  const updateGlobalSetting = (key: keyof CloudSettings, value: string) => {
    saveHistory();
    setCloudSettings(prev => ({ ...prev, [key]: value }));
    markFilesAsModified();
  };

  const handleErrorClick = (err: any) => {
    if (err.targetNodeId) {
      setSelectedNodeIds([err.targetNodeId]);
      setSelectedFileId(null);
      setFocusNodeId(err.targetNodeId); 
    } else if (err.isGlobal) {
      setSelectedNodeIds([]);
    }
    
    if (err.isProjectTab) {
      setActiveTab('Project');
    } else {
      setActiveTab('Settings');
    }
    
    if (err.targetField) {
      setTimeout(() => {
        setHighlightedField(err.targetField);
        const el = document.getElementById(`field-${err.targetField}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        setTimeout(() => {
          setHighlightedField(null);
        }, 1500); 
      }, 150);
    }
  };

  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, padding: '8px', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '12px', color: '#2d3748', outline: 'none' };

  const renderComboInput = (key: keyof CloudSettings, options: {label: string, value: string}[], placeholder: string = '') => {
    const isOpen = openDropdownKey === key;
    const isHighlighted = highlightedField === key;
    return (
      <div style={{ position: 'relative', width: '100%' }} id={`field-${key}`}>
        <div className={`combo-input-wrapper ${isHighlighted ? 'highlight-flash' : ''}`} style={{ display: 'flex', border: '1px solid #cbd5e0', borderRadius: '6px', background: 'white', overflow: 'hidden', boxSizing: 'border-box' }}>
          <input
            type="text"
            className="custom-input"
            value={cloudSettings[key] || ''}
            placeholder={placeholder}
            onChange={e => updateGlobalSetting(key, e.target.value)}
            onFocus={() => { setOpenDropdownKey(key); saveHistory(); }}
            style={{ flex: 1, minWidth: 0, padding: '8px', border: 'none', outline: 'none', fontSize: '12px', color: '#2d3748', boxSizing: 'border-box' }}
          />
          <div
            onClick={(e) => { e.stopPropagation(); setOpenDropdownKey(isOpen ? null : key); }}
            style={{ width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', borderLeft: '1px solid #cbd5e0', cursor: 'pointer', color: '#4a5568', fontSize: '10px' }}
          >
            ▼
          </div>
        </div>
        {isOpen && (
          <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, marginTop: '4px', maxHeight: '180px', overflowY: 'auto' }}>
            {options.map(opt => (
              <div
                key={opt.value}
                onClick={(e) => { e.stopPropagation(); updateGlobalSetting(key, opt.value); setOpenDropdownKey(null); }}
                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #edf2f7' }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f0fdfc'}
                onMouseOut={(e) => e.currentTarget.style.background = 'white'}
              >
                <strong style={{ display: 'block', color: '#28b4ad', fontSize: '12px', marginBottom: '2px' }}>{opt.value}</strong>
                <span style={{ fontSize: '11px', color: '#718096' }}>{opt.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const awsRegions = [
    { value: 'ap-northeast-2', label: '아시아 태평양 (서울)' },
    { value: 'us-east-1', label: '미국 동부 (버지니아 북부)' },
    { value: 'ap-northeast-1', label: '아시아 태평양 (도쿄)' }
  ];
  const awsInstanceTypes = [
    { value: 't3.micro', label: '프리티어 지원 (2 vCPU, 1GiB)' },
    { value: 't3.small', label: '소규모 웹서버 (2 vCPU, 2GiB)' },
    { value: 't3.medium', label: '중소규모 DB (2 vCPU, 4GiB)' },
    { value: 'm5.large', label: '범용 인스턴스 (2 vCPU, 8GiB)' }
  ];
  const awsAmis = [
    { value: 'ami-084e92d3e117f7692', label: 'Amazon Linux 2023 AMI (Seoul)' },
    { value: 'ami-0c9c942bd7bf113a2', label: 'Ubuntu Server 22.04 LTS (Seoul)' }
  ];

  const ociRegions = [
    { value: 'ap-seoul-1', label: '대한민국 (서울)' },
    { value: 'ap-chuncheon-1', label: '대한민국 (춘천)' },
    { value: 'us-ashburn-1', label: '미국 동부 (애시번)' }
  ];
  const ociShapes = [
    { value: 'VM.Standard.E2.1.Micro', label: 'Always Free (1 OCPU, 1GB)' },
    { value: 'VM.Standard.A1.Flex', label: 'Ampere ARM (최대 4 OCPU, 24GB Free)' },
    { value: 'VM.Standard.E3.Flex', label: 'AMD Rome Flex Shape' }
  ];
  const ociADs = [
    { value: 'AD-1', label: '가용성 도메인 1' },
    { value: 'AD-2', label: '가용성 도메인 2' },
    { value: 'AD-3', label: '가용성 도메인 3' }
  ];

  const globalErrors = validationErrors.filter(e => e.isGlobal || !e.targetNodeId);
  const nodeErrorsMap = new Map<string, typeof validationErrors>();
  
  validationErrors.forEach(e => {
    if (!e.isGlobal && e.targetNodeId) {
      if (!nodeErrorsMap.has(e.targetNodeId)) nodeErrorsMap.set(e.targetNodeId, []);
      nodeErrorsMap.get(e.targetNodeId)!.push(e);
    }
  });

  const toggleErrorGroup = (groupId: string) => {
    setCollapsedErrorGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  return (
    <aside className="right-sidebar" onClick={handleBackgroundClick}>
      <style>{`
        .right-sidebar input::placeholder, .right-sidebar textarea::placeholder, .custom-input::placeholder {
          color: #a0aec0 !important;
          font-weight: 400 !important;
          opacity: 0.6 !important;
        }
        
        .highlight-flash {
          animation: flash-red 1.5s ease-out;
        }
        
        @keyframes flash-red {
          0% { box-shadow: 0 0 0 0px rgba(229, 62, 62, 0); border-color: #cbd5e0; }
          15% { box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.4); border-color: #e53e3e; background-color: #fff5f5; }
          80% { box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.4); border-color: #e53e3e; background-color: #fff5f5; }
          100% { box-shadow: 0 0 0 0px rgba(229, 62, 62, 0); border-color: #cbd5e0; background-color: white; }
        }

        .validation-content::-webkit-scrollbar { display: none; }
        .validation-content { -ms-overflow-style: none; scrollbar-width: none; }

        .error-group {
          margin-bottom: 8px;
          border: 1px solid #fbd5d5;
          border-radius: 8px;
          background: #fafafa;
          overflow: hidden;
        }
        .error-group-header {
          padding: 10px 12px;
          font-size: 13px;
          font-weight: bold;
          color: #9b2c2c;
          background: #fdf2f2;
          display: flex;
          align-items: center;
          cursor: pointer;
          user-select: none;
          transition: 0.2s;
        }
        .error-group-header:hover {
          background: #fce8e8;
        }
        .error-group-content {
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: white;
          border-top: 1px solid #fbd5d5;
        }
        .error-box {
          background-color: #fff5f5;
          border: 1px solid #fed7d7;
          border-radius: 6px;
          padding: 10px;
          transition: 0.2s;
        }
        .error-box:hover {
          background-color: #feebc8;
          border-color: #fbd38d;
        }
      `}</style>
      <div className="minimap-area" onClick={(e) => e.stopPropagation()}>
        <div className="minimap-window">
          {viewport.scrollWidth > 1 && (
            <>
              <svg className="minimap-svg">
                {edges.map(edge => {
                  const s = nodes.find(n => n.id === edge.sourceId);
                  const t = nodes.find(n => n.id === edge.targetId);
                  if (!s || !t) return null;
                  const x1 = ((s.x + 90) * zoomLevel / viewport.scrollWidth) * 100;
                  const y1 = ((s.y + 40) * zoomLevel / viewport.scrollHeight) * 100;
                  const x2 = ((t.x + 90) * zoomLevel / viewport.scrollWidth) * 100;
                  const y2 = ((t.y + 40) * zoomLevel / viewport.scrollHeight) * 100;
                  return <line key={edge.id} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke="#cbd5e0" strokeWidth="1.5" />;
                })}
              </svg>
              {nodes.map(node => (
                <div key={`mini-${node.id}`} className="minimap-node" style={{
                  left: `${((node.x * zoomLevel) / viewport.scrollWidth) * 100}%`,
                  top: `${((node.y * zoomLevel) / viewport.scrollHeight) * 100}%`,
                  width: `${(180 * zoomLevel / viewport.scrollWidth) * 100}%`,
                  height: `${(64 * zoomLevel / viewport.scrollHeight) * 100}%`,
                }} />
              ))}
              <div className="minimap-viewport-box" style={{
                left: `${(viewport.scrollLeft / viewport.scrollWidth) * 100}%`,
                top: `${(viewport.scrollTop / viewport.scrollHeight) * 100}%`,
                width: `${(viewport.clientWidth / viewport.scrollWidth) * 100}%`,
                height: `${(viewport.clientHeight / viewport.scrollHeight) * 100}%`,
              }} />
            </>
          )}
        </div>
      </div>

      {activeTab === 'Project' && (
        <div className="project-tree">
          <div className="tree-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            Project
            <button className="select-mode-btn" onClick={(e) => { 
              e.stopPropagation(); 
              const nextMode = !isMultiSelectMode;
              setIsMultiSelectMode(nextMode); setCheckedItems(new Set()); 
              if (nextMode) { setSelectedNodeIds([]); setSelectedFileId(null); clearCanvasSelectionArea(); }
            }}>✔</button>
          </div>
          <div className="tree-content">
            <div 
              id="field-target-file-box"
              className={`target-box ${isDragOverTarget ? 'drag-over' : ''} ${highlightedField === 'target-file-box' ? 'highlight-flash' : ''}`}
              onDragOver={handleDragOver} onDragEnter={() => setIsDragOverTarget(true)} onDragLeave={() => setIsDragOverTarget(false)} onDrop={handleDropFileToTarget}
              style={{ minHeight: isTargetBoxCollapsed ? '0' : '80px', padding: isTargetBoxCollapsed ? '8px 12px' : '10px' }}
            >
              <div className="target-box-title" onClick={(e) => { e.stopPropagation(); setIsTargetBoxCollapsed(!isTargetBoxCollapsed); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', userSelect: 'none' }}>
                <span className="toggle-icon" style={{ marginRight: '6px', fontSize: '10px' }}>{isTargetBoxCollapsed ? '▶' : '▼'}</span>
                생성할 파일 목록
              </div>
              
              {!isTargetBoxCollapsed && (
                <>
                  {targetFileIds.length === 0 && <div className="empty-info-zone">파일을 드래그하세요</div>}
                  {targetFileIds.map(id => {
                    const file = files.find(f => f.id === id);
                    if (!file) return null;
                    const isTargetFileCollapsed = collapsedTargetFiles.includes(file.id);

                    return (
                      <div key={`target-${file.id}`} className="target-file-item" draggable onDragStart={(e) => handleFileDragStart(e, file.id)} onDragEnd={(e) => handleFileDragEnd(e, file.id)}>
                        <div className="file-header">
                          <span className="toggle-icon" onClick={(e) => { e.stopPropagation(); toggleTargetExpand(e, file.id); }}>{isTargetFileCollapsed ? '▶' : '▼'}</span>
                          <div className="file-name">{file.name}</div>
                        </div>
                        {!isTargetFileCollapsed && (
                          <div className="file-children">
                            {file.nodeIds.map(nodeId => {
                              const node = nodes.find(n => n.id === nodeId);
                              return node ? <div key={`target-node-${node.id}`} className="tree-node-item readonly">● {node.name}</div> : null;
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div className="file-list-container">
              {files.map(file => (
                <div key={file.id} className={`file-box ${dragOverFileId === file.id ? 'drag-over' : ''} ${!file.isGenerated ? 'ungenerated' : ''} ${isMultiSelectMode ? (checkedItems.has(file.id) ? 'selected' : '') : (selectedFileId === file.id ? 'selected' : '')}`} draggable={editingFileId !== file.id} onDragStart={(e) => handleFileDragStart(e, file.id)} onDragOver={handleDragOver} onDragEnter={() => setDragOverFileId(file.id)} onDragLeave={() => setDragOverFileId(null)} onDrop={(e) => handleDropNodeToFile(e, file.id)}>
                  <div className="file-header" onClick={(e) => handleFileClick(e, file.id, file.nodeIds)}>
                    <span className="toggle-icon" onClick={(e) => { e.stopPropagation(); toggleMainExpand(e, file.id); }}>{file.isExpanded ? '▼' : '▶'}</span>
                    {editingFileId === file.id ? (
                      <input type="text" className="file-name-input custom-input" value={editingName} onChange={(e) => setEditingName(e.target.value)} onBlur={() => saveFileNameEdit(file.id)} onKeyDown={(e) => e.key === 'Enter' && saveFileNameEdit(file.id)} onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} autoFocus />
                    ) : (
                      <div className="file-name-editable" onDoubleClick={(e) => { e.stopPropagation(); if (isMultiSelectMode) return; setEditingFileId(file.id); setEditingName(file.name); }} title="더블클릭하여 파일명 수정">{file.name}</div>
                    )}
                  </div>

                  {file.isExpanded && (
                    <div className="file-children">
                      {file.nodeIds.map(nodeId => {
                        const node = nodes.find(n => n.id === nodeId);
                        if (!node) return null;
                        return (
                          <div key={node.id} className={`tree-node-item assigned ${isMultiSelectMode ? (checkedItems.has(node.id) ? 'selected' : '') : (selectedFileId === null && selectedNodeIds.includes(node.id) ? 'selected' : '')}`} draggable={true} onDragStart={(e) => handleNodeDragStart(e, node.id)} onClick={(e) => handleNodeClick(e, node.id)} style={{ display: 'flex', alignItems: 'center' }}>● {node.name}</div>
                        );
                      })}
                      {file.nodeIds.length === 0 && <div className="empty-drop-zone">노드를 드래그하세요</div>}
                    </div>
                  )}
                </div>
              ))}
              {!isMultiSelectMode && <button className="add-file-btn" onClick={(e) => { e.stopPropagation(); handleAddFile(); }}>+ 파일추가</button>}
            </div>

            <div className={`unassigned-box ${isDragOverUnassigned ? 'drag-over' : ''}`} onDragOver={handleDragOver} onDragEnter={() => setIsDragOverUnassigned(true)} onDragLeave={() => setIsDragOverUnassigned(false)} onDrop={handleDropToUnassigned}>
              <div className="unassigned-title" onClick={(e) => { e.stopPropagation(); setIsUnassignedCollapsed(!isUnassignedCollapsed); }}>
                <span className="toggle-icon" style={{ marginRight: '6px', fontSize: '10px' }}>{isUnassignedCollapsed ? '▶' : '▼'}</span>
                낱개로 배치된 Node
              </div>
              {!isUnassignedCollapsed && (
                <div className="unassigned-children">
                  {unassignedNodes.map((node) => (
                    <div key={node.id} className={`tree-node-item unassigned ${isMultiSelectMode ? (checkedItems.has(node.id) ? 'selected' : '') : (selectedFileId === null && selectedNodeIds.includes(node.id) ? 'selected' : '')}`} draggable={true} onDragStart={(e) => handleNodeDragStart(e, node.id)} onClick={(e) => handleNodeClick(e, node.id)} style={{ display: 'flex', alignItems: 'center' }}>● {node.name}</div>
                  ))}
                  {unassignedNodes.length === 0 && <div className="empty-info-zone">비배치 노드가 없습니다</div>}
                </div>
              )}
            </div>
          </div>
          
          {isMultiSelectMode && (
            <div className="right-panel-actions" onClick={e => e.stopPropagation()}>
              <button className="action-btn" onClick={cancelSelectionMode}>취소</button>
              <button className="action-btn" onClick={handleDeleteItems}>삭제</button>
              <button className="action-btn" onClick={handleDownloadItems}>다운로드</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Settings' && (
        <div className="settings-panel" onClick={e => e.stopPropagation()}>
          <div className="tree-title">Settings</div>
          <div className="settings-content">

            <div className="node-settings-section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', marginBottom: '20px' }}>
              <div className="setting-section-title">
                <span className="box-icon" style={{ fontSize: '12px', marginRight: '4px' }}>⚙️</span> 
                기본 배포 설정 (Local)
              </div>
              <div className="setting-row">
                <label>로컬 환경(Docker Compose, .env) 구성 생성</label>
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px', color: '#2d3748', fontWeight: 'normal' }}>
                    <input type="radio" name="localGen" checked={includeLocal} onChange={() => { saveHistory(); setIncludeLocal(true); markFilesAsModified(); }} />
                    생성함 (포함)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px', color: '#2d3748', fontWeight: 'normal' }}>
                    <input type="radio" name="localGen" checked={!includeLocal} onChange={() => { saveHistory(); setIncludeLocal(false); markFilesAsModified(); }} />
                    생성 안함
                  </label>
                </div>
              </div>
            </div>

            <div className="node-settings-section" style={{ marginBottom: '24px' }}>
              <div className="setting-section-title" style={{ color: cloudProvider === 'AWS' ? '#dd6b20' : '#c53030' }}>
                <span className="box-icon" style={{ fontSize: '10px', marginRight: '4px' }}></span>
                {cloudProvider} 글로벌 배포 설정 (IaC)
              </div>

              {cloudProvider === 'AWS' ? (
                <>
                  <div className="setting-row">
                    <label>Region <span style={{color:'red'}}>*</span></label>
                    {renderComboInput('region', awsRegions, 'ap-northeast-2')}
                  </div>
                  <div className="setting-row">
                    <label>VPC Name <span style={{color:'red'}}>*</span></label>
                    <input id="field-vpcName" type="text" className={`custom-input ${highlightedField === 'vpcName' ? 'highlight-flash' : ''}`} value={cloudSettings.vpcName} placeholder="my-vpc" style={inputStyle} onChange={e => updateGlobalSetting('vpcName', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>VPC CIDR</label>
                    <input id="field-vpcCidr" type="text" className="custom-input" value={cloudSettings.vpcCidr} placeholder="10.0.0.0/16" style={inputStyle} onChange={e => updateGlobalSetting('vpcCidr', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Subnet Name <span style={{color:'red'}}>*</span></label>
                    <input id="field-subnetName" type="text" className={`custom-input ${highlightedField === 'subnetName' ? 'highlight-flash' : ''}`} value={cloudSettings.subnetName} placeholder="my-subnet" style={inputStyle} onChange={e => updateGlobalSetting('subnetName', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Subnet CIDR</label>
                    <input id="field-subnetCidr" type="text" className="custom-input" value={cloudSettings.subnetCidr} placeholder="10.0.1.0/24" style={inputStyle} onChange={e => updateGlobalSetting('subnetCidr', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Internet Gateway Name <span style={{color:'red'}}>*</span></label>
                    <input id="field-internetGatewayName" type="text" className={`custom-input ${highlightedField === 'internetGatewayName' ? 'highlight-flash' : ''}`} value={cloudSettings.internetGatewayName} placeholder="my-igw" style={inputStyle} onChange={e => updateGlobalSetting('internetGatewayName', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Route Table Name <span style={{color:'red'}}>*</span></label>
                    <input id="field-routeTableName" type="text" className={`custom-input ${highlightedField === 'routeTableName' ? 'highlight-flash' : ''}`} value={cloudSettings.routeTableName} placeholder="my-rt" style={inputStyle} onChange={e => updateGlobalSetting('routeTableName', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Security Group Name <span style={{color:'red'}}>*</span></label>
                    <input id="field-securityGroupName" type="text" className={`custom-input ${highlightedField === 'securityGroupName' ? 'highlight-flash' : ''}`} value={cloudSettings.securityGroupName} placeholder="my-sg" style={inputStyle} onChange={e => updateGlobalSetting('securityGroupName', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Instance Name <span style={{color:'red'}}>*</span></label>
                    <input id="field-instanceName" type="text" className={`custom-input ${highlightedField === 'instanceName' ? 'highlight-flash' : ''}`} value={cloudSettings.instanceName} placeholder="my-instance" style={inputStyle} onChange={e => updateGlobalSetting('instanceName', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Instance Type</label>
                    {renderComboInput('instanceType', awsInstanceTypes, 't3.micro')}
                  </div>
                  <div className="setting-row">
                    <label>AMI ID <span style={{color:'red'}}>*</span></label>
                    {renderComboInput('amiId', awsAmis, 'ami-084e92d3e117f7692')}
                  </div>
                  <div className="setting-row">
                    <label>Admin CIDR <span style={{color:'red'}}>*</span></label>
                    <input id="field-adminCidr" type="text" className={`custom-input ${highlightedField === 'adminCidr' ? 'highlight-flash' : ''}`} value={cloudSettings.adminCidr} placeholder="0.0.0.0/0" style={inputStyle} onChange={e => updateGlobalSetting('adminCidr', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>App CIDR <span style={{color:'red'}}>*</span></label>
                    <input id="field-appCidr" type="text" className={`custom-input ${highlightedField === 'appCidr' ? 'highlight-flash' : ''}`} value={cloudSettings.appCidr} placeholder="0.0.0.0/0" style={inputStyle} onChange={e => updateGlobalSetting('appCidr', e.target.value)} />
                  </div>
                </>
              ) : (
                <>
                  <div className="setting-row">
                    <label>Region <span style={{color:'red'}}>*</span></label>
                    {renderComboInput('region', ociRegions, 'ap-seoul-1')}
                  </div>
                  <div className="setting-row">
                    <label>Compartment ID <span style={{color:'red'}}>*</span></label>
                    <input id="field-compartmentId" type="text" className={`custom-input ${highlightedField === 'compartmentId' ? 'highlight-flash' : ''}`} value={cloudSettings.compartmentId || ''} placeholder="ocid1.compartment..." style={inputStyle} onChange={e => updateGlobalSetting('compartmentId', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>VCN Name <span style={{color:'red'}}>*</span></label>
                    <input id="field-vpcName" type="text" className={`custom-input ${highlightedField === 'vpcName' ? 'highlight-flash' : ''}`} value={cloudSettings.vpcName} placeholder="my-vcn" style={inputStyle} onChange={e => updateGlobalSetting('vpcName', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>VCN CIDR</label>
                    <input id="field-vpcCidr" type="text" className="custom-input" value={cloudSettings.vpcCidr} placeholder="10.0.0.0/16" style={inputStyle} onChange={e => updateGlobalSetting('vpcCidr', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Subnet Name <span style={{color:'red'}}>*</span></label>
                    <input id="field-subnetName" type="text" className={`custom-input ${highlightedField === 'subnetName' ? 'highlight-flash' : ''}`} value={cloudSettings.subnetName} placeholder="my-subnet" style={inputStyle} onChange={e => updateGlobalSetting('subnetName', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Subnet CIDR</label>
                    <input id="field-subnetCidr" type="text" className="custom-input" value={cloudSettings.subnetCidr} placeholder="10.0.1.0/24" style={inputStyle} onChange={e => updateGlobalSetting('subnetCidr', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Internet Gateway Name <span style={{color:'red'}}>*</span></label>
                    <input id="field-internetGatewayName" type="text" className={`custom-input ${highlightedField === 'internetGatewayName' ? 'highlight-flash' : ''}`} value={cloudSettings.internetGatewayName} placeholder="my-igw" style={inputStyle} onChange={e => updateGlobalSetting('internetGatewayName', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Route Table Name <span style={{color:'red'}}>*</span></label>
                    <input id="field-routeTableName" type="text" className={`custom-input ${highlightedField === 'routeTableName' ? 'highlight-flash' : ''}`} value={cloudSettings.routeTableName} placeholder="my-rt" style={inputStyle} onChange={e => updateGlobalSetting('routeTableName', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Security List Name <span style={{color:'red'}}>*</span></label>
                    <input id="field-securityGroupName" type="text" className={`custom-input ${highlightedField === 'securityGroupName' ? 'highlight-flash' : ''}`} value={cloudSettings.securityGroupName} placeholder="my-sl" style={inputStyle} onChange={e => updateGlobalSetting('securityGroupName', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Instance Name <span style={{color:'red'}}>*</span></label>
                    <input id="field-instanceName" type="text" className={`custom-input ${highlightedField === 'instanceName' ? 'highlight-flash' : ''}`} value={cloudSettings.instanceName} placeholder="my-instance" style={inputStyle} onChange={e => updateGlobalSetting('instanceName', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Hostname Label <span style={{color:'red'}}>*</span></label>
                    <input id="field-hostnameLabel" type="text" className={`custom-input ${highlightedField === 'hostnameLabel' ? 'highlight-flash' : ''}`} value={cloudSettings.hostnameLabel || ''} placeholder="myhost" style={inputStyle} onChange={e => updateGlobalSetting('hostnameLabel', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Availability Domain <span style={{color:'red'}}>*</span></label>
                    {renderComboInput('availabilityDomain', ociADs, 'AD-1')}
                  </div>
                  <div className="setting-row">
                    <label>Shape</label>
                    {renderComboInput('instanceType', ociShapes, 'VM.Standard.E2.1.Micro')}
                  </div>
                  <div className="setting-row">
                    <label>Image ID <span style={{color:'red'}}>*</span></label>
                    <input id="field-amiId" type="text" className={`custom-input ${highlightedField === 'amiId' ? 'highlight-flash' : ''}`} value={cloudSettings.amiId} placeholder="ocid1.image..." style={inputStyle} onChange={e => updateGlobalSetting('amiId', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>Admin CIDR <span style={{color:'red'}}>*</span></label>
                    <input id="field-adminCidr" type="text" className={`custom-input ${highlightedField === 'adminCidr' ? 'highlight-flash' : ''}`} value={cloudSettings.adminCidr} placeholder="0.0.0.0/0" style={inputStyle} onChange={e => updateGlobalSetting('adminCidr', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>App CIDR <span style={{color:'red'}}>*</span></label>
                    <input id="field-appCidr" type="text" className={`custom-input ${highlightedField === 'appCidr' ? 'highlight-flash' : ''}`} value={cloudSettings.appCidr} placeholder="0.0.0.0/0" style={inputStyle} onChange={e => updateGlobalSetting('appCidr', e.target.value)} />
                  </div>
                  <div className="setting-row">
                    <label>SSH Authorized Keys <span style={{color:'red'}}>*</span></label>
                    <input id="field-sshAuthorizedKeys" type="text" className={`custom-input ${highlightedField === 'sshAuthorizedKeys' ? 'highlight-flash' : ''}`} value={cloudSettings.sshAuthorizedKeys || ''} placeholder="ssh-rsa AAA..." style={inputStyle} onChange={e => updateGlobalSetting('sshAuthorizedKeys', e.target.value)} />
                  </div>
                </>
              )}
            </div>

            {selectedNodeIds.length === 1 ? (
              (() => {
                const selectedNode = nodes.find(n => n.id === selectedNodeIds[0]);
                if (!selectedNode) return null;
                const settings = (selectedNode as any).settings || {};
                
                const updateSetting = (key: string, value: string) => {
                  setNodes(prev => prev.map(n => 
                    n.id === selectedNode.id ? { ...n, settings: { ...((n as any).settings || {}), [key]: value } } : n
                  ));
                  markFilesAsModified();
                };

                return (
                  <div className="node-settings-section">
                    <div className="setting-section-title">
                      <span className="box-icon" style={{ fontSize: '12px', marginRight: '4px' }}>●</span> 
                      {selectedNode.type} 노드 세부 설정
                    </div>
                    
                    <div className="setting-row">
                      <label>노드 이름 (화면 표시용)</label>
                      <input id="field-name" type="text" className={`custom-input ${highlightedField === 'name' ? 'highlight-flash' : ''}`} value={selectedNode.name} 
                        onChange={(e) => {
                          setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, name: e.target.value } : n));
                          markFilesAsModified();
                        }}
                        onFocus={saveHistory} style={inputStyle}
                      />
                    </div>

                    {selectedNode.type === 'MySQL' ? (
                      <>
                        <div className="setting-row">
                          <label>서비스 이름 (name) <span style={{color:'red'}}>*</span></label>
                          <input id="field-name" type="text" className={`custom-input ${highlightedField === 'name' ? 'highlight-flash' : ''}`} value={settings.name || ''} placeholder="mysql_service" onChange={(e) => updateSetting('name', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                        <div className="setting-row">
                          <label>도커 이미지 버전 <span style={{color:'red'}}>*</span></label>
                          <select id="field-imageVersion" className={`custom-input ${highlightedField === 'imageVersion' ? 'highlight-flash' : ''}`} value={settings.imageVersion || ''} onChange={(e) => updateSetting('imageVersion', e.target.value)} onFocus={saveHistory} style={inputStyle}>
                            <option value="" disabled>버전을 선택하세요</option>
                            <option value="mysql:latest">mysql : latest</option>
                            <option value="mysql:8.4">mysql : 8.4</option>
                            <option value="mysql:8.0">mysql : 8.0</option>
                            <option value="mysql:5.7">mysql : 5.7</option>
                          </select>
                        </div>
                        <div className="setting-row">
                          <label>컨테이너 이름 (containerName) <span style={{color:'red'}}>*</span></label>
                          <input id="field-containerName" type="text" className={`custom-input ${highlightedField === 'containerName' ? 'highlight-flash' : ''}`} value={settings.containerName || ''} placeholder="mysql_container" onChange={(e) => updateSetting('containerName', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                        <div className="setting-row">
                          <label>포트 번호 (port) <span style={{color:'red'}}>*</span></label>
                          <input id="field-port" type="text" className={`custom-input ${highlightedField === 'port' ? 'highlight-flash' : ''}`} value={settings.port !== undefined ? settings.port : ''} placeholder="기본값: 3306" onChange={(e) => updateSetting('port', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                        <div className="setting-row">
                          <label>볼륨 이름 (volumeName)</label>
                          <input id="field-volumeName" type="text" className="custom-input" value={settings.volumeName || ''} placeholder="volume" onChange={(e) => updateSetting('volumeName', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>

                        <div className="setting-section-title" style={{ marginTop: '24px', marginBottom: '12px', fontSize: '12px', color: '#e53e3e' }}>
                          <span className="box-icon" style={{ fontSize: '10px', marginRight: '4px' }}>🔒</span> 
                          데이터베이스 설정 (env)
                        </div>
                        <div className="setting-row">
                          <label>데이터베이스 이름 (databaseName) <span style={{color:'red'}}>*</span></label>
                          <input id="field-databaseName" type="text" className={`custom-input ${highlightedField === 'databaseName' ? 'highlight-flash' : ''}`} value={settings.databaseName || ''} placeholder="appdb" onChange={(e) => updateSetting('databaseName', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                        <div className="setting-row">
                          <label>사용자 이름 (username) <span style={{color:'red'}}>*</span></label>
                          <input id="field-username" type="text" className={`custom-input ${highlightedField === 'username' ? 'highlight-flash' : ''}`} value={settings.username || ''} placeholder="dbuser" onChange={(e) => updateSetting('username', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                        <div className="setting-row">
                          <label>사용자 비밀번호 (userPassword) <span style={{color:'red'}}>*</span></label>
                          <input id="field-userPassword" type="password" className={`custom-input ${highlightedField === 'userPassword' ? 'highlight-flash' : ''}`} value={settings.userPassword || ''} placeholder="user password" onChange={(e) => updateSetting('userPassword', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                        <div className="setting-row">
                          <label>루트 비밀번호 (rootPassword) <span style={{color:'red'}}>*</span></label>
                          <input id="field-rootPassword" type="password" className={`custom-input ${highlightedField === 'rootPassword' ? 'highlight-flash' : ''}`} value={settings.rootPassword || ''} placeholder="root password" onChange={(e) => updateSetting('rootPassword', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                      </>
                    ) : selectedNode.type === 'Redis' ? (
                      <>
                        <div className="setting-row">
                          <label>서비스 이름 (name) <span style={{color:'red'}}>*</span></label>
                          <input id="field-name" type="text" className={`custom-input ${highlightedField === 'name' ? 'highlight-flash' : ''}`} value={settings.name || ''} placeholder="redis_service" onChange={(e) => updateSetting('name', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                        <div className="setting-row">
                          <label>도커 이미지 버전 <span style={{color:'red'}}>*</span></label>
                          <select id="field-imageVersion" className={`custom-input ${highlightedField === 'imageVersion' ? 'highlight-flash' : ''}`} value={settings.imageVersion || ''} onChange={(e) => updateSetting('imageVersion', e.target.value)} onFocus={saveHistory} style={inputStyle}>
                            <option value="" disabled>버전을 선택하세요</option>
                            <option value="redis:latest">redis : latest</option>
                            <option value="redis:7.0">redis : 7.0</option>
                            <option value="redis:6.2">redis : 6.2</option>
                          </select>
                        </div>
                        <div className="setting-row">
                          <label>컨테이너 이름 (containerName) <span style={{color:'red'}}>*</span></label>
                          <input id="field-containerName" type="text" className={`custom-input ${highlightedField === 'containerName' ? 'highlight-flash' : ''}`} value={settings.containerName || ''} placeholder="redis_container" onChange={(e) => updateSetting('containerName', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                        <div className="setting-row">
                          <label>포트 번호 (port) <span style={{color:'red'}}>*</span></label>
                          <input id="field-port" type="text" className={`custom-input ${highlightedField === 'port' ? 'highlight-flash' : ''}`} value={settings.port !== undefined ? settings.port : ''} placeholder="기본값: 6379" onChange={(e) => updateSetting('port', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                        <div className="setting-row">
                          <label>비밀번호 (password) <span style={{color:'red'}}>*</span></label>
                          <input id="field-password" type="password" className={`custom-input ${highlightedField === 'password' ? 'highlight-flash' : ''}`} value={settings.password || ''} placeholder="redis password" onChange={(e) => updateSetting('password', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                      </>
                    ) : selectedNode.type === 'Spring Boot' ? (
                      <>
                        <div className="setting-row">
                          <label>서비스 이름 (name) <span style={{color:'red'}}>*</span></label>
                          <input id="field-name" type="text" className={`custom-input ${highlightedField === 'name' ? 'highlight-flash' : ''}`} value={settings.name || ''} placeholder="spring_service" onChange={(e) => updateSetting('name', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                        <div className="setting-row">
                          <label>Java 버전 <span style={{color:'red'}}>*</span></label>
                          <select id="field-javaVersion" className={`custom-input ${highlightedField === 'javaVersion' ? 'highlight-flash' : ''}`} value={settings.javaVersion || ''} onChange={(e) => updateSetting('javaVersion', e.target.value)} onFocus={saveHistory} style={inputStyle}>
                            <option value="" disabled>버전 선택</option>
                            <option value="11">Java 11</option>
                            <option value="17">Java 17</option>
                            <option value="21">Java 21</option>
                          </select>
                        </div>
                        <div className="setting-row">
                          <label>컨테이너 이름 (containerName) <span style={{color:'red'}}>*</span></label>
                          <input id="field-containerName" type="text" className={`custom-input ${highlightedField === 'containerName' ? 'highlight-flash' : ''}`} value={settings.containerName || ''} placeholder="spring_container" onChange={(e) => updateSetting('containerName', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                        <div className="setting-row">
                          <label>포트 번호 (port) <span style={{color:'red'}}>*</span></label>
                          <input id="field-port" type="text" className={`custom-input ${highlightedField === 'port' ? 'highlight-flash' : ''}`} value={settings.port !== undefined ? settings.port : ''} placeholder="기본값: 8080" onChange={(e) => updateSetting('port', e.target.value)} onFocus={saveHistory} style={inputStyle} />
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })()
            ) : (
              <div className="empty-info-zone" style={{ marginTop: '40px', lineHeight: '1.5' }}>
                캔버스에서 노드를 1개 선택하시면<br />해당 노드의 세부 설정을 변경할 수 있습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Validation' && (
        <div className="validation-panel" onClick={e => e.stopPropagation()}>
          <div className="validation-header-title">Error</div>
          <div className="validation-content">
            {validationErrors.length > 0 ? (
              <div className="error-list">
                {globalErrors.length > 0 && (
                  <div className="error-group">
                    <div className="error-group-header" onClick={() => toggleErrorGroup('global')}>
                      <span className="toggle-icon" style={{ marginRight: '8px', fontSize: '10px', color: '#9b2c2c' }}>
                        {collapsedErrorGroups.includes('global') ? '▶' : '▼'}
                      </span>
                      프로젝트 & 클라우드 설정
                    </div>
                    {!collapsedErrorGroups.includes('global') && (
                      <div className="error-group-content">
                        {globalErrors.map((err, idx) => (
                          <div key={idx} className="error-box" onClick={() => handleErrorClick(err)} style={{ cursor: 'pointer' }}>
                            <div className="error-header">
                              <div className="error-icon-circle">X</div>
                              <span className="error-name">{err.name}</span>
                            </div>
                            <div className="error-desc">{err.desc}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {Array.from(nodeErrorsMap.entries()).map(([nodeId, errs]) => {
                  const nodeName = nodes.find(n => n.id === nodeId)?.name || '알 수 없는 노드';
                  const isCollapsed = collapsedErrorGroups.includes(nodeId);
                  
                  return (
                    <div key={nodeId} className="error-group">
                      <div className="error-group-header" onClick={() => toggleErrorGroup(nodeId)}>
                        <span className="toggle-icon" style={{ marginRight: '8px', fontSize: '10px', color: '#9b2c2c' }}>
                          {isCollapsed ? '▶' : '▼'}
                        </span>
                        {nodeName} (노드)
                      </div>
                      {!isCollapsed && (
                        <div className="error-group-content">
                          {errs.map((err, idx) => (
                            <div key={idx} className="error-box" onClick={() => handleErrorClick(err)} style={{ cursor: 'pointer' }}>
                              <div className="error-header">
                                <div className="error-icon-circle">X</div>
                                <span className="error-name">{err.name}</span>
                              </div>
                              <div className="error-desc">{err.desc}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="success-container">
                <div className="success-icon-circle">✓</div>
                <div className="success-text">검사 완료</div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

export default RightSideBar;