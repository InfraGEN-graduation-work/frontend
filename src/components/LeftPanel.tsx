import React, { useState, useRef, useEffect } from 'react';
import type { NodeData, CloudProvider } from '../types';
import mysqlIcon from '../assets/mysql.png';
import springbootIcon from '../assets/springboot.png';
import redisIcon from '../assets/redis.png';

interface LeftPanelProps {
  projectName: string;
  onUpdateProjectName: (newName: string) => void;
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
  onGoHome: () => void;
  cloudProvider: CloudProvider;
  setCloudProvider: React.Dispatch<React.SetStateAction<CloudProvider>>;
  width: number;
  myRole?: string;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ 
  projectName, onUpdateProjectName, nodes, activeTab, setActiveTab, onSelectCategory, onToggleRightSidebar, 
  showRightSidebar, setShowRightSidebar,
  onZoomIn, onZoomOut, onSelectMode, onCancelSelection, onDelete, onUndo, onRedo, 
  canUndo, canRedo, isSelectMode, resetTrigger, userInfo, onGoHome,
  cloudProvider, setCloudProvider, width, myRole = 'OWNER'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCloudDropdownOpen, setIsCloudDropdownOpen] = useState(false);

  useEffect(() => { setTempName(projectName); }, [projectName]);

  useEffect(() => {
    if (resetTrigger > 0) {
      setActiveCategory(null);
      setSearchTerm('');
      setIsEditing(false);
      setIsCloudDropdownOpen(false);
    }
  }, [resetTrigger]);

  const nodeTemplates: Record<string, string[]> = {
    Server: ['Spring Boot'],
    Database: ['MySQL', 'Redis'] 
  };

  const getNodeCount = (type: string) => nodes.filter(node => node.type === type).length;
  const getCategoryCount = (category: string) => {
    const templates = nodeTemplates[category];
    return nodes.filter(node => templates.includes(node.type)).length;
  };

  const handleEditClick = () => { setIsEditing(true); setTempName(projectName); };
  
  const handleSaveClick = () => { 
    const trimmedName = tempName.trim();
    if (trimmedName && trimmedName !== projectName) onUpdateProjectName(trimmedName);
    else setTempName(projectName);
    setIsEditing(false); 
  };

  const handleTabClick = (tab: 'Project' | 'Settings' | 'Validation') => {
    setActiveTab(tab);
    setShowRightSidebar(true);
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
    if (type === 'Redis') return redisIcon;
    return '';
  };

  const handleDragStart = (e: React.DragEvent, nodeName: string) => {
    e.dataTransfer.setData('nodeType', nodeName);
    const dragGhost = document.createElement('div');
    dragGhost.className = 'deployed-node'; 
    dragGhost.style.position = 'absolute'; dragGhost.style.top = '-9999px'; dragGhost.style.left = '-9999px'; dragGhost.style.pointerEvents = 'none';

    const iconSrc = getNodeIconSrc(nodeName);
    const imgTag = iconSrc ? `<img src="${iconSrc}" alt="${nodeName}" style="width: 80%; height: 80%; object-fit: contain;" />` : `<span style="font-size:12px; font-weight:bold;">${nodeName.charAt(0)}</span>`;

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
    setTimeout(() => { if (document.body.contains(dragGhost)) document.body.removeChild(dragGhost); }, 0);
  };

  return (
    <aside className="left-panel" style={{ width: `${width}px`, flexShrink: 0 }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', marginBottom: '12px', borderBottom: '1px solid #e9ecef', minHeight: '32px' }}>
        {isEditing ? (
          <>
            <input
              ref={inputRef} type="text" value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveClick(); }}
              onBlur={handleSaveClick}
              style={{ flex: 1, padding: 0, margin: 0, border: 'none', background: 'transparent', outline: 'none', fontWeight: 700, fontSize: '16px', color: '#2c3e50', lineHeight: 1, width: '100%', fontFamily: 'inherit', minWidth: 0 }}
            />
            <button onMouseDown={(e) => e.preventDefault()} onClick={handleSaveClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '14px', color: '#28b4ad', flexShrink: 0 }}>✔</button>
          </>
        ) : (
          <>
            <span className="title" style={{ fontWeight: 700, fontSize: '16px', color: '#2c3e50', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, marginRight: '8px' }}>
              {projectName}
            </span>
            {myRole === 'OWNER' && (
              <button onClick={handleEditClick} className="icon-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0' }} title="이름 수정">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </button>
            )}
          </>
        )}
      </div>

      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <div
          onClick={() => {
            if (myRole !== 'OWNER') {
              window.dispatchEvent(new CustomEvent('global-toast', { detail: '클라우드 환경 옵션은 방장(OWNER)만 수정할 수 있습니다.' }));
              return;
            }
            setIsCloudDropdownOpen(!isCloudDropdownOpen);
          }}
          style={{ display:'flex', justifyContent:'space-between', alignItems: 'center', padding:'10px 14px', background:'#f8f9fa', border:'1px solid #e2e8f0', borderRadius:'8px', fontSize:'13px', fontWeight:600, color: '#4a5568', cursor: myRole === 'OWNER' ? 'pointer' : 'not-allowed', opacity: myRole === 'OWNER' ? 1 : 0.6, transition: '0.2s' }}
        >
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, marginRight: '8px' }}>
            {cloudProvider === 'AWS' ? 'AWS (Amazon Web Services)' : cloudProvider === 'OCI' ? 'OCI (Oracle Cloud)' : 'LOCAL (로컬 전용)'}
          </span>
          <span style={{ fontSize: '10px', transform: isCloudDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', flexShrink: 0 }}>▼</span>
        </div>
        
        {isCloudDropdownOpen && (
          <div style={{ position:'absolute', top:'100%', left:0, width:'100%', background:'white', border:'1px solid #e2e8f0', borderRadius:'8px', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', zIndex:100, marginTop:'6px', overflow:'hidden' }}>
            <div onClick={() => { setCloudProvider('LOCAL'); setIsCloudDropdownOpen(false); }} style={{ padding:'10px 14px', fontSize:'13px', cursor:'pointer', color: cloudProvider === 'LOCAL' ? '#28b4ad' : '#2d3748', fontWeight: cloudProvider === 'LOCAL' ? 'bold' : 'normal', borderBottom: '1px solid #edf2f7' }}>LOCAL (로컬 전용)</div>
            <div onClick={() => { setCloudProvider('AWS'); setIsCloudDropdownOpen(false); }} style={{ padding:'10px 14px', fontSize:'13px', cursor:'pointer', color: cloudProvider === 'AWS' ? '#28b4ad' : '#2d3748', fontWeight: cloudProvider === 'AWS' ? 'bold' : 'normal', borderBottom: '1px solid #edf2f7' }}>AWS (Amazon Web Services)</div>
            <div onClick={() => { setCloudProvider('OCI'); setIsCloudDropdownOpen(false); }} style={{ padding:'10px 14px', fontSize:'13px', cursor:'pointer', color: cloudProvider === 'OCI' ? '#28b4ad' : '#2d3748', fontWeight: cloudProvider === 'OCI' ? 'bold' : 'normal' }}>OCI (Oracle Cloud)</div>
          </div>
        )}
      </div>

      <div className="toolbar">
        <button onClick={onToggleRightSidebar} title="우측 패널">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>
        </button>
        <div className="divider"></div>
        <button onClick={onZoomIn} title="화면확대">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>
        <button onClick={onZoomOut} title="화면축소">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>
        <div className="divider"></div>
        <button onClick={onSelectMode} style={{ color: isSelectMode ? '#28b4ad' : '#555' }} title="영역선택">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
        </button>
        <button onClick={onCancelSelection} title="선택취소">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div className="divider"></div>
        <button onClick={onUndo} disabled={!canUndo} style={{ color: canUndo ? '#555' : '#ccc', cursor: canUndo ? 'pointer' : 'default' }} title="취소">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>
        </button>
        <button onClick={onRedo} disabled={!canRedo} style={{ color: canRedo ? '#555' : '#ccc', cursor: canRedo ? 'pointer' : 'default' }} title="다시실행">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 14 20 9 15 4"></polyline><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg>
        </button>
        <div className="divider"></div>
        <button onClick={onDelete} className="delete-btn" title="삭제">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>

      <div className="tabs">
        <div className={`tab ${showRightSidebar && activeTab === 'Project' ? 'active' : ''}`} onClick={() => handleTabClick('Project')}>Project</div>
        <div className={`tab ${showRightSidebar && activeTab === 'Settings' ? 'active' : ''}`} onClick={() => handleTabClick('Settings')}>Settings</div>
        <div className={`tab ${showRightSidebar && activeTab === 'Validation' ? 'active' : ''}`} onClick={() => handleTabClick('Validation')}>Validation</div>
      </div>

      <div className="search-bar" style={{ position: 'relative' }}>
        <input type="text" placeholder="노드 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingRight: '28px' }} />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a0aec0', fontSize: '12px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '-7px' }}>✕</button>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <div className="node-icon-small" style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                      {iconSrc ? <img src={iconSrc} alt={node} style={{ width: '80%', height: '80%', objectFit: 'contain' }} /> : <span style={{fontSize:'10px', fontWeight:'bold'}}>{node.charAt(0)}</span>}
                    </div>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{node}</span>
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
                    <span className="box-icon" style={{ flexShrink: 0 }}>●</span>
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
        <div className="user-info-wrapper" style={{ minWidth: 0 }}>
          <div className="user-avatar" style={{ flexShrink: 0 }}>{userInfo.nickname ? userInfo.nickname.charAt(0).toUpperCase() : '?'}</div>
          <div className="user-details" style={{ overflow: 'hidden' }}>
            <span className="user-nickname" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userInfo.nickname}</span>
            <span className="user-email" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userInfo.email}</span>
          </div>
        </div>
        <button className="home-icon-btn" onClick={onGoHome} title="홈으로 돌아가기" style={{ flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </button>
      </div>
    </aside>
  );
};

export default LeftPanel;