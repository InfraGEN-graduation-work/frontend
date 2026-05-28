import React, { useState } from 'react';
import './MainPage.css';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import Canvas from './components/Canvas';
import RightSideBar from './components/RightSideBar';
import Generate from './components/Generate'; 
import type { NodeData, SelectionArea, Edge, FileGroup } from './types';

interface HistoryState {
  nodes: NodeData[];
  edges: Edge[];
  selectedNodeIds: string[];
  selection: SelectionArea;
  files: FileGroup[];
  targetFileIds: string[];
}

export interface ViewportState {
  scrollLeft: number;
  scrollTop: number;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
}

const App: React.FC = () => {
  const [projectName, setProjectName] = useState('Project');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [showRightSidebar, setShowRightSidebar] = useState(false); 
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selection, setSelection] = useState<SelectionArea>({ x: 0, y: 0, width: 0, height: 0, active: false });

  const [files, setFiles] = useState<FileGroup[]>([
  ]);
  const [targetFileIds, setTargetFileIds] = useState<string[]>([]);
  const [leftActiveTab, setLeftActiveTab] = useState<'Project' | 'Settings' | 'Validation'>('Project');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);

  const [viewport, setViewport] = useState<ViewportState>({
    scrollLeft: 0, scrollTop: 0, clientWidth: 100, clientHeight: 100, scrollWidth: 500, scrollHeight: 500
  });

  const [appMode, setAppMode] = useState<'editor' | 'generating'>('editor');
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [genProgress, setGenProgress] = useState(0);

  const [uiResetTrigger, setUiResetTrigger] = useState(0);

  //에러는 임의로 지정해둠
  const validationErrors: { name: string; desc: string }[] = [];
  if (nodes.length === 0) {
    validationErrors.push({ name: '노드 미배치', desc: '노드를 배치하지 않았습니다.' });
  }
  if (targetFileIds.length === 0) {
    validationErrors.push({ name: '생성할 코드 미배치', desc: '생성할 코드 파일에 노드 파일이 존재하지 않습니다.' });
  }

  const handleResetUI = () => {
    setZoomLevel(1);
    setIsSelectMode(false);
    setSelectedNodeIds([]);
    setSelectedFileId(null);
    setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
    setSelectedCategory(null);
    setLeftActiveTab('Project');
    setShowRightSidebar(false); 
    
    setUiResetTrigger(prev => prev + 1);
  };

  const saveHistory = () => {
    setHistory((prev) => [...prev, { 
      nodes: [...nodes], edges: [...edges], selectedNodeIds: [...selectedNodeIds], 
      selection: { ...selection }, files: JSON.parse(JSON.stringify(files)), targetFileIds: [...targetFileIds]
    }]);
    setRedoStack([]); 
  };

  const markFilesAsModified = () => {
    setFiles((prev) => prev.map(f => ({ ...f, isGenerated: false })));
  };

  const handleGenerateClick = () => {
    if (validationErrors.length > 0) {
      setIsErrorModalOpen(true);
    } else {
      setIsConfirmModalOpen(true);
    }
  };

  const confirmGenerate = () => {
    setIsConfirmModalOpen(false);
    setAppMode('generating');
    setGenProgress(0);
    
    saveHistory();
    setFiles((prev) => prev.map(f => targetFileIds.includes(f.id) ? { ...f, isGenerated: true } : f));
    
    const interval = setInterval(() => {
      setGenProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2; 
      });
    }, 40);
  };

  const closeErrorModalAndShowValidation = () => {
    setIsErrorModalOpen(false);
    setLeftActiveTab('Validation');
    if (!showRightSidebar) setShowRightSidebar(true);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setRedoStack((prev) => [...prev, { 
      nodes: [...nodes], edges: [...edges], selectedNodeIds: [...selectedNodeIds], 
      selection: { ...selection }, files: JSON.parse(JSON.stringify(files)), targetFileIds: [...targetFileIds]
    }]);
    setNodes(previousState.nodes); setEdges(previousState.edges);
    setSelectedNodeIds(previousState.selectedNodeIds); setSelection(previousState.selection);
    setFiles(previousState.files); setTargetFileIds(previousState.targetFileIds);
    setHistory((prev) => prev.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistory((prev) => [...prev, { 
      nodes: [...nodes], edges: [...edges], selectedNodeIds: [...selectedNodeIds], 
      selection: { ...selection }, files: JSON.parse(JSON.stringify(files)), targetFileIds: [...targetFileIds]
    }]);
    setNodes(nextState.nodes); setEdges(nextState.edges);
    setSelectedNodeIds(nextState.selectedNodeIds); setSelection(nextState.selection);
    setFiles(nextState.files); setTargetFileIds(nextState.targetFileIds);
    setRedoStack((prev) => prev.slice(0, -1));
  };

  const toggleRightSidebar = () => setShowRightSidebar(!showRightSidebar);
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.1, 0.5));

  const addNode = (type: string, name: string, x: number, y: number) => {
    saveHistory(); 
    markFilesAsModified();
    const newNode: NodeData = { id: `node-${Date.now()}`, type, name, x, y };
    setNodes((prev) => [...prev, newNode]);
  };

  const deleteSelected = () => {
    if (selectedNodeIds.length === 0) return;
    saveHistory(); 
    markFilesAsModified();
    setNodes((prev) => prev.filter(node => !selectedNodeIds.includes(node.id)));
    setEdges((prev) => prev.filter(edge => !selectedNodeIds.includes(edge.sourceId) && !selectedNodeIds.includes(edge.targetId)));
    setFiles((prev) => prev.map(f => ({ ...f, nodeIds: f.nodeIds.filter(id => !selectedNodeIds.includes(id)) })));
    setSelectedNodeIds([]);
    setSelectedFileId(null);
    setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
  };

  const onCancelSelection = () => {
    saveHistory();
    setIsSelectMode(false);
    setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
    setSelectedNodeIds([]);
    setSelectedFileId(null);
  };

  const deleteRightPanelItems = (fileIdsToDelete: string[], nodeIdsToDelete: string[]) => {
    if (fileIdsToDelete.length === 0 && nodeIdsToDelete.length === 0) return;
    saveHistory();
    markFilesAsModified();
    
    if (selectedFileId && fileIdsToDelete.includes(selectedFileId)) {
      setSelectedFileId(null);
    }
    
    setFiles((prev) => prev.filter(f => !fileIdsToDelete.includes(f.id)).map(f => ({
      ...f,
      nodeIds: f.nodeIds.filter(id => !nodeIdsToDelete.includes(id))
    })));
    setNodes((prev) => prev.filter(n => !nodeIdsToDelete.includes(n.id)));
    setEdges((prev) => prev.filter(e => !nodeIdsToDelete.includes(e.sourceId) && !nodeIdsToDelete.includes(e.targetId)));
    setTargetFileIds((prev) => prev.filter(id => !fileIdsToDelete.includes(id)));
  };

  return (
    <div className="app-container">
      <Header 
        onGenerate={handleGenerateClick} 
        isGenerateMode={appMode === 'generating'} 
        onResetUI={handleResetUI} 
      />
      
      {appMode === 'editor' ? (
        <div className="main-layout">
          <LeftPanel 
            projectName={projectName} setProjectName={setProjectName}
            nodes={nodes} activeTab={leftActiveTab} setActiveTab={setLeftActiveTab}
            onSelectCategory={setSelectedCategory} onToggleRightSidebar={toggleRightSidebar}
            showRightSidebar={showRightSidebar} setShowRightSidebar={setShowRightSidebar}
            onZoomIn={handleZoomIn} onZoomOut={handleZoomOut}
            onSelectMode={() => { saveHistory(); setIsSelectMode(true); }}
            onCancelSelection={onCancelSelection} onDelete={deleteSelected}
            onUndo={undo} onRedo={redo}
            canUndo={history.length > 0} canRedo={redoStack.length > 0}
            isSelectMode={isSelectMode}
            resetTrigger={uiResetTrigger}
          />
          <Canvas 
            nodes={nodes} setNodes={setNodes} edges={edges} setEdges={setEdges}
            selectedNodeIds={selectedNodeIds} setSelectedNodeIds={setSelectedNodeIds}
            addNode={addNode} zoomLevel={zoomLevel} isSelectMode={isSelectMode}
            selection={selection} setSelection={setSelection} saveHistory={saveHistory}
            markFilesAsModified={markFilesAsModified} setSelectedFileId={setSelectedFileId}
            setViewport={setViewport} focusNodeId={focusNodeId} setFocusNodeId={setFocusNodeId}
            resetTrigger={uiResetTrigger}
          />
          {selectedFileId && (
            <div className="code-viewer-panel">
              <div className="code-viewer-header">
                <div className="code-viewer-tab">
                  {files.find(f => f.id === selectedFileId)?.name}
                </div>
              </div>
              <div className="code-viewer-content">
                {files.find(f => f.id === selectedFileId)?.isGenerated ? (
`# ${files.find(f => f.id === selectedFileId)?.name}
생성한 코드를 서버에서 불러와서 띄워야함`
                ) : (
                  `// 코드가 생성되지 않았습니다.\n// Generate 버튼을 클릭하여 코드를 생성하세요.`
                )}
              </div>
            </div>
          )}
          {showRightSidebar && (
            <RightSideBar 
              nodes={nodes} setNodes={setNodes} edges={edges} activeTab={leftActiveTab} saveHistory={saveHistory}
              files={files} setFiles={setFiles} targetFileIds={targetFileIds} setTargetFileIds={setTargetFileIds}
              markFilesAsModified={markFilesAsModified} deleteRightPanelItems={deleteRightPanelItems}
              selectedFileId={selectedFileId} setSelectedFileId={setSelectedFileId}
              setSelectedNodeIds={setSelectedNodeIds} selectedNodeIds={selectedNodeIds} viewport={viewport} zoomLevel={zoomLevel}
              setFocusNodeId={setFocusNodeId} validationErrors={validationErrors}
              resetTrigger={uiResetTrigger}
              setSelection={setSelection}
              setIsSelectMode={setIsSelectMode}
            />
          )}
        </div>
      ) : (
        <Generate 
          genProgress={genProgress}
          targetFileIds={targetFileIds}
          files={files}
          projectName={projectName}
          onBack={() => {
            setAppMode('editor');
            setTargetFileIds([]);
          }}
        />
      )}

      {isErrorModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title error">프로젝트를 생성할 수 없습니다.</div>
            <div className="modal-body">
              <div style={{fontWeight: 'bold', marginBottom: '8px', color: '#333'}}>오류 발견</div>
              {validationErrors.map((err, idx) => (
                <div key={idx} style={{color: '#718096', marginBottom: '4px'}}>- {err.name}</div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="modal-btn confirm" onClick={closeErrorModalAndShowValidation}>확인</button>
            </div>
          </div>
        </div>
      )}

      {isConfirmModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title info">다음 프로젝트를 생성합니다.</div>
            <div className="modal-body">
              <div style={{fontWeight: 'bold', marginBottom: '8px', color: '#333'}}>프로젝트명</div>
              {targetFileIds.length > 0 ? (
                targetFileIds.map(id => <div key={id} style={{color: '#718096', marginBottom: '4px'}}>- {files.find(f => f.id === id)?.name}</div>)
              ) : (
                <div style={{color: '#718096'}}>- 생성할 파일이 없습니다.</div>
              )}
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setIsConfirmModalOpen(false)}>취소</button>
              <button className="modal-btn confirm" onClick={confirmGenerate}>생성</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;