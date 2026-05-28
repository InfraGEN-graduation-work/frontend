import React, { useState, useRef, useEffect } from 'react';
import type { NodeData, SelectionArea, Edge } from '../types';
import type { ViewportState } from '../MainPage';

interface CanvasProps {
  nodes: NodeData[];
  setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  selectedNodeIds: string[];
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
  addNode: (type: string, name: string, x: number, y: number) => void;
  zoomLevel: number;
  isSelectMode: boolean;
  selection: SelectionArea;
  setSelection: React.Dispatch<React.SetStateAction<SelectionArea>>;
  saveHistory: () => void;
  markFilesAsModified: () => void;
  setSelectedFileId: React.Dispatch<React.SetStateAction<string | null>>;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  focusNodeId: string | null;
  setFocusNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  resetTrigger: number;
}

const Canvas: React.FC<CanvasProps> = ({ 
  nodes, setNodes, edges, setEdges, selectedNodeIds, setSelectedNodeIds, 
  addNode, zoomLevel, isSelectMode, selection, setSelection, saveHistory, markFilesAsModified, setSelectedFileId, setViewport,
  focusNodeId, setFocusNodeId, resetTrigger
}) => {
  const [isAreaSelecting, setIsAreaSelecting] = useState(false);
  const [isGroupDragging, setIsGroupDragging] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  
  const [startMousePos, setStartMousePos] = useState({ x: 0, y: 0 });
  const [initialPositions, setInitialPositions] = useState<Record<string, { x: number, y: number }>>({});
  const [initialSelectionPos, setInitialSelectionPos] = useState({ x: 0, y: 0 });

  const [drawingEdgeSource, setDrawingEdgeSource] = useState<string | null>(null);
  const [tempEdgeEnd, setTempEdgeEnd] = useState({ x: 0, y: 0 });

  const viewportRef = useRef<HTMLElement>(null);

  const handleScroll = () => {
    if (viewportRef.current) {
      setViewport({
        scrollLeft: viewportRef.current.scrollLeft,
        scrollTop: viewportRef.current.scrollTop,
        clientWidth: viewportRef.current.clientWidth,
        clientHeight: viewportRef.current.clientHeight,
        scrollWidth: viewportRef.current.scrollWidth,
        scrollHeight: viewportRef.current.scrollHeight,
      });
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [zoomLevel, nodes]);

  // 우측 패널 노드 클릭 시 이동함
  useEffect(() => {
    if (focusNodeId) {
      const targetNode = nodes.find(n => n.id === focusNodeId);
      if (targetNode) scrollToNode(targetNode);
      setFocusNodeId(null);
    }
  }, [focusNodeId, nodes, zoomLevel, setFocusNodeId]);

  // 새로고침: 화면 정리
  useEffect(() => {
    if (resetTrigger > 0 && viewportRef.current) {
      viewportRef.current.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    }
  }, [resetTrigger]);

  const scrollToNode = (node: NodeData) => {
    if (viewportRef.current) {
      const nodeCenterX = (node.x + 90) * zoomLevel;
      const nodeCenterY = (node.y + 40) * zoomLevel;
      const x = nodeCenterX - (viewportRef.current.clientWidth / 2);
      const y = nodeCenterY - (viewportRef.current.clientHeight / 2);
      viewportRef.current.scrollTo({ left: x, top: y, behavior: 'smooth' });
    }
  };

  const getCanvasCoords = (e: React.MouseEvent | React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: (e.clientX - rect.left + (e.currentTarget as HTMLElement).scrollLeft) / zoomLevel,
      y: (e.clientY - rect.top + (e.currentTarget as HTMLElement).scrollTop) / zoomLevel
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) return; 
    const coords = getCanvasCoords(e);

    const isInsideSelection = selection.active && 
      coords.x >= selection.x && coords.x <= selection.x + selection.width &&
      coords.y >= selection.y && coords.y <= selection.y + selection.height;

    if (isSelectMode && isInsideSelection) {
      saveHistory();
      setIsGroupDragging(true);
      setStartMousePos(coords);
      const positions: Record<string, { x: number, y: number }> = {};
      nodes.forEach(n => {
        if (selectedNodeIds.includes(n.id)) positions[n.id] = { x: n.x, y: n.y };
      });
      setInitialPositions(positions);
      setInitialSelectionPos({ x: selection.x, y: selection.y });
      return;
    }

    const targetNode = nodes.find(n => coords.x >= n.x && coords.x <= n.x + 180 && coords.y >= n.y && coords.y <= n.y + 80);

    if (targetNode) {
      saveHistory();
      
      const isAlreadySelected = selectedNodeIds.includes(targetNode.id);
      
      if (isAlreadySelected && selectedNodeIds.length === 1) {
        setSelectedNodeIds([]);
        setSelectedFileId(null);
      } else {
        setSelectedNodeIds([targetNode.id]);
        setSelectedFileId(null);
        scrollToNode(targetNode);
      }
      
      setDraggingNodeId(targetNode.id);
      setStartMousePos(coords);
      setInitialPositions({ [targetNode.id]: { x: targetNode.x, y: targetNode.y } });
      setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
      return;
    }

    setSelectedNodeIds([]);
    setSelectedFileId(null);

    if (isSelectMode) {
      saveHistory();
      setIsAreaSelecting(true);
      setStartMousePos(coords);
      setSelection({ x: coords.x, y: coords.y, width: 0, height: 0, active: true });
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);
    const dx = coords.x - startMousePos.x;
    const dy = coords.y - startMousePos.y;

    if (isGroupDragging) {
      setNodes(prev => prev.map(n => initialPositions[n.id] ? { ...n, x: initialPositions[n.id].x + dx, y: initialPositions[n.id].y + dy } : n));
      setSelection(prev => ({ ...prev, x: initialSelectionPos.x + dx, y: initialSelectionPos.y + dy }));
    } else if (draggingNodeId) {
      setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: initialPositions[n.id].x + dx, y: initialPositions[n.id].y + dy } : n));
    } else if (isAreaSelecting) {
      const newX = Math.min(startMousePos.x, coords.x);
      const newY = Math.min(startMousePos.y, coords.y);
      const newW = Math.abs(coords.x - startMousePos.x);
      const newH = Math.abs(coords.y - startMousePos.y);
      setSelection({ x: newX, y: newY, width: newW, height: newH, active: true });

      const idsInside = nodes.filter(n => n.x >= newX && n.x + 180 <= newX + newW && n.y >= newY && n.y + 80 <= newY + newH).map(n => n.id);
      setSelectedNodeIds(idsInside);
    }
    if (drawingEdgeSource) setTempEdgeEnd(coords);
  };

  const onMouseUp = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);
    // 우클릭(e.button === 2)일 때는 onContextMenu에서 처리하도록 넘김
    if (drawingEdgeSource && e.button !== 2) {
      const targetNode = nodes.find(n => coords.x >= n.x && coords.x <= n.x + 180 && coords.y >= n.y && coords.y <= n.y + 80);
      if (targetNode && targetNode.id !== drawingEdgeSource) {
        const exists = edges.some(edge => (edge.sourceId === drawingEdgeSource && edge.targetId === targetNode.id));
        if (!exists) {
          saveHistory();
          markFilesAsModified();
          setEdges(prev => [...prev, { id: `edge-${Date.now()}`, sourceId: drawingEdgeSource, targetId: targetNode.id }]);
        }
      }
      setDrawingEdgeSource(null);
    }

    if (draggingNodeId || isGroupDragging) {
      markFilesAsModified();
    }
    setIsAreaSelecting(false);
    setIsGroupDragging(false);
    setDraggingNodeId(null);
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    const targetNode = nodes.find(n => coords.x >= n.x && coords.x <= n.x + 180 && coords.y >= n.y && coords.y <= n.y + 80);
    
    if (drawingEdgeSource) {
      // 이미 선을 긋고 있던 상태라면 선 긋기를 종료 (타겟이 유효하면 연결)
      if (targetNode && targetNode.id !== drawingEdgeSource) {
        const exists = edges.some(edge => (edge.sourceId === drawingEdgeSource && edge.targetId === targetNode.id));
        if (!exists) {
          saveHistory();
          markFilesAsModified();
          setEdges(prev => [...prev, { id: `edge-${Date.now()}`, sourceId: drawingEdgeSource, targetId: targetNode.id }]);
        }
      }
      setDrawingEdgeSource(null);
    } else if (targetNode) {
      // 선 긋기 시작
      setDrawingEdgeSource(targetNode.id);
      setTempEdgeEnd(coords);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    const nodeType = e.dataTransfer.getData('nodeType');
    if (nodeType) addNode(nodeType, nodeType, coords.x - 90, coords.y - 40);
  };

  return (
    <main ref={viewportRef} className="canvas-viewport" onScroll={handleScroll} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onContextMenu={onContextMenu} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <div className="canvas-content" style={{ transform: `scale(${zoomLevel})`, transformOrigin: '0 0' }}>
        <div className="canvas-inner-elements">
          <svg className="edge-layer">
            {edges.map(edge => {
              const s = nodes.find(n => n.id === edge.sourceId);
              const t = nodes.find(n => n.id === edge.targetId);
              if (!s || !t) return null;
              return <line key={edge.id} x1={s.x + 90} y1={s.y + 40} x2={t.x + 90} y2={t.y + 40} stroke="#cbd5e0" strokeWidth="2" strokeDasharray="4" />;
            })}
            {drawingEdgeSource && <line x1={(nodes.find(n => n.id === drawingEdgeSource)?.x || 0) + 90} y1={(nodes.find(n => n.id === drawingEdgeSource)?.y || 0) + 40} x2={tempEdgeEnd.x} y2={tempEdgeEnd.y} stroke="#28b4ad" strokeWidth="2" strokeDasharray="4" />}
          </svg>
          {nodes.map((node) => (
            <div 
              key={node.id} 
              className={`deployed-node ${selectedNodeIds.includes(node.id) ? 'selected' : ''}`} 
              style={{ 
                left: node.x, 
                top: node.y,
                zIndex: selectedNodeIds.includes(node.id) ? 10 : 5 // 선택된 노드를 맨 위로 띄움
              }}
            >
              <div className="node-header">
                <div className="node-type-icon"></div>
                <div className="node-info">
                  <div className="node-name">{node.name}</div>
                  <div className="node-sub">메인 {node.type} 서비스</div>
                </div>
              </div>
            </div>
          ))}
          {selection.active && <div className="selection-box" style={{ left: selection.x, top: selection.y, width: selection.width, height: selection.height, cursor: isSelectMode ? 'move' : 'default' }} />}
        </div>
      </div>
    </main>
  );
};

export default Canvas;