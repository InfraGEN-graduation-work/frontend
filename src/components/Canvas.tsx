import React, { useState, useRef, useEffect } from 'react';
import type { NodeData, SelectionArea, Edge } from '../types';
import type { ViewportState } from '../MainPage';
import mysqlIcon from '../assets/mysql.png';
import springbootIcon from '../assets/springboot.png';
import redisIcon from '../assets/redis.png';

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
  setActiveTab: React.Dispatch<React.SetStateAction<'Project' | 'Settings' | 'Validation'>>;
  setShowRightSidebar: React.Dispatch<React.SetStateAction<boolean>>;
}

const Canvas: React.FC<CanvasProps> = ({ 
  nodes, setNodes, edges, setEdges, selectedNodeIds, setSelectedNodeIds, 
  addNode, zoomLevel, isSelectMode, selection, setSelection, saveHistory, markFilesAsModified, setSelectedFileId, setViewport,
  focusNodeId, setFocusNodeId, resetTrigger, setActiveTab, setShowRightSidebar
}) => {
  const [isAreaSelecting, setIsAreaSelecting] = useState(false);
  const [isGroupDragging, setIsGroupDragging] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [startMousePos, setStartMousePos] = useState({ x: 0, y: 0 });
  const [initialPositions, setInitialPositions] = useState<Record<string, { x: number, y: number }>>({});
  const [initialSelectionPos, setInitialSelectionPos] = useState({ x: 0, y: 0 });

  const [drawingEdgeSource, setDrawingEdgeSource] = useState<string | null>(null);
  const [tempEdgeEnd, setTempEdgeEnd] = useState({ x: 0, y: 0 });

  const viewportRef = useRef<HTMLElement>(null);
  const lastPointerRef = useRef<{ clientX: number, clientY: number } | null>(null);

  const NODE_W = 210;
  const NODE_H = 66;
  const HW = NODE_W / 2;
  const HH = NODE_H / 2;

  const stateRef = useRef({
    startMousePos, initialPositions, initialSelectionPos, nodes, zoomLevel,
    isGroupDragging, draggingNodeId, isAreaSelecting, drawingEdgeSource
  });
  
  useEffect(() => {
    stateRef.current = {
      startMousePos, initialPositions, initialSelectionPos, nodes, zoomLevel,
      isGroupDragging, draggingNodeId, isAreaSelecting, drawingEdgeSource
    };
  });

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

  useEffect(() => {
    if (focusNodeId) {
      const targetNode = nodes.find(n => n.id === focusNodeId);
      if (targetNode) scrollToNode(targetNode);
      setFocusNodeId(null);
    }
  }, [focusNodeId, nodes, zoomLevel, setFocusNodeId]);

  useEffect(() => {
    if (resetTrigger > 0 && viewportRef.current) {
      viewportRef.current.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    }
  }, [resetTrigger]);

  const scrollToNode = (node: NodeData) => {
    if (viewportRef.current) {
      const nodeCenterX = (node.x + HW) * zoomLevel;
      const nodeCenterY = (node.y + HH) * zoomLevel;
      const x = nodeCenterX - (viewportRef.current.clientWidth / 2);
      const y = nodeCenterY - (viewportRef.current.clientHeight / 2);
      viewportRef.current.scrollTo({ left: x, top: y, behavior: 'smooth' });
    }
  };

  const scrollToEdgeCenter = (midX: number, midY: number) => {
    if (viewportRef.current) {
      const centerX = midX * zoomLevel;
      const centerY = midY * zoomLevel;
      const x = centerX - (viewportRef.current.clientWidth / 2);
      const y = centerY - (viewportRef.current.clientHeight / 2);
      viewportRef.current.scrollTo({ left: x, top: y, behavior: 'smooth' });
    }
  };

  const getCoords = (clientX: number, clientY: number, container: HTMLElement, currentZoom: number) => {
    const rect = container.getBoundingClientRect();
    return {
      x: (clientX - rect.left + container.scrollLeft) / currentZoom,
      y: (clientY - rect.top + container.scrollTop) / currentZoom
    };
  };

  const checkEdgeScroll = (clientX: number, clientY: number) => {
    if (!viewportRef.current) return false;
    const rect = viewportRef.current.getBoundingClientRect();
    const THRESHOLD = 60; 
    const maxSpeed = 15;  
    let scrollX = 0;
    let scrollY = 0;

    if (clientX < rect.left + THRESHOLD) {
      const dist = (rect.left + THRESHOLD) - clientX;
      scrollX = -(Math.min(dist / THRESHOLD, 1.5) * maxSpeed);
    } else if (clientX > rect.right - THRESHOLD) {
      const dist = clientX - (rect.right - THRESHOLD);
      scrollX = (Math.min(dist / THRESHOLD, 1.5) * maxSpeed);
    }

    if (clientY < rect.top + THRESHOLD) {
      const dist = (rect.top + THRESHOLD) - clientY;
      scrollY = -(Math.min(dist / THRESHOLD, 1.5) * maxSpeed);
    } else if (clientY > rect.bottom - THRESHOLD) {
      const dist = clientY - (rect.bottom - THRESHOLD);
      scrollY = (Math.min(dist / THRESHOLD, 1.5) * maxSpeed);
    }

    if (scrollX !== 0 || scrollY !== 0) {
      viewportRef.current.scrollBy(scrollX, scrollY);
      return true;
    }
    return false;
  };

  const handlePointerMoveLogic = (clientX: number, clientY: number) => {
    if (!viewportRef.current) return;
    const state = stateRef.current;
    const coords = getCoords(clientX, clientY, viewportRef.current, state.zoomLevel);
    
    const dx = coords.x - state.startMousePos.x;
    const dy = coords.y - state.startMousePos.y;

    const contentEl = viewportRef.current.querySelector('.canvas-content') as HTMLElement;
    const maxW = contentEl ? contentEl.offsetWidth : 5000;
    const maxH = contentEl ? contentEl.offsetHeight : 5000;

    if (state.isGroupDragging) {
      let minGroupX = Infinity, minGroupY = Infinity;
      let maxGroupX = -Infinity, maxGroupY = -Infinity;
      
      Object.keys(state.initialPositions).forEach(id => {
        const pos = state.initialPositions[id];
        minGroupX = Math.min(minGroupX, pos.x);
        minGroupY = Math.min(minGroupY, pos.y);
        maxGroupX = Math.max(maxGroupX, pos.x + NODE_W);
        maxGroupY = Math.max(maxGroupY, pos.y + NODE_H);
      });

      const minDx = -minGroupX;
      const maxDx = maxW - maxGroupX;
      const minDy = -minGroupY;
      const maxDy = maxH - maxGroupY;

      const clampedDx = Math.max(minDx, Math.min(dx, maxDx));
      const clampedDy = Math.max(minDy, Math.min(dy, maxDy));

      setNodes(prev => prev.map(n => 
        state.initialPositions[n.id] 
          ? { ...n, x: state.initialPositions[n.id].x + clampedDx, y: state.initialPositions[n.id].y + clampedDy } 
          : n
      ));

      if (selection.active) {
         setSelection(prev => ({ ...prev, x: state.initialSelectionPos.x + clampedDx, y: state.initialSelectionPos.y + clampedDy }));
      }
      
    } else if (state.draggingNodeId) {
      const pos = state.initialPositions[state.draggingNodeId];
      if (pos) {
        const minDx = -pos.x;
        const maxDx = maxW - (pos.x + NODE_W);
        const minDy = -pos.y;
        const maxDy = maxH - (pos.y + NODE_H);

        const clampedDx = Math.max(minDx, Math.min(dx, maxDx));
        const clampedDy = Math.max(minDy, Math.min(dy, maxDy));

        setNodes(prev => prev.map(n => 
          n.id === state.draggingNodeId 
            ? { ...n, x: pos.x + clampedDx, y: pos.y + clampedDy } 
            : n
        ));
      }
    } else if (state.isAreaSelecting) {
      const newX = Math.max(0, Math.min(state.startMousePos.x, coords.x));
      const newY = Math.max(0, Math.min(state.startMousePos.y, coords.y));
      const endX = Math.min(maxW, Math.max(state.startMousePos.x, coords.x));
      const endY = Math.min(maxH, Math.max(state.startMousePos.y, coords.y));
      
      const newW = endX - newX;
      const newH = endY - newY;
      
      setSelection({ x: newX, y: newY, width: newW, height: newH, active: true });

      const idsInside = state.nodes.filter(n => n.x >= newX && n.x + NODE_W <= newX + newW && n.y >= newY && n.y + NODE_H <= newY + newH).map(n => n.id);
      setSelectedNodeIds(idsInside);
    }
    
    if (state.drawingEdgeSource) setTempEdgeEnd(coords);
  };

  useEffect(() => {
    const isInteracting = isGroupDragging || draggingNodeId !== null || isAreaSelecting || drawingEdgeSource !== null;
    if (!isInteracting) return;

    let animationFrameId: number;

    const scrollLoop = () => {
      if (lastPointerRef.current) {
        const { clientX, clientY } = lastPointerRef.current;
        if (checkEdgeScroll(clientX, clientY)) {
          handlePointerMoveLogic(clientX, clientY);
        }
      }
      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    animationFrameId = requestAnimationFrame(scrollLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isGroupDragging, draggingNodeId, isAreaSelecting, drawingEdgeSource]);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button === 2) return; 
    if (!viewportRef.current) return;
    
    setSelectedEdgeId(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    const coords = getCoords(e.clientX, e.clientY, viewportRef.current, zoomLevel);

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

    const targetNode = nodes.find(n => coords.x >= n.x && coords.x <= n.x + NODE_W && coords.y >= n.y && coords.y <= n.y + NODE_H);

    if (targetNode) {
      saveHistory();
      
      let currentSelected = selectedNodeIds;

      if (e.ctrlKey || e.metaKey) {
        if (selectedNodeIds.includes(targetNode.id)) {
           currentSelected = selectedNodeIds.filter(id => id !== targetNode.id);
        } else {
           currentSelected = [...selectedNodeIds, targetNode.id];
        }
        setSelectedNodeIds(currentSelected);
        setSelectedFileId(null);
      } 
      else {
        if (!selectedNodeIds.includes(targetNode.id)) {
           currentSelected = [targetNode.id];
           setSelectedNodeIds(currentSelected);
           setSelectedFileId(null);
           scrollToNode(targetNode);
        }
        
        if (!isSelectMode) {
          setActiveTab('Settings');
          setShowRightSidebar(true);
        }
      }

      setStartMousePos(coords);
      const positions: Record<string, { x: number, y: number }> = {};
      if (currentSelected.length > 1 && currentSelected.includes(targetNode.id)) {
        setIsGroupDragging(true);
        setDraggingNodeId(null);
        nodes.forEach(n => {
          if (currentSelected.includes(n.id)) positions[n.id] = { x: n.x, y: n.y };
        });
      } else {
        setIsGroupDragging(false);
        setDraggingNodeId(targetNode.id);
        positions[targetNode.id] = { x: targetNode.x, y: targetNode.y };
      }

      setInitialPositions(positions);
      setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
      return;
    }

    setSelectedNodeIds([]);
    setSelectedFileId(null);

    if (isSelectMode || e.ctrlKey || e.metaKey) {
      saveHistory();
      setIsAreaSelecting(true);
      setStartMousePos(coords);
      setSelection({ x: coords.x, y: coords.y, width: 0, height: 0, active: true });
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    lastPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
    handlePointerMoveLogic(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    lastPointerRef.current = null;
    
    if (!viewportRef.current) return;
    const coords = getCoords(e.clientX, e.clientY, viewportRef.current, zoomLevel);
    
    if (drawingEdgeSource && e.button !== 2) {
      const targetNode = nodes.find(n => coords.x >= n.x && coords.x <= n.x + NODE_W && coords.y >= n.y && coords.y <= n.y + NODE_H);
      if (targetNode && targetNode.id !== drawingEdgeSource) {
        
        const exists = edges.some(edge => 
          (edge.sourceId === drawingEdgeSource && edge.targetId === targetNode.id) ||
          (edge.sourceId === targetNode.id && edge.targetId === drawingEdgeSource)
        );

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
    if (!viewportRef.current) return;
    const coords = getCoords(e.clientX, e.clientY, viewportRef.current, zoomLevel);
    const targetNode = nodes.find(n => coords.x >= n.x && coords.x <= n.x + NODE_W && coords.y >= n.y && coords.y <= n.y + NODE_H);
    
    if (drawingEdgeSource) {
      if (targetNode && targetNode.id !== drawingEdgeSource) {
        const exists = edges.some(edge => 
          (edge.sourceId === drawingEdgeSource && edge.targetId === targetNode.id) ||
          (edge.sourceId === targetNode.id && edge.targetId === drawingEdgeSource)
        );

        if (!exists) {
          saveHistory();
          markFilesAsModified();
          setEdges(prev => [...prev, { id: `edge-${Date.now()}`, sourceId: drawingEdgeSource, targetId: targetNode.id }]);
        }
      }
      setDrawingEdgeSource(null);
    } else if (targetNode) {
      setDrawingEdgeSource(targetNode.id);
      setTempEdgeEnd(coords);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    checkEdgeScroll(e.clientX, e.clientY);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!viewportRef.current) return;
    const coords = getCoords(e.clientX, e.clientY, viewportRef.current, zoomLevel);
    const nodeType = e.dataTransfer.getData('nodeType');
    
    if (nodeType) {
      const contentEl = viewportRef.current.querySelector('.canvas-content') as HTMLElement;
      const maxW = contentEl ? contentEl.offsetWidth : 5000;
      const maxH = contentEl ? contentEl.offsetHeight : 5000;
      
      const rawX = coords.x - HW;
      const rawY = coords.y - HH;
      const clampedX = Math.max(0, Math.min(rawX, maxW - NODE_W));
      const clampedY = Math.max(0, Math.min(rawY, maxH - NODE_H));

      addNode(nodeType, nodeType, clampedX, clampedY);
    }
  };

  const getNodeIcon = (type: string) => {
    if (type === 'MySQL') return mysqlIcon;
    if (type === 'Spring Boot') return springbootIcon;
    if (type === 'Redis') return redisIcon;
    return null;
  };

  return (
    <main 
      ref={viewportRef} 
      className="canvas-viewport" 
      onScroll={handleScroll} 
      onPointerDown={onPointerDown} 
      onPointerMove={onPointerMove} 
      onPointerUp={onPointerUp} 
      onContextMenu={onContextMenu} 
      onDragOver={onDragOver} 
      onDrop={handleDrop}
    >
      <div className="canvas-content" style={{ transform: `scale(${zoomLevel})`, transformOrigin: '0 0' }}>
        <div className="canvas-inner-elements">
          
          <svg className="edge-layer">
            {edges.map(edge => {
              const s = nodes.find(n => n.id === edge.sourceId);
              const t = nodes.find(n => n.id === edge.targetId);
              if (!s || !t) return null;
              
              const x1 = s.x + HW;
              const y1 = s.y + HH;
              const x2 = t.x + HW;
              const y2 = t.y + HH;
              
              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              const isSelected = selectedEdgeId === edge.id;

              const tx = HW / Math.abs(dx || 0.001);
              const ty = HH / Math.abs(dy || 0.001);
              const tRatio = Math.min(tx, ty);

              const startX = x1 + tRatio * dx;
              const startY = y1 + tRatio * dy;

              const endX = x2 - tRatio * dx;
              const endY = y2 - tRatio * dy;

              const arrowX = endX - (6 * dx / len);
              const arrowY = endY - (6 * dy / len);

              const lineEndX = endX - (12 * dx / len);
              const lineEndY = endY - (12 * dy / len);
              
              const midX = (startX + lineEndX) / 2;
              const midY = (startY + lineEndY) / 2;

              return (
                <g key={edge.id}>
                  <line 
                    x1={x1} y1={y1} x2={x2} y2={y2} 
                    stroke="transparent" strokeWidth="20" 
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onPointerDown={(e) => {
                      e.stopPropagation(); 
                      setSelectedEdgeId(edge.id);
                      scrollToEdgeCenter(midX, midY);
                    }}
                  />
                  
                  <line 
                    x1={startX} y1={startY} x2={lineEndX} y2={lineEndY} 
                    stroke={isSelected ? "#28b4ad" : "#cbd5e0"} 
                    strokeWidth={isSelected ? "3" : "2"} 
                    strokeDasharray="4" 
                    style={{ pointerEvents: 'none' }} 
                  />

                  <polygon
                    points="-6,-6 6,0 -6,6"
                    fill={isSelected ? "#28b4ad" : "#a0aec0"}
                    transform={`translate(${arrowX}, ${arrowY}) rotate(${angle})`}
                    style={{ pointerEvents: 'none' }}
                  />

                  {isSelected && (
                    <g
                      transform={`translate(${midX}, ${midY})`} 
                      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                      onPointerDown={(e) => {
                        e.stopPropagation(); 
                        saveHistory();
                        markFilesAsModified();
                        setEdges(prev => prev.filter(eg => eg.id !== edge.id));
                        setSelectedEdgeId(null);
                      }}
                    >
                      <circle cx="0" cy="0" r="11" fill="#ff4d4f" />
                      <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                      <line x1="-4" y1="4" x2="4" y2="-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    </g>
                  )}
                </g>
              );
            })}

            {drawingEdgeSource && (() => {
              const s = nodes.find(n => n.id === drawingEdgeSource);
              if (!s) return null;
              
              const x1 = s.x + HW;
              const y1 = s.y + HH;
              const x2 = tempEdgeEnd.x;
              const y2 = tempEdgeEnd.y;
              
              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

              const tx = HW / Math.abs(dx || 0.001);
              const ty = HH / Math.abs(dy || 0.001);
              const tRatio = Math.min(tx, ty, 0.95); 

              const startX = x1 + tRatio * dx;
              const startY = y1 + tRatio * dy;

              const arrowX = x2 - (6 * dx / len);
              const arrowY = y2 - (6 * dy / len);
              const lineEndX = x2 - (12 * dx / len);
              const lineEndY = y2 - (12 * dy / len);

              return (
                <g>
                  <line x1={startX} y1={startY} x2={lineEndX} y2={lineEndY} stroke="#28b4ad" strokeWidth="2" strokeDasharray="4" style={{ pointerEvents: 'none' }} />
                  <polygon
                    points="-6,-6 6,0 -6,6"
                    fill="#28b4ad"
                    transform={`translate(${arrowX}, ${arrowY}) rotate(${angle})`}
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              );
            })()}
          </svg>

          {nodes.map((node) => (
            <div 
              key={node.id} 
              className={`deployed-node ${selectedNodeIds.includes(node.id) ? 'selected' : ''}`} 
              style={{ 
                left: node.x, 
                top: node.y,
                zIndex: selectedNodeIds.includes(node.id) ? 10 : 5
              }}
            >
              <div className="node-header">
                <div className="node-type-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                  {getNodeIcon(node.type) ? (
                    <img src={getNodeIcon(node.type)!} alt={node.type} style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{node.type.charAt(0)}</span>
                  )}
                </div>
                <div className="node-info">
                  <div className="node-name">{node.name}</div>
                  <div className="node-sub">메인 {node.type} 서비스</div>
                </div>
              </div>
            </div>
          ))}
          
          {selection.active && (
            <div 
              className="selection-box" 
              style={{ 
                left: selection.x, 
                top: selection.y, 
                width: selection.width, 
                height: selection.height, 
                cursor: isSelectMode ? 'move' : 'default' 
              }}
            >
              <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
                <rect x="0" y="0" width="100%" height="100%" className="marching-ants-rect" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default Canvas;