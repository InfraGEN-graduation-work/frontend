import React, { useState, useRef, useEffect } from 'react';
import type { NodeData } from '../types';

interface LeftPanelProps {
  projectName: string;
  setProjectName: (name: string) => void;
  nodes: NodeData[];
  activeTab: 'Project' | 'Settings' | 'Validation';
  setActiveTab: (tab: 'Project' | 'Settings' | 'Validation') => void;
  onSelectCategory: (cat: string | null) => void;
  onToggleRightSidebar: () => void;
  showRightSidebar: boolean;
  setShowRightSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSelectMode: () => void;
  onCancelSelection: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isSelectMode: boolean;
  resetTrigger: number;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ 
  projectName, setProjectName, nodes, activeTab, setActiveTab, onSelectCategory, onToggleRightSidebar, 
  showRightSidebar, setShowRightSidebar,
  onZoomIn, onZoomOut, onSelectMode, onCancelSelection, onDelete, onUndo, onRedo, 
  canUndo, canRedo, isSelectMode, resetTrigger
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (resetTrigger > 0) {
      setActiveCategory(null);
      setSearchTerm('');
      setIsEditing(false);
    }
  }, [resetTrigger]);

  const nodeTemplates: Record<string, string[]> = {
    Server: ['Spring Boot', 'Node.js', 'Go Server', 'Python Fast API'],
    Database: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis'],
    Storage: ['S3 Bucket', 'EFS', 'Block Storage'],
    Network: ['VPC', 'Subnet', 'Load Balancer']
  };

  const getNodeCount = (type: string) => nodes.filter(node => node.type === type).length;
  const getCategoryCount = (category: string) => {
    const templates = nodeTemplates[category];
    return nodes.filter(node => templates.includes(node.type)).length;
  };

  const handleEditClick = () => { setIsEditing(true); setTempName(projectName); };
  const handleSaveClick = () => { if (tempName.trim()) setProjectName(tempName); setIsEditing(false); };

  const handleTabClick = (tab: 'Project' | 'Settings' | 'Validation') => {
    setActiveTab(tab);
    if (!showRightSidebar) {
      setShowRightSidebar(true);
    }
  };

  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

  const getFilteredData = () => {
    const term = searchTerm.toLowerCase();
    if (activeCategory) {
      return nodeTemplates[activeCategory].filter(node => node.toLowerCase().includes(term));
    } else {
      return Object.keys(nodeTemplates).filter(cat => {
        const catMatch = cat.toLowerCase().includes(term);
        const childMatch = nodeTemplates[cat].some(node => node.toLowerCase().includes(term));
        return catMatch || childMatch;
      });
    }
  };

  const filteredItems = getFilteredData();

  return (
    <aside className="left-panel">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '4px', marginBottom: '12px', borderBottom: '1px solid #e9ecef', minHeight: '32px' }}>
        {isEditing ? (
          <>
            <input
              ref={inputRef}
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveClick(); }}
              style={{ flex: 1, padding: '4px 8px', marginRight: '8px', border: '1px solid #28b4ad', borderRadius: '4px', outline: 'none', fontWeight: 'bold', fontSize: '16px', width: '100%' }}
            />
            <button onClick={handleSaveClick} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✔</button>
          </>
        ) : (
          <>
            <span className="title" style={{ fontWeight: 700, fontSize: '16px', color: '#2c3e50', lineHeight: 1 }}>{projectName}</span>
            <button onClick={handleEditClick} className="icon-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>✏️</button>
          </>
        )}
      </div>

      <div className="toolbar">
        <button onClick={onToggleRightSidebar}>田</button>
        <div className="divider"></div>
        <button onClick={onZoomIn}>+</button>
        <button onClick={onZoomOut}>-</button>
        <div className="divider"></div>
        <button onClick={onSelectMode} style={{ color: isSelectMode ? '#28b4ad' : '#555' }}>▢</button>
        <button onClick={onCancelSelection}>×</button>
        <div className="divider"></div>
        <button onClick={onUndo} disabled={!canUndo} style={{ color: canUndo ? '#555' : '#ccc', cursor: canUndo ? 'pointer' : 'default' }}>◀</button>
        <button onClick={onRedo} disabled={!canRedo} style={{ color: canRedo ? '#555' : '#ccc', cursor: canRedo ? 'pointer' : 'default' }}>▶</button>
        <div className="divider"></div>
        <button onClick={onDelete} className="delete-btn">🗑️</button>
      </div>

      <div className="tabs">
        <div 
          className={`tab ${showRightSidebar && activeTab === 'Project' ? 'active' : ''}`} 
          onClick={() => handleTabClick('Project')}
        >Project</div>
        <div 
          className={`tab ${showRightSidebar && activeTab === 'Settings' ? 'active' : ''}`} 
          onClick={() => handleTabClick('Settings')}
        >Settings</div>
        <div 
          className={`tab ${showRightSidebar && activeTab === 'Validation' ? 'active' : ''}`} 
          onClick={() => handleTabClick('Validation')}
        >Validation</div>
      </div>

      <div className="search-bar">
        <input 
          type="text" 
          placeholder="노드에 대해 검색합니다..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="category-list">
        {activeCategory ? (
          <div className="node-detail-view">
            <div 
              className="detail-back" 
              onClick={() => { setActiveCategory(null); onSelectCategory(null); setSearchTerm(''); }} 
              style={{ cursor: 'pointer', marginBottom: '0px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}
            >
              ← {activeCategory}
            </div>
            {filteredItems.map((node) => {
              const count = getNodeCount(node);
              return (
                <div key={node} className="draggable-node-item" draggable onDragStart={(e) => e.dataTransfer.setData('nodeType', node)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <div className="node-icon-small"></div>
                    <span>{node}</span>
                  </div>
                  {count > 0 && <span className="badge">{count}</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="node-main-view">
            <div style={{ marginBottom: '10px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>NodeBox</div>
            {(filteredItems as string[]).map((cat) => {
              const count = getCategoryCount(cat);
              return (
                <div key={cat} className="category-item" onClick={() => { setActiveCategory(cat); onSelectCategory(cat); setSearchTerm(''); }}>
                  <div className="item-info">
                    <span className="box-icon">●</span>
                    <span className="item-name">{cat}</span>
                  </div>
                  {count > 0 && <span className="badge">{count}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};

export default LeftPanel;