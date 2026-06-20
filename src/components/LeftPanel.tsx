import React, { useState, useRef, useEffect } from 'react';
import type { NodeData } from '../types';
import mysqlIcon from '../assets/mysql.png';
import springbootIcon from '../assets/springboot.png';

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
  userInfo: { nickname: string; email: string };
  onLogout: () => void;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ 
  projectName, setProjectName, nodes, activeTab, setActiveTab, onSelectCategory, onToggleRightSidebar, 
  showRightSidebar, setShowRightSidebar,
  onZoomIn, onZoomOut, onSelectMode, onCancelSelection, onDelete, onUndo, onRedo, 
  canUndo, canRedo, isSelectMode, resetTrigger, userInfo, onLogout
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
    Server: ['Spring Boot'],
    Database: ['MySQL'],
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
    if (activeTab === tab && showRightSidebar) {
      setShowRightSidebar(false);
    } else {
      setActiveTab(tab);
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

  const getNodeIconSrc = (type: string) => {
    if (type === 'MySQL') return mysqlIcon;
    if (type === 'Spring Boot') return springbootIcon;
    return '';
  };

  const handleDragStart = (e: React.DragEvent, nodeName: string) => {
    e.dataTransfer.setData('nodeType', nodeName);

    const dragGhost = document.createElement('div');
    dragGhost.className = 'deployed-node'; 
    dragGhost.style.position = 'absolute';
    dragGhost.style.top = '-9999px';
    dragGhost.style.left = '-9999px';
    dragGhost.style.pointerEvents = 'none';

<<<<<<< HEAD
=======
    // 고스트 이미지에 아이콘 적용
>>>>>>> e9d1a50109e7c50d519d53a0e37f636e3da4d0cf
    const iconSrc = getNodeIconSrc(nodeName);
    const imgTag = iconSrc ? `<img src="${iconSrc}" alt="${nodeName}" style="width: 80%; height: 80%; object-fit: contain;" />` : '';

    dragGhost.innerHTML = `
      <div class="node-header">
        <div class="node-type-icon" style="display: flex; justify-content: center; align-items: center; overflow: hidden;">
          ${imgTag}
        </div>
        <div class="node-info">
          <div class="node-name">${nodeName}</div>
          <div class="node-sub">메인 ${nodeName} 서비스</div>
        </div>
      </div>
    `;

    document.body.appendChild(dragGhost);
    e.dataTransfer.setDragImage(dragGhost, 90, 40);

    setTimeout(() => {
      if (document.body.contains(dragGhost)) {
        document.body.removeChild(dragGhost);
      }
    }, 0);
  };

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
              onBlur={handleSaveClick}
              style={{
                flex: 1, padding: 0, margin: 0, border: 'none', background: 'transparent', outline: 'none',
                fontWeight: 700, fontSize: '16px', color: '#2c3e50', lineHeight: 1, width: '100%', fontFamily: 'inherit'
              }}
            />
            <button 
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSaveClick} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '14px', color: '#28b4ad' }}
            >✔</button>
          </>
        ) : (
          <>
            <span className="title" style={{ fontWeight: 700, fontSize: '16px', color: '#2c3e50', lineHeight: 1, marginBottom: '2px' }}>{projectName}</span>
            <button onClick={handleEditClick} className="icon-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, marginBottom: '6px' }}>✏️</button>
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
        <div className={`tab ${showRightSidebar && activeTab === 'Project' ? 'active' : ''}`} onClick={() => handleTabClick('Project')}>Project</div>
        <div className={`tab ${showRightSidebar && activeTab === 'Settings' ? 'active' : ''}`} onClick={() => handleTabClick('Settings')}>Settings</div>
        <div className={`tab ${showRightSidebar && activeTab === 'Validation' ? 'active' : ''}`} onClick={() => handleTabClick('Validation')}>Validation</div>
      </div>

      <div className="search-bar" style={{ position: 'relative' }}>
        <input 
          type="text" 
          placeholder="노드에 대해 검색합니다..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ paddingRight: '28px' }} 
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#a0aec0',
              fontSize: '12px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '-7px' 
            }}
            title="검색어 지우기"
          >✕</button>
        )}
      </div>

      <div className="category-list">
        {activeCategory ? (
          <div className="node-detail-view">
            <div className="detail-back" onClick={() => { setActiveCategory(null); onSelectCategory(null); setSearchTerm(''); }} style={{ cursor: 'pointer', marginBottom: '0px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
              ← {activeCategory}
            </div>
            {filteredItems.map((node) => {
              const count = getNodeCount(node);
              const iconSrc = getNodeIconSrc(node);
              return (
                <div key={node} className="draggable-node-item" draggable onDragStart={(e) => handleDragStart(e, node)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <div className="node-icon-small" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                      {iconSrc && <img src={iconSrc} alt={node} style={{ width: '80%', height: '80%', objectFit: 'contain' }} />}
                    </div>
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

      <div className="user-profile-section">
        <div className="user-info-wrapper">
<<<<<<< HEAD
          <div className="user-avatar">{userInfo.nickname ? userInfo.nickname.charAt(0).toUpperCase() : '?'}</div>
          <div className="user-details">
            <span className="user-nickname">{userInfo.nickname}</span>
            <span className="user-email">{userInfo.email}</span>
=======
          {/*<div className="user-avatar">{userInfo.nickname.charAt(0)}</div>
          <div className="user-details">
            <span className="user-nickname">{userInfo.nickname}</span>
            <span className="user-email">{userInfo.email}</span>
          </div>*/}
          <div className="user-avatar">test</div>
          <div className="user-details">
            <span className="user-nickname">test</span>
            <span className="user-email">1234@1234.com</span>
>>>>>>> e9d1a50109e7c50d519d53a0e37f636e3da4d0cf
          </div>
        </div>
        <button className="logout-icon-btn" onClick={onLogout} title="로그아웃">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </aside>
  );
};

export default LeftPanel;