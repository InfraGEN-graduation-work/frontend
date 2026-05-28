import React, { useState, useRef, useEffect } from 'react';
import type { NodeData, FileGroup, Edge, SelectionArea } from '../types';
import type { ViewportState } from '../MainPage';

interface RightSideBarProps {
  nodes: NodeData[];
  setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
  edges: Edge[];
  activeTab: 'Project' | 'Settings' | 'Validation';
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
  validationErrors: { name: string; desc: string }[];
  resetTrigger: number;
  setSelection: React.Dispatch<React.SetStateAction<SelectionArea>>; 
  setIsSelectMode: React.Dispatch<React.SetStateAction<boolean>>; 
}

const RightSideBar: React.FC<RightSideBarProps> = ({ 
  nodes, setNodes, edges, activeTab, saveHistory, files, setFiles, targetFileIds, setTargetFileIds, markFilesAsModified, deleteRightPanelItems,
  selectedFileId, setSelectedFileId, setSelectedNodeIds, selectedNodeIds, viewport, zoomLevel, setFocusNodeId, validationErrors, resetTrigger,
  setSelection, setIsSelectMode 
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
    }
  }, [resetTrigger]);

  const wasDroppedInTarget = useRef(false);

  const unassignedNodes = nodes.filter(
    (canvasNode) => !files.some((file) => file.nodeIds.includes(canvasNode.id))
  );

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleNodeDragStart = (e: React.DragEvent, nodeId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('rightBarNodeId', nodeId);
  };

  const handleFileDragStart = (e: React.DragEvent, fileId: string) => {
    if (editingFileId === fileId) return; 
    e.stopPropagation();
    e.dataTransfer.setData('rightBarFileId', fileId);
    wasDroppedInTarget.current = false;
  };

  const handleFileDragEnd = (e: React.DragEvent, fileId: string) => {
    if (!wasDroppedInTarget.current) {
      saveHistory();
      setTargetFileIds((prev) => prev.filter(id => id !== fileId));
    }
    wasDroppedInTarget.current = false;
  };

  const handleDropNodeToFile = (e: React.DragEvent, fileId: string) => {
    e.preventDefault();
    setDragOverFileId(null);
    const nodeId = e.dataTransfer.getData('rightBarNodeId');
    if (!nodeId) return;

    saveHistory();
    markFilesAsModified();
    setFiles((prev) => prev.map((f) => {
      const filteredNodeIds = f.nodeIds.filter(id => id !== nodeId);
      if (f.id === fileId) filteredNodeIds.push(nodeId);
      return { ...f, nodeIds: filteredNodeIds };
    }));
  };

  const handleDropToUnassigned = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverUnassigned(false);
    const nodeId = e.dataTransfer.getData('rightBarNodeId');
    if (!nodeId) return;

    saveHistory();
    markFilesAsModified();
    setFiles((prev) => prev.map((f) => ({ ...f, nodeIds: f.nodeIds.filter(id => id !== nodeId) })));
  };

  const handleDropFileToTarget = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTarget(false);
    const fileId = e.dataTransfer.getData('rightBarFileId');
    if (!fileId) return;

    wasDroppedInTarget.current = true;

    if (targetFileIds.includes(fileId)) {
      if (window.confirm('이미 존재하는 파일입니다. 최신 상태로 덮어쓰시겠습니까?')) {
        saveHistory();
      }
    } else {
      saveHistory();
      setTargetFileIds((prev) => [...prev, fileId]);
    }
  };

  const handleAddFile = () => {
    saveHistory();
    const newId = `file-${Date.now()}`;
    const newFile: FileGroup = {
      id: newId,
      name: '', 
      isGenerated: false, 
      nodeIds: [],
      isExpanded: true
    };
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
    setCollapsedTargetFiles(prev => 
      prev.includes(id) ? prev.filter(fileId => fileId !== id) : [...prev, id]
    );
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
    if (newChecked.has(nodeId)) {
      newChecked.delete(nodeId);
    } else {
      newChecked.add(nodeId);
    }
    setCheckedItems(newChecked);
  };

  const handleDeleteItems = () => {
    const fileIdsToDelete = files.map(f => f.id).filter(id => checkedItems.has(id));
    const nodeIdsToDelete = nodes.map(n => n.id).filter(id => checkedItems.has(id));
    deleteRightPanelItems(fileIdsToDelete, nodeIdsToDelete);
    setCheckedItems(new Set());
    setIsMultiSelectMode(false);
  };

  // txt
  const handleDownloadItems = () => {
    const selectedFiles = files.filter(f => checkedItems.has(f.id));
    const generatedFiles = selectedFiles.filter(f => f.isGenerated);

    if (generatedFiles.length > 0) {
      generatedFiles.forEach(file => {
        const codeContent = `# ${file.name}
생성된 코드를 서버에서 불러와서 저장해야 함`;
        const blob = new Blob([codeContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${file.name || 'generated_code'}.txt`; // 파일명.txt 로 지정
        
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
    } else {
      alert("다운로드 할 수 없습니다.");
    }
  };

  const cancelSelectionMode = () => {
    setIsMultiSelectMode(false);
    setCheckedItems(new Set());
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (isMultiSelectMode) return;
    clearCanvasSelectionArea();
    setSelectedNodeIds([]);
    setSelectedFileId(null);
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      if (isMultiSelectMode) return;
      clearCanvasSelectionArea();
      
      if (selectedNodeIds.includes(nodeId) && selectedNodeIds.length === 1) {
        setSelectedNodeIds([]);
        setSelectedFileId(null);
      } else {
        setSelectedNodeIds([nodeId]);
        setSelectedFileId(null);
        setFocusNodeId(nodeId);
      }
  };

  const handleFileClick = (e: React.MouseEvent, fileId: string, nodeIds: string[]) => {
    e.stopPropagation();
    if (isMultiSelectMode) return;
    clearCanvasSelectionArea();
    
    if (selectedFileId === fileId) {
      setSelectedFileId(null);
      setSelectedNodeIds([]);
    } else {
      setSelectedFileId(fileId);
      setSelectedNodeIds(nodeIds);
    }
  };

  return (
    <aside className="right-sidebar" onClick={handleBackgroundClick}>
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
            <button className="select-mode-btn" onClick={(e) => { e.stopPropagation(); setIsMultiSelectMode(!isMultiSelectMode); }}>
              ✔
            </button>
          </div>
          <div className="tree-content">
            
            <div 
              className={`target-box ${isDragOverTarget ? 'drag-over' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={() => setIsDragOverTarget(true)}
              onDragLeave={() => setIsDragOverTarget(false)}
              onDrop={handleDropFileToTarget}
              style={{
                minHeight: isTargetBoxCollapsed ? '0' : '80px',
                padding: isTargetBoxCollapsed ? '8px 12px' : '10px'
              }}
            >
              <div 
                className="target-box-title"
                onClick={(e) => { e.stopPropagation(); setIsTargetBoxCollapsed(!isTargetBoxCollapsed); }}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', userSelect: 'none' }}
              >
                <span className="toggle-icon" style={{ marginRight: '6px', fontSize: '10px' }}>
                  {isTargetBoxCollapsed ? '▶' : '▼'}
                </span>
                생성할 코드
              </div>
              
              {!isTargetBoxCollapsed && (
                <>
                  {targetFileIds.length === 0 && <div className="empty-info-zone">파일을 드래그하세요</div>}
                  {targetFileIds.map(id => {
                    const file = files.find(f => f.id === id);
                    if (!file) return null;
                    const isTargetFileCollapsed = collapsedTargetFiles.includes(file.id);

                    return (
                      <div 
                        key={`target-${file.id}`} 
                        className="target-file-item"
                        draggable
                        onDragStart={(e) => handleFileDragStart(e, file.id)}
                        onDragEnd={(e) => handleFileDragEnd(e, file.id)}
                      >
                        <div className="file-header">
                          <span className="toggle-icon" onClick={(e) => { e.stopPropagation(); toggleTargetExpand(e, file.id); }}>
                            {isTargetFileCollapsed ? '▶' : '▼'}
                          </span>
                          <div className="file-name">{file.name}</div>
                        </div>
                        {!isTargetFileCollapsed && (
                          <div className="file-children">
                            {file.nodeIds.map(nodeId => {
                              const node = nodes.find(n => n.id === nodeId);
                              return node ? (
                                <div key={`target-node-${node.id}`} className="tree-node-item readonly">
                                  ● {node.name}
                                </div>
                              ) : null;
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
                <div 
                  key={file.id}
                  className={`file-box ${dragOverFileId === file.id ? 'drag-over' : ''} ${!file.isGenerated ? 'ungenerated' : ''} ${selectedFileId === file.id ? 'selected' : ''}`}
                  draggable={editingFileId !== file.id && !isMultiSelectMode}
                  onDragStart={(e) => handleFileDragStart(e, file.id)}
                  onDragOver={handleDragOver}
                  onDragEnter={() => setDragOverFileId(file.id)}
                  onDragLeave={() => setDragOverFileId(null)}
                  onDrop={(e) => handleDropNodeToFile(e, file.id)}
                >
                  <div 
                    className="file-header" 
                    onClick={(e) => handleFileClick(e, file.id, file.nodeIds)}
                  >
                    {isMultiSelectMode && (
                      <input 
                        type="checkbox" 
                        className="multi-select-checkbox" 
                        checked={checkedItems.has(file.id)} 
                        onChange={() => toggleFileCheck(file.id, file.nodeIds)} 
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <span className="toggle-icon" onClick={(e) => { e.stopPropagation(); toggleMainExpand(e, file.id); }}>
                      {file.isExpanded ? '▼' : '▶'}
                    </span>
                    
                    {editingFileId === file.id ? (
                      <input 
                        type="text" 
                        className="file-name-input"
                        value={editingName} 
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => saveFileNameEdit(file.id)}
                        onKeyDown={(e) => e.key === 'Enter' && saveFileNameEdit(file.id)}
                        onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="file-name-editable"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (isMultiSelectMode) return;
                          setEditingFileId(file.id);
                          setEditingName(file.name);
                        }}
                        title="더블클릭하여 파일명 수정"
                      >
                        {file.name}
                      </div>
                    )}
                  </div>

                  {file.isExpanded && (
                    <div className="file-children">
                      {file.nodeIds.map(nodeId => {
                        const node = nodes.find(n => n.id === nodeId);
                        if (!node) return null;
                        return (
                          <div key={node.id} 
                               className={`tree-node-item assigned ${selectedFileId === null && selectedNodeIds.includes(node.id) ? 'selected' : ''}`}
                               draggable={!isMultiSelectMode} 
                               onDragStart={(e) => handleNodeDragStart(e, node.id)}
                               onClick={(e) => handleNodeClick(e, node.id)}
                               style={{ display: 'flex', alignItems: 'center' }}>
                            {isMultiSelectMode && (
                              <input 
                                type="checkbox" 
                                className="multi-select-checkbox" 
                                checked={checkedItems.has(node.id)} 
                                onChange={() => toggleNodeCheck(node.id)} 
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            ● {node.name}
                          </div>
                        );
                      })}
                      {file.nodeIds.length === 0 && <div className="empty-drop-zone">노드를 드래그하세요</div>}
                    </div>
                  )}
                </div>
              ))}

              {!isMultiSelectMode && <button className="add-file-btn" onClick={(e) => { e.stopPropagation(); handleAddFile(); }}>+ 파일추가</button>}
            </div>

            <div 
              className={`unassigned-box ${isDragOverUnassigned ? 'drag-over' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={() => setIsDragOverUnassigned(true)}
              onDragLeave={() => setIsDragOverUnassigned(false)}
              onDrop={handleDropToUnassigned}
            >
              <div 
                className="unassigned-title"
                onClick={(e) => { e.stopPropagation(); setIsUnassignedCollapsed(!isUnassignedCollapsed); }}
              >
                <span className="toggle-icon" style={{ marginRight: '6px', fontSize: '10px' }}>
                  {isUnassignedCollapsed ? '▶' : '▼'}
                </span>
                낱개로 배치된 Node
              </div>
              {!isUnassignedCollapsed && (
                <div className="unassigned-children">
                  {unassignedNodes.map((node) => (
                    <div key={node.id} 
                         className={`tree-node-item unassigned ${selectedFileId === null && selectedNodeIds.includes(node.id) ? 'selected' : ''}`} 
                         draggable={!isMultiSelectMode} 
                         onDragStart={(e) => handleNodeDragStart(e, node.id)}
                         onClick={(e) => handleNodeClick(e, node.id)}
                         style={{ display: 'flex', alignItems: 'center' }}>
                      {isMultiSelectMode && (
                        <input 
                          type="checkbox" 
                          className="multi-select-checkbox" 
                          checked={checkedItems.has(node.id)} 
                          onChange={() => toggleNodeCheck(node.id)} 
                        />
                      )}
                      ● {node.name}
                    </div>
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
            <div className="setting-row">
              <label>프로젝트 경로</label>
              <input type="text" defaultValue="/root/workspace" onChange={markFilesAsModified} />
            </div>

            {selectedNodeIds.length === 1 ? (
              (() => {
                const selectedNode = nodes.find(n => n.id === selectedNodeIds[0]);
                if (!selectedNode) return null;
                
                return (
                  <div className="node-settings-section">
                    <div className="setting-section-title">
                      <span className="box-icon" style={{ fontSize: '12px', marginRight: '4px' }}>●</span> 
                      {selectedNode.type} 노드 설정
                    </div>
                    
                    <div className="setting-row">
                      <label>노드 이름</label>
                      <input 
                        type="text" 
                        value={selectedNode.name} 
                        onChange={(e) => {
                          setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, name: e.target.value } : n));
                          markFilesAsModified();
                        }}
                        onFocus={saveHistory}
                      />
                    </div>
                    
                    <div className="setting-row">
                      <label>설명 (임시로)</label>
                      <input type="text" placeholder="이 노드에 대한 설명을 입력하세요" onChange={markFilesAsModified} />
                    </div>

                    <div className="setting-row">
                      <label>포트 매핑 (배치한)</label>
                      <input type="text" placeholder="e.g. 8080:8080" onChange={markFilesAsModified} />
                    </div>

                    <div className="setting-row">
                      <label>환경 변수 (수정툴)</label>
                      <textarea rows={3} placeholder="NODE_ENV=production&#10;PORT=8080" onChange={markFilesAsModified} />
                    </div>
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
                {validationErrors.map((err, idx) => (
                  <div key={idx} className="error-box">
                    <div className="error-header">
                      <div className="error-icon-circle">X</div>
                      <span className="error-name">{err.name}</span>
                    </div>
                    <div className="error-desc">{err.desc}</div>
                  </div>
                ))}
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