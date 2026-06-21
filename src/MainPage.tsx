import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './MainPage.css';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import Canvas from './components/Canvas';
import RightSideBar from './components/RightSideBar';
import Generate from './components/Generate'; 
import type { NodeData, SelectionArea, Edge, FileGroup } from './types';
import Tutorial from './components/Tutorial';

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

const MainPage: React.FC = () => {
  const { projectId } = useParams(); 
  const navigate = useNavigate();
  const [showTutorial, setShowTutorial] = useState(true);

  const [userInfo, setUserInfo] = useState({ nickname: '로딩중...', email: '로딩중...' });

  const [projectName, setProjectName] = useState('로딩중...');
  const [projectDescription, setProjectDescription] = useState('');

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [showRightSidebar, setShowRightSidebar] = useState(false); 
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selection, setSelection] = useState<SelectionArea>({ x: 0, y: 0, width: 0, height: 0, active: false });

  const [files, setFiles] = useState<FileGroup[]>([]);
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

  const validationErrors: { name: string; desc: string }[] = [];
  if (nodes.length === 0) {
    validationErrors.push({ name: '노드 미배치', desc: '노드를 배치하지 않았습니다.' });
  }
  if (targetFileIds.length === 0) {
    validationErrors.push({ name: '생성할 코드 미배치', desc: '생성할 코드 파일에 노드 파일이 존재하지 않습니다.' });
  }

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      navigate('/login');
      return;
    }

    fetch('http://infragen.kro.kr/api/v1/members/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    .then(res => res.json())
    .then(data => {
      const isSuccess = data.isSuccess ?? data.is_success;
      if (isSuccess && data.result) {
        setUserInfo({ nickname: data.result.nickname, email: data.result.email });
      } else {
        setUserInfo({ nickname: '사용자', email: '알 수 없음' });
      }
    })
    .catch(() => {
      setUserInfo({ nickname: '사용자', email: '알 수 없음' });
    });

    if (projectId) {
      fetch(`http://infragen.kro.kr/api/v1/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      .then(res => res.json())
      .then(data => {
        const isSuccess = data.isSuccess ?? data.is_success;
        if (isSuccess && data.result) {
          setProjectName(data.result.title);
          setProjectDescription(data.result.description || '');

          const fetchedNodes = data.result.nodes || [];
          const loadedNodes: NodeData[] = fetchedNodes.map((n: any) => ({
            id: n.id.toString(),
            type: n.componentType === 'SPRING_BOOT' ? 'Spring Boot' : n.componentType === 'MYSQL' ? 'MySQL' : n.componentType,
            name: n.nodeName,
            x: n.positionX,
            y: n.positionY,
            settings: n.properties || {}
          }));
          setNodes(loadedNodes);

          const fetchedEdges = data.result.edges || [];
          const loadedEdges: Edge[] = fetchedEdges.map((e: any) => ({
            id: `edge-${e.id}`,
            sourceId: e.sourceNodeId.toString(),
            targetId: e.targetNodeId.toString()
          }));
          setEdges(loadedEdges);

          const reconstructedFiles: Record<string, FileGroup> = {};
          loadedNodes.forEach((n: any) => {
            const props = n.settings;
            if (props && props.fileId) {
              if (!reconstructedFiles[props.fileId]) {
                reconstructedFiles[props.fileId] = {
                  id: props.fileId,
                  name: props.fileName || '새 파일',
                  isGenerated: !!props.fileIsGenerated,
                  nodeIds: [],
                  isExpanded: true
                };
              }
              reconstructedFiles[props.fileId].nodeIds.push(n.id);
            }
          });
          const loadedFiles = Object.values(reconstructedFiles);
          setFiles(loadedFiles);
          setTargetFileIds(loadedFiles.map(f => f.id));

        } else {
          setProjectName('알 수 없는 프로젝트');
        }
      })
      .catch(err => {
        console.error("프로젝트 상세 정보를 불러오는데 실패했습니다:", err);
        setProjectName('연결 오류');
      });
    }
  }, [navigate, projectId]);


  const handleSaveCanvas = async () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken || !projectId) return;

    const mappedNodes = nodes.map(n => {
      const file = files.find(f => f.nodeIds.includes(n.id));
      const properties: any = { ...(n as any).settings };
      
      if (file) {
        properties.fileId = file.id;
        properties.fileName = file.name;
        properties.fileIsGenerated = file.isGenerated;
      } else {
        delete properties.fileId;
        delete properties.fileName;
        delete properties.fileIsGenerated;
      }

      return {
        nodeName: n.name,
        componentType: n.type.toUpperCase().replace(' ', '_'),
        positionX: n.x,
        positionY: n.y,
        properties: properties
      };
    });

    const mappedEdges = edges.map(e => {
      const sourceNode = nodes.find(n => n.id === e.sourceId);
      const targetNode = nodes.find(n => n.id === e.targetId);
      return {
        sourceNodeName: sourceNode?.name || '',
        targetNodeName: targetNode?.name || ''
      };
    }).filter(e => e.sourceNodeName && e.targetNodeName);

    try {
      const res = await fetch(`http://infragen.kro.kr/api/v1/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          title: projectName,
          description: projectDescription,
          nodes: mappedNodes,
          edges: mappedEdges
        })
      });

      const data = await res.json();
      const isSuccess = data.isSuccess ?? data.is_success;

      if (res.ok && isSuccess) {
        alert('캔버스가 성공적으로 저장되었습니다.');
      } else {
        alert(data.message || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('서버 오류가 발생했습니다.');
    }
  };

  const handleUpdateProjectName = async (newName: string) => {
    if (!newName.trim() || newName === projectName) return;

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken || !projectId) return;

    const previousName = projectName;
    setProjectName(newName);

    const mappedNodes = nodes.map(n => {
      const file = files.find(f => f.nodeIds.includes(n.id));
      const properties: any = { ...(n as any).settings };
      if (file) {
        properties.fileId = file.id; properties.fileName = file.name; properties.fileIsGenerated = file.isGenerated;
      } else {
        delete properties.fileId; delete properties.fileName; delete properties.fileIsGenerated;
      }
      return {
        nodeName: n.name, componentType: n.type.toUpperCase().replace(' ', '_'),
        positionX: n.x, positionY: n.y, properties: properties
      };
    });

    const mappedEdges = edges.map(e => {
      const sourceNode = nodes.find(n => n.id === e.sourceId);
      const targetNode = nodes.find(n => n.id === e.targetId);
      return { sourceNodeName: sourceNode?.name || '', targetNodeName: targetNode?.name || '' };
    }).filter(e => e.sourceNodeName && e.targetNodeName);

    try {
      const res = await fetch(`http://infragen.kro.kr/api/v1/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ title: newName, description: projectDescription, nodes: mappedNodes, edges: mappedEdges })
      });

      const data = await res.json();
      if (!res.ok || !(data.isSuccess ?? data.is_success)) {
        alert(data.message || '프로젝트 이름 저장에 실패했습니다.');
        setProjectName(previousName);
      }
    } catch (err) {
      alert('서버 오류가 발생했습니다.');
      setProjectName(previousName);
    }
  };

  const handleGoHome = () => {
    navigate('/dashboard');
  };

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

  const addNode = (type: string, baseName: string, x: number, y: number) => {
    saveHistory(); 
    markFilesAsModified();
    
    let finalName = baseName;
    let counter = 1;
    while (nodes.some(n => n.name === finalName)) {
      finalName = `${baseName}_${counter}`;
      counter++;
    }

    const newNode: NodeData = { id: `node-${Date.now()}`, type, name: finalName, x, y };
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
        onSaveCanvas={handleSaveCanvas}
      />
      
      {appMode === 'editor' ? (
        <div className="main-layout">
          <LeftPanel 
            projectName={projectName} 
            onUpdateProjectName={handleUpdateProjectName} 
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
            userInfo={userInfo}
            onGoHome={handleGoHome}
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

      {showTutorial && (
        <Tutorial
          nodes={nodes}  
          onFinish={() => setShowTutorial(false)}
          onSkip={() => setShowTutorial(false)}
        />
      )}
      
    </div>
  );
};

export default MainPage;