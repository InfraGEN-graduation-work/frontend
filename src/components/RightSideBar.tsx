import React, { useState, useEffect, useRef } from 'react';
import type { NodeData, FileGroup, Edge, SelectionArea, CloudProvider, CloudSettings } from '../types';
import type { ViewportState } from '../MainPage';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const ENV_FORBIDDEN_CHARS = /["\\$\r\n\0]/;
const ENV_FORBIDDEN_LIST = ['"', '\\', '$', '\r', '\n', '\0'];
const ENV_BLOCKED_MESSAGE = '큰따옴표("), 백슬래시(\\), 달러 기호($)와 줄바꿈은 사용할 수 없습니다.';
const ENV_EXISTING_MESSAGE = '쓸 수 없는 문자가 들어 있습니다. 큰따옴표("), 백슬래시(\\), 달러 기호($)와 줄바꿈을 지워 주세요.';
const ENV_ERROR_SHOW_MS = 4000;
const addsForbiddenChar = (previous: string, next: string) =>
  ENV_FORBIDDEN_LIST.some(ch => next.split(ch).length > previous.split(ch).length);

const PasswordInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ style, ...inputProps }) => {
  const [isShown, setIsShown] = useState(false);
  const label = isShown ? '비밀번호 숨기기' : '비밀번호 보기';

  return (
    <div className="password-input-wrapper" style={{ position: 'relative', width: '100%' }}>
      <input {...inputProps} type={isShown ? 'text' : 'password'} style={{ ...style, paddingRight: '34px' }} />
      <button
        type="button"
        className="password-toggle-btn"
        aria-label={label}
        title={label}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setIsShown(prev => !prev)}
      >
        {isShown ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        )}
      </button>
    </div>
  );
};

const CLOUD_NAME_RULE = '영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.';
const CLOUD_COMMON_HINTS: Record<string, string> = {
  vpcName: `내 서버만 쓰는 전용 공간의 이름입니다. ${CLOUD_NAME_RULE}`,
  vpcCidr: '전용 공간의 주소 범위입니다. 비우면 10.0.0.0/16으로 만들어집니다.',
  subnetName: `서버가 놓일 작은 구역의 이름입니다. ${CLOUD_NAME_RULE}`,
  subnetCidr: '작은 구역의 주소 범위입니다. 비우면 10.0.1.0/24로 만들어집니다.',
  internetGatewayName: `전용 공간과 인터넷을 잇는 출입구 이름입니다. ${CLOUD_NAME_RULE}`,
  routeTableName: `서버가 오가는 길을 적은 표의 이름입니다. ${CLOUD_NAME_RULE}`,
  instanceName: `만들어질 서버의 이름입니다. ${CLOUD_NAME_RULE}`,
  adminCidr: '서버 관리 접속을 허용할 곳입니다. 내 PC만 허용하려면 내 PC 주소 뒤에 /32를 붙이세요.',
  appCidr: '서비스 접속을 허용할 곳입니다. 누구나 쓰게 하려면 0.0.0.0/0을 넣으세요.'
};
const CLOUD_HINTS: Record<'AWS' | 'OCI', Record<string, string>> = {
  AWS: {
    ...CLOUD_COMMON_HINTS,
    region: '서버를 둘 지역입니다. 바꾸면 AMI ID도 그 지역 것으로 바꿔야 합니다.',
    securityGroupName: `서버 접속을 막고 여는 규칙 묶음의 이름입니다. ${CLOUD_NAME_RULE}`,
    instanceType: '서버의 성능입니다. 비우면 t3.micro로 만들어집니다.',
    amiId: '서버에 깔릴 운영체제입니다. 목록에 있는 값은 서울 지역용이고, 다른 지역이나 운영체제를 쓰려면 AWS EC2 화면에서 지역을 고른 뒤 [인스턴스 시작]에서 운영체제를 선택했을 때 보이는 ami-로 시작하는 ID를 넣으세요.'
  },
  OCI: {
    ...CLOUD_COMMON_HINTS,
    region: '서버를 둘 지역입니다. 바꾸면 Image ID도 그 지역 것으로 바꿔야 합니다.',
    compartmentId: '자원을 나눠 담는 구획(폴더)의 ID로, 만들어질 서버와 전용 공간이 이 구획 안에 생깁니다. OCI 화면 왼쪽 위 메뉴에서 [Identity & Security]의 [Compartments]로 들어가 ID를 눌러 복사하면 되고, 맨 위 기본 구획을 쓰려면 오른쪽 위 프로필의 [Tenancy]에서 복사하면 됩니다.',
    securityGroupName: `서버 접속을 막고 여는 규칙 목록의 이름입니다. ${CLOUD_NAME_RULE}`,
    hostnameLabel: '서버를 부르는 짧은 이름입니다. 영문 소문자와 숫자로 써 주세요.',
    availabilityDomain: '서버가 놓일 데이터센터입니다. 서울·춘천은 1을 고르세요.',
    instanceType: '서버의 성능입니다. 비우면 VM.Standard.E2.1.Micro로 만들어집니다.',
    amiId: '만들어질 서버에 설치될 운영체제의 ID로, 지역마다 값이 다릅니다. docs.oracle.com/iaas/images에서 운영체제를 고르면 지역별 ID 표가 나오니, 내 지역 줄의 값(ocid1.image로 시작)을 복사해 넣으세요.',
    sshAuthorizedKeys: '서버에 관리하러 들어갈 때 쓰는 공개 키(.pub)입니다. 생성되는 클라우드 설정 파일에 들어가, 서버가 만들어지면 짝이 되는 비밀 키로 접속하게 됩니다. 키가 없다면 터미널(윈도우는 PowerShell)에서 ssh-keygen -t rsa -b 2048 을 실행해 엔터를 계속 누른 뒤, cat ~/.ssh/id_rsa.pub 로 나온 한 줄을 그대로 붙여 넣으세요. 비밀 키는 절대 넣지 마세요.'
  }
};

interface RightSideBarProps {
  projectName: string;
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
  width: number;
  isViewer?: boolean;
  canRename?: boolean;
  logActivity: (msg: string) => void;
  highlightFieldRequest?: { fields: string[]; token: number } | null;
  onNodeNameChange?: (nodeId: string, newName: string) => void;
}

const RightSideBar: React.FC<RightSideBarProps> = ({ 
  projectName, nodes, setNodes, edges, activeTab, setActiveTab, saveHistory, files, setFiles, targetFileIds, markFilesAsModified, deleteRightPanelItems,
  selectedFileId, setSelectedFileId, setSelectedNodeIds, selectedNodeIds, viewport, zoomLevel, setFocusNodeId, validationErrors, resetTrigger,
  setSelection, setIsSelectMode, cloudProvider, includeLocal, setIncludeLocal, cloudSettings, setCloudSettings, width, isViewer = false, canRename, logActivity,
  highlightFieldRequest, onNodeNameChange
}) => {
  const canEditName = canRename ?? !isViewer;
  const [dragOverFileId, setDragOverFileId] = useState<string | null>(null);
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);
  const [isDragOverUnassigned, setIsDragOverUnassigned] = useState(false);
  
  const [isUnassignedCollapsed, setIsUnassignedCollapsed] = useState(false);

  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null);
  const [highlightedFields, setHighlightedFields] = useState<string[]>([]);
  const nameBeforeEdit = useRef<{ id: string; name: string } | null>(null);
  const [collapsedErrorGroups, setCollapsedErrorGroups] = useState<string[]>([]);
  const [envInputError, setEnvInputError] = useState<{ nodeId: string; key: string; at: number } | null>(null);

  useEffect(() => {
    if (!envInputError) return;
    const timer = window.setTimeout(() => setEnvInputError(null), ENV_ERROR_SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [envInputError]);

  const clearCanvasSelectionArea = () => {
    setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
    setIsSelectMode(false);
  };

  useEffect(() => {
    if (resetTrigger > 0) {
      setIsMultiSelectMode(false);
      setCheckedItems(new Set());
      setIsUnassignedCollapsed(true);
      setOpenDropdownKey(null);
      setHighlightedFields([]);
      setCollapsedErrorGroups([]); 
    }
  }, [resetTrigger, targetFileIds]);

  useEffect(() => {
    if (!highlightFieldRequest || highlightFieldRequest.fields.length === 0) return;
    const { fields } = highlightFieldRequest;

    const t1 = setTimeout(() => {
      setHighlightedFields(fields);
      const el = document.getElementById(`field-${fields[0]}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    const t2 = setTimeout(() => {
      setHighlightedFields([]);
    }, 1650);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [highlightFieldRequest]);

  const unassignedNodes = nodes.filter((canvasNode) => !files.some((file) => file.nodeIds.includes(canvasNode.id)));

  const handleDragOver = (e: React.DragEvent) => {
    if (isViewer) return;
    e.preventDefault();
  };

  const handleNodeDragStart = (e: React.DragEvent, nodeId: string) => {
    if (isViewer) { e.preventDefault(); return; }
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

  const handleDropNodeToFile = (e: React.DragEvent, fileId: string) => {
    if (isViewer) return;
    e.preventDefault();
    e.stopPropagation();
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
    if (isViewer) return;
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

  const toggleMainExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFiles(prev => prev.map(f => f.id === id ? { ...f, isExpanded: !f.isExpanded } : f));
  };

  const toggleFileCheck = (fileId: string, childNodeIds: string[]) => {
    if (isViewer) return;
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
    if (isViewer) return;
    const newChecked = new Set(checkedItems);
    if (newChecked.has(nodeId)) newChecked.delete(nodeId);
    else newChecked.add(nodeId);
    setCheckedItems(newChecked);
  };

  const handleDeleteItems = () => {
    if (isViewer) return;
    const fileIdsToDelete = files.map(f => f.id).filter(id => checkedItems.has(id));
    const nodeIdsToDelete = nodes.map(n => n.id).filter(id => checkedItems.has(id));
    deleteRightPanelItems(fileIdsToDelete, nodeIdsToDelete);
    setCheckedItems(new Set()); 
  };

  const handleDownloadItems = () => {
    if (isViewer) return;
    const hasFileSelected = files.some(f => checkedItems.has(f.id));
    const hasNodeSelected = nodes.some(n => checkedItems.has(n.id));

    if (!hasFileSelected && hasNodeSelected) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '코드가 생성된 파일 단위로만 다운로드 할 수 있습니다.' }));
      return;
    }

    const selectedFiles = files.filter(f => checkedItems.has(f.id));
    const filesWithCode = selectedFiles.filter(f => f.generatedFiles && f.generatedFiles.length > 0);

    if (filesWithCode.length > 0) {
      const zip = new JSZip();
      filesWithCode.forEach(fileGroup => {
        const gFiles = fileGroup.generatedFiles || [];
        gFiles.forEach(gf => {
          zip.file(`${projectName}/${gf.fileName}`, gf.content);
        });
      });

      zip.generateAsync({ type: "blob" }).then(content => {
        saveAs(content, `${projectName}-infragen-export.zip`);
        cancelSelectionMode(); 
      });
    } else {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '다운로드할 코드가 없습니다. Generate 버튼으로 코드를 먼저 생성해 주세요.' }));
    }
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
    if (isViewer) return;
    saveHistory();
    setCloudSettings(prev => ({ ...prev, [key]: value }));
    markFilesAsModified();
    logActivity(`[설정] 클라우드 배포 환경 설정이 변경되었습니다.`);
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
        setHighlightedFields([err.targetField]);
        const el = document.getElementById(`field-${err.targetField}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        setTimeout(() => {
          setHighlightedFields([]);
        }, 1500); 
      }, 150);
    }
  };

  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, padding: '8px', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '12px', color: '#2d3748', outline: 'none' };
  const hintStyle = { marginTop: '6px', fontSize: '11px', color: '#718096', lineHeight: 1.5, wordBreak: 'keep-all' as const };
  const cloudHint = (key: string) => <span style={hintStyle}>{CLOUD_HINTS[cloudProvider === 'AWS' ? 'AWS' : 'OCI'][key]}</span>;

  const renderComboInput = (key: keyof CloudSettings, options: {label: string, value: string}[], placeholder: string = '') => {
    const isOpen = openDropdownKey === key;
    const isHighlighted = highlightedFields.includes(key);
    return (
      <div style={{ position: 'relative', width: '100%' }} id={`field-${key}`}>
        <div className={`combo-input-wrapper ${isHighlighted ? 'highlight-flash' : ''}`} style={{ display: 'flex', border: '1px solid #cbd5e0', borderRadius: '6px', background: isViewer ? '#f8f9fa' : 'white', overflow: 'hidden', boxSizing: 'border-box' }}>
          <input
            type="text"
            className="custom-input"
            value={cloudSettings[key] || ''}
            placeholder={placeholder}
            onChange={e => updateGlobalSetting(key, e.target.value)}
            onFocus={() => { if (!isViewer) { setOpenDropdownKey(key); saveHistory(); } }}
            readOnly={isViewer}
            style={{ flex: 1, minWidth: 0, padding: '8px', border: 'none', outline: 'none', fontSize: '12px', color: isViewer ? '#718096' : '#2d3748', boxSizing: 'border-box', background: 'transparent' }}
          />
          <div
            onClick={(e) => { e.stopPropagation(); if (isViewer) return; setOpenDropdownKey(isOpen ? null : key); }}
            style={{ width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', borderLeft: '1px solid #cbd5e0', cursor: isViewer ? 'not-allowed' : 'pointer', color: '#4a5568', fontSize: '10px' }}
          >
            ▼
          </div>
        </div>
        {!isViewer && isOpen && (
          <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, marginTop: '4px', maxHeight: '180px', overflowY: 'auto' }}>
            {options.map(opt => (
              <div
                key={opt.value}
                onClick={(e) => { e.stopPropagation(); updateGlobalSetting(key, opt.value); setOpenDropdownKey(null); }}
                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #edf2f7' }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f0fdfc'}
                onMouseOut={(e) => e.currentTarget.style.background = 'white'}
              >
                <strong style={{ display: 'block', color: '#28b4ad', fontSize: '12px', marginBottom: '2px', whiteSpace: 'normal', wordBreak: 'keep-all' }}>{opt.value}</strong>
                <span style={{ fontSize: '11px', color: '#718096', whiteSpace: 'normal', wordBreak: 'keep-all' }}>{opt.label}</span>
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

  const validationErrorsForRightPanel = validationErrors;

  const globalErrorsRightPanel = validationErrorsForRightPanel.filter(e => e.isGlobal || !e.targetNodeId);
  const nodeErrorsMapRightPanel = new Map<string, typeof validationErrorsForRightPanel>();
  
  validationErrorsForRightPanel.forEach(e => {
    if (!e.isGlobal && e.targetNodeId) {
      if (!nodeErrorsMapRightPanel.has(e.targetNodeId)) nodeErrorsMapRightPanel.set(e.targetNodeId, []);
      nodeErrorsMapRightPanel.get(e.targetNodeId)!.push(e);
    }
  });

  const toggleErrorGroup = (groupId: string) => {
    setCollapsedErrorGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  return (
    <aside className="right-sidebar" onClick={handleBackgroundClick} style={{ width: `${width}px`, flexShrink: 0 }}>
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
          background: #feebc8;
          border-color: #fbd38d;
        }

        .viewer-input {
          background-color: #f8f9fa !important;
          color: #718096 !important;
          cursor: not-allowed !important;
        }

        .password-input-wrapper input::-ms-reveal,
        .password-input-wrapper input::-ms-clear {
          display: none;
        }
        .password-toggle-btn {
          position: absolute;
          top: 50%;
          right: 6px;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          padding: 0;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: #a0aec0;
          cursor: pointer;
          transition: 0.2s;
        }
        .password-toggle-btn:hover {
          color: #4a5568;
          background: #edf2f7;
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
            {!isViewer && (
              <button className="select-mode-btn" title="선택" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { 
                e.stopPropagation(); 
                const nextMode = !isMultiSelectMode;
                setIsMultiSelectMode(nextMode); setCheckedItems(new Set()); 
                if (nextMode) { setSelectedNodeIds([]); setSelectedFileId(null); clearCanvasSelectionArea(); }
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
            )}
          </div>
          <div className="tree-content">
            
            <div id="field-target-file-box" className="file-list-container" style={{ padding: 0, border: 'none', background: 'transparent' }}>
              {files.length === 0 ? (
                 <div 
                   className={`file-box ${isDragOverTarget ? 'drag-over' : ''} ungenerated`}
                   style={{ minHeight: '80px', display: 'flex', flexDirection: 'column' }}
                   onDragOver={handleDragOver}
                   onDragEnter={() => { if (!isViewer) setIsDragOverTarget(true); }}
                   onDragLeave={() => { if (!isViewer) setIsDragOverTarget(false); }}
                   onDrop={(e) => {
                     if (isViewer) return;
                     e.preventDefault();
                     e.stopPropagation();
                     setIsDragOverTarget(false);
                     const data = e.dataTransfer.getData('rightBarNodeIds');
                     if (data) {
                       const nodeIds: string[] = JSON.parse(data);
                       saveHistory();
                       markFilesAsModified();
                       setFiles([{ id: `file-${Date.now()}`, name: '생성할 노드 목록', isGenerated: false, nodeIds, isExpanded: true }]);
                       if (isMultiSelectMode) setCheckedItems(new Set());
                     }
                   }}
                 >
                   <div className="file-header">
                     <span className="toggle-icon">▼</span>
                     <div className="file-name-editable" style={{ cursor: 'default' }}>생성할 노드 목록</div>
                   </div>
                   <div className="file-children" style={{ flex: 1, justifyContent: 'center' }}>
                     <div className="empty-drop-zone">노드를 드래그하여 추가하세요.</div>
                   </div>
                 </div>
              ) : (
                 files.map(file => (
                   <div 
                     key={file.id} 
                     className={`file-box ${dragOverFileId === file.id ? 'drag-over' : ''} ${!file.isGenerated ? 'ungenerated' : ''} ${isMultiSelectMode ? (checkedItems.has(file.id) ? 'selected' : '') : (selectedFileId === file.id ? 'selected' : '')}`} 
                     onDragOver={handleDragOver} 
                     onDragEnter={() => { if (!isViewer) setDragOverFileId(file.id); }} 
                     onDragLeave={() => { if (!isViewer) setDragOverFileId(null); }} 
                     onDrop={(e) => { if (!isViewer) { e.stopPropagation(); handleDropNodeToFile(e, file.id); } }}
                   >
                     <div className="file-header" onClick={(e) => handleFileClick(e, file.id, file.nodeIds)}>
                       <span className="toggle-icon" onClick={(e) => { e.stopPropagation(); toggleMainExpand(e, file.id); }}>{file.isExpanded ? '▼' : '▶'}</span>
                       <div className="file-name-editable" style={{ cursor: 'default' }}>{file.name}</div>
                     </div>

                     {file.isExpanded && (
                       <div className="file-children">
                         {file.nodeIds.map(nodeId => {
                           const node = nodes.find(n => n.id === nodeId);
                           if (!node) return null;
                           return (
                             <div key={node.id} className={`tree-node-item assigned ${isMultiSelectMode ? (checkedItems.has(node.id) ? 'selected' : '') : (selectedFileId === null && selectedNodeIds.includes(node.id) ? 'selected' : '')}`} draggable={!isViewer} onDragStart={(e) => handleNodeDragStart(e, node.id)} onClick={(e) => handleNodeClick(e, node.id)} style={{ display: 'flex', alignItems: 'center' }}>● {node.name}</div>
                           );
                         })}
                         {file.nodeIds.length === 0 && <div className="empty-drop-zone">노드가 없습니다.</div>}
                       </div>
                     )}
                   </div>
                 ))
              )}
            </div>

            <div className={`unassigned-box ${isDragOverUnassigned ? 'drag-over' : ''}`} onDragOver={handleDragOver} onDragEnter={() => { if (!isViewer) setIsDragOverUnassigned(true); }} onDragLeave={() => { if (!isViewer) setIsDragOverUnassigned(false); }} onDrop={handleDropToUnassigned}>
              <div className="unassigned-title" onClick={(e) => { e.stopPropagation(); setIsUnassignedCollapsed(!isUnassignedCollapsed); }}>
                <span className="toggle-icon" style={{ marginRight: '6px', fontSize: '10px' }}>{isUnassignedCollapsed ? '▶' : '▼'}</span>
                낱개로 배치된 Node
              </div>
              {!isUnassignedCollapsed && (
                <div className="unassigned-children">
                  {unassignedNodes.map((node) => (
                    <div key={node.id} className={`tree-node-item unassigned ${isMultiSelectMode ? (checkedItems.has(node.id) ? 'selected' : '') : (selectedFileId === null && selectedNodeIds.includes(node.id) ? 'selected' : '')}`} draggable={!isViewer} onDragStart={(e) => handleNodeDragStart(e, node.id)} onClick={(e) => handleNodeClick(e, node.id)} style={{ display: 'flex', alignItems: 'center' }}>● {node.name}</div>
                  ))}
                  {unassignedNodes.length === 0 && <div className="empty-info-zone">제외된 노드가 없습니다</div>}
                </div>
              )}
            </div>
          </div>
          
          {isMultiSelectMode && !isViewer && (
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
          <div className="tree-title">Settings {isViewer && <span style={{fontSize:'11px', color:'#e53e3e', fontWeight:'normal'}}>{canEditName ? '(노드 이름만 수정 가능)' : '(보기 전용)'}</span>}</div>
          <div className="settings-content">

            {cloudProvider !== 'LOCAL' && (
              <>
                <div className="node-settings-section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', marginBottom: '0px' }}>
                  <div className="setting-section-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    기본 배포 설정 (Local)
                  </div>
                  <div className="setting-row" style={{ marginBottom: 0 }}>
                    <label>로컬 환경(Docker Compose, .env) 구성 생성</label>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: isViewer ? 'not-allowed' : 'pointer', fontSize: '13px', color: '#2d3748', fontWeight: 'normal', opacity: isViewer ? 0.6 : 1 }}>
                        <input type="radio" name="localGen" checked={includeLocal} disabled={isViewer} onChange={() => { if(!isViewer) { saveHistory(); setIncludeLocal(true); markFilesAsModified(); } }} />
                        생성함 (포함)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: isViewer ? 'not-allowed' : 'pointer', fontSize: '13px', color: '#2d3748', fontWeight: 'normal', opacity: isViewer ? 0.6 : 1 }}>
                        <input type="radio" name="localGen" checked={!includeLocal} disabled={isViewer} onChange={() => { if(!isViewer) { saveHistory(); setIncludeLocal(false); markFilesAsModified(); } }} />
                        생성 안함
                      </label>
                    </div>
                    <span style={hintStyle}>생성함을 고르면 내 PC용 파일(local 폴더)도 함께 만들어집니다.</span>
                  </div>
                </div>

                <div className="node-settings-section" style={{ marginTop: '16px', marginBottom: '24px' }}>
                  <div className="setting-section-title" style={{ color: cloudProvider === 'AWS' ? '#dd6b20' : '#c53030' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                      <path d="M17.5 19c2.485 0 4.5-2.015 4.5-4.5S19.985 10 17.5 10c-.167 0-.33.013-.489.038A6.5 6.5 0 1 0 5.674 13.92C3.125 14.152 1 16.326 1 19c0 2.761 2.239 5 5 5h11c2.485 0 4.5-2.015 4.5-4.5z"></path>
                    </svg>
                    {cloudProvider} 글로벌 배포 설정 (IaC)
                  </div>

                  {cloudProvider === 'AWS' ? (
                    <>
                      <div className="setting-row">
                        <label>Region <span style={{color:'red'}}>*</span></label>
                        {renderComboInput('region', awsRegions, 'ap-northeast-2')}
                        {cloudHint('region')}
                      </div>
                      <div className="setting-row">
                        <label>VPC Name <span style={{color:'red'}}>*</span></label>
                        <input id="field-vpcName" type="text" className={`custom-input ${highlightedFields.includes('vpcName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.vpcName} placeholder="my-vpc" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('vpcName', e.target.value)} />
                        {cloudHint('vpcName')}
                      </div>
                      <div className="setting-row">
                        <label>VPC CIDR</label>
                        <input id="field-vpcCidr" type="text" className={`custom-input ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.vpcCidr} placeholder="10.0.0.0/16" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('vpcCidr', e.target.value)} />
                        {cloudHint('vpcCidr')}
                      </div>
                      <div className="setting-row">
                        <label>Subnet Name <span style={{color:'red'}}>*</span></label>
                        <input id="field-subnetName" type="text" className={`custom-input ${highlightedFields.includes('subnetName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.subnetName} placeholder="my-subnet" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('subnetName', e.target.value)} />
                        {cloudHint('subnetName')}
                      </div>
                      <div className="setting-row">
                        <label>Subnet CIDR</label>
                        <input id="field-subnetCidr" type="text" className={`custom-input ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.subnetCidr} placeholder="10.0.1.0/24" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('subnetCidr', e.target.value)} />
                        {cloudHint('subnetCidr')}
                      </div>
                      <div className="setting-row">
                        <label>Internet Gateway Name <span style={{color:'red'}}>*</span></label>
                        <input id="field-internetGatewayName" type="text" className={`custom-input ${highlightedFields.includes('internetGatewayName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.internetGatewayName} placeholder="my-igw" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('internetGatewayName', e.target.value)} />
                        {cloudHint('internetGatewayName')}
                      </div>
                      <div className="setting-row">
                        <label>Route Table Name <span style={{color:'red'}}>*</span></label>
                        <input id="field-routeTableName" type="text" className={`custom-input ${highlightedFields.includes('routeTableName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.routeTableName} placeholder="my-rt" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('routeTableName', e.target.value)} />
                        {cloudHint('routeTableName')}
                      </div>
                      <div className="setting-row">
                        <label>Security Group Name <span style={{color:'red'}}>*</span></label>
                        <input id="field-securityGroupName" type="text" className={`custom-input ${highlightedFields.includes('securityGroupName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.securityGroupName} placeholder="my-sg" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('securityGroupName', e.target.value)} />
                        {cloudHint('securityGroupName')}
                      </div>
                      <div className="setting-row">
                        <label>Instance Name <span style={{color:'red'}}>*</span></label>
                        <input id="field-instanceName" type="text" className={`custom-input ${highlightedFields.includes('instanceName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.instanceName} placeholder="my-instance" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('instanceName', e.target.value)} />
                        {cloudHint('instanceName')}
                      </div>
                      <div className="setting-row">
                        <label>Instance Type</label>
                        {renderComboInput('instanceType', awsInstanceTypes, 't3.micro')}
                        {cloudHint('instanceType')}
                      </div>
                      <div className="setting-row">
                        <label>AMI ID <span style={{color:'red'}}>*</span></label>
                        {renderComboInput('amiId', awsAmis, 'ami-084e92d3e117f7692')}
                        {cloudHint('amiId')}
                      </div>
                      <div className="setting-row">
                        <label>Admin CIDR <span style={{color:'red'}}>*</span></label>
                        <input id="field-adminCidr" type="text" className={`custom-input ${highlightedFields.includes('adminCidr') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.adminCidr} placeholder="0.0.0.0/0" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('adminCidr', e.target.value)} />
                        {cloudHint('adminCidr')}
                      </div>
                      <div className="setting-row">
                        <label>App CIDR <span style={{color:'red'}}>*</span></label>
                        <input id="field-appCidr" type="text" className={`custom-input ${highlightedFields.includes('appCidr') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.appCidr} placeholder="0.0.0.0/0" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('appCidr', e.target.value)} />
                        {cloudHint('appCidr')}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="setting-row">
                        <label>Region <span style={{color:'red'}}>*</span></label>
                        {renderComboInput('region', ociRegions, 'ap-seoul-1')}
                        {cloudHint('region')}
                      </div>
                      <div className="setting-row">
                        <label>Compartment ID <span style={{color:'red'}}>*</span></label>
                        <input id="field-compartmentId" type="text" className={`custom-input ${highlightedFields.includes('compartmentId') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.compartmentId || ''} placeholder="ocid1.compartment..." style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('compartmentId', e.target.value)} />
                        {cloudHint('compartmentId')}
                      </div>
                      <div className="setting-row">
                        <label>VCN Name <span style={{color:'red'}}>*</span></label>
                        <input id="field-vpcName" type="text" className={`custom-input ${highlightedFields.includes('vpcName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.vpcName} placeholder="my-vcn" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('vpcName', e.target.value)} />
                        {cloudHint('vpcName')}
                      </div>
                      <div className="setting-row">
                        <label>VCN CIDR</label>
                        <input id="field-vpcCidr" type="text" className={`custom-input ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.vpcCidr} placeholder="10.0.0.0/16" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('vpcCidr', e.target.value)} />
                        {cloudHint('vpcCidr')}
                      </div>
                      <div className="setting-row">
                        <label>Subnet Name <span style={{color:'red'}}>*</span></label>
                        <input id="field-subnetName" type="text" className={`custom-input ${highlightedFields.includes('subnetName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.subnetName} placeholder="my-subnet" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('subnetName', e.target.value)} />
                        {cloudHint('subnetName')}
                      </div>
                      <div className="setting-row">
                        <label>Subnet CIDR</label>
                        <input id="field-subnetCidr" type="text" className={`custom-input ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.subnetCidr} placeholder="10.0.1.0/24" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('subnetCidr', e.target.value)} />
                        {cloudHint('subnetCidr')}
                      </div>
                      <div className="setting-row">
                        <label>Internet Gateway Name <span style={{color:'red'}}>*</span></label>
                        <input id="field-internetGatewayName" type="text" className={`custom-input ${highlightedFields.includes('internetGatewayName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.internetGatewayName} placeholder="my-igw" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('internetGatewayName', e.target.value)} />
                        {cloudHint('internetGatewayName')}
                      </div>
                      <div className="setting-row">
                        <label>Route Table Name <span style={{color:'red'}}>*</span></label>
                        <input id="field-routeTableName" type="text" className={`custom-input ${highlightedFields.includes('routeTableName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.routeTableName} placeholder="my-rt" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('routeTableName', e.target.value)} />
                        {cloudHint('routeTableName')}
                      </div>
                      <div className="setting-row">
                        <label>Security List Name <span style={{color:'red'}}>*</span></label>
                        <input id="field-securityGroupName" type="text" className={`custom-input ${highlightedFields.includes('securityGroupName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.securityGroupName} placeholder="my-sl" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('securityGroupName', e.target.value)} />
                        {cloudHint('securityGroupName')}
                      </div>
                      <div className="setting-row">
                        <label>Instance Name <span style={{color:'red'}}>*</span></label>
                        <input id="field-instanceName" type="text" className={`custom-input ${highlightedFields.includes('instanceName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.instanceName} placeholder="my-instance" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('instanceName', e.target.value)} />
                        {cloudHint('instanceName')}
                      </div>
                      <div className="setting-row">
                        <label>Hostname Label <span style={{color:'red'}}>*</span></label>
                        <input id="field-hostnameLabel" type="text" className={`custom-input ${highlightedFields.includes('hostnameLabel') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.hostnameLabel || ''} placeholder="myhost" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('hostnameLabel', e.target.value)} />
                        {cloudHint('hostnameLabel')}
                      </div>
                      <div className="setting-row">
                        <label>Availability Domain <span style={{color:'red'}}>*</span></label>
                        {renderComboInput('availabilityDomain', ociADs, 'AD-1')}
                        {cloudHint('availabilityDomain')}
                      </div>
                      <div className="setting-row">
                        <label>Shape</label>
                        {renderComboInput('instanceType', ociShapes, 'VM.Standard.E2.1.Micro')}
                        {cloudHint('instanceType')}
                      </div>
                      <div className="setting-row">
                        <label>Image ID <span style={{color:'red'}}>*</span></label>
                        <input id="field-amiId" type="text" className={`custom-input ${highlightedFields.includes('amiId') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.amiId} placeholder="ocid1.image..." style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('amiId', e.target.value)} />
                        {cloudHint('amiId')}
                      </div>
                      <div className="setting-row">
                        <label>Admin CIDR <span style={{color:'red'}}>*</span></label>
                        <input id="field-adminCidr" type="text" className={`custom-input ${highlightedFields.includes('adminCidr') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.adminCidr} placeholder="0.0.0.0/0" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('adminCidr', e.target.value)} />
                        {cloudHint('adminCidr')}
                      </div>
                      <div className="setting-row">
                        <label>App CIDR <span style={{color:'red'}}>*</span></label>
                        <input id="field-appCidr" type="text" className={`custom-input ${highlightedFields.includes('appCidr') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.appCidr} placeholder="0.0.0.0/0" style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('appCidr', e.target.value)} />
                        {cloudHint('appCidr')}
                      </div>
                      <div className="setting-row">
                        <label>SSH Authorized Keys <span style={{color:'red'}}>*</span></label>
                        <input id="field-sshAuthorizedKeys" type="text" className={`custom-input ${highlightedFields.includes('sshAuthorizedKeys') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={cloudSettings.sshAuthorizedKeys || ''} placeholder="ssh-rsa AAA..." style={inputStyle} readOnly={isViewer} onChange={e => updateGlobalSetting('sshAuthorizedKeys', e.target.value)} />
                        {cloudHint('sshAuthorizedKeys')}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {selectedNodeIds.length === 1 ? (
              (() => {
                const selectedNode = nodes.find(n => n.id === selectedNodeIds[0]);
                if (!selectedNode) return null;
                const settings = (selectedNode as any).settings || {};
                
                const updateSetting = (key: string, value: string) => {
                  if (isViewer) return;
                  setNodes(prev => prev.map(n => 
                    n.id === selectedNode.id ? { ...n, settings: { ...((n as any).settings || {}), [key]: value } } : n
                  ));
                  markFilesAsModified();
                  logActivity(`[설정] '${selectedNode.name}' 노드의 설정이 변경되었습니다.`);
                };

                const updateEnvSetting = (key: string, value: string) => {
                  if (isViewer) return;
                  const previous = typeof settings[key] === 'string' ? settings[key] : '';
                  if (addsForbiddenChar(previous, value)) {
                    setEnvInputError({ nodeId: selectedNode.id, key, at: Date.now() });
                    return;
                  }
                  if (envInputError?.nodeId === selectedNode.id && envInputError.key === key) setEnvInputError(null);
                  updateSetting(key, value);
                };

                const pasteEnvSetting = (key: string) => (e: React.ClipboardEvent<HTMLInputElement>) => {
                  if (isViewer) return;
                  const text = e.clipboardData.getData('text');
                  if (!ENV_FORBIDDEN_CHARS.test(text)) return;
                  e.preventDefault();
                  const core = text.replace(/^[\r\n]+|[\r\n]+$/g, '');
                  if (ENV_FORBIDDEN_CHARS.test(core)) {
                    setEnvInputError({ nodeId: selectedNode.id, key, at: Date.now() });
                    return;
                  }
                  const input = e.currentTarget;
                  const start = input.selectionStart ?? input.value.length;
                  const end = input.selectionEnd ?? input.value.length;
                  updateEnvSetting(key, input.value.slice(0, start) + core + input.value.slice(end));
                  const caret = start + core.length;
                  requestAnimationFrame(() => {
                    try { input.setSelectionRange(caret, caret); } catch (err) {}
                  });
                };

                const envHint = (key: string, text: string) => {
                  const value = settings[key];
                  if (typeof value === 'string' && ENV_FORBIDDEN_CHARS.test(value)) {
                    return <span className="env-char-error" style={{ ...hintStyle, color: '#e53e3e' }}>{ENV_EXISTING_MESSAGE}</span>;
                  }
                  if (envInputError?.nodeId === selectedNode.id && envInputError.key === key) {
                    return <span className="env-char-error" style={{ ...hintStyle, color: '#e53e3e' }}>{ENV_BLOCKED_MESSAGE}</span>;
                  }
                  return <span style={hintStyle}>{text}</span>;
                };

                return (
                  <div 
                    className="node-settings-section" 
                    style={cloudProvider === 'LOCAL' ? { marginTop: '4px', paddingTop: '24px' } : {}}
                  >
                    <div className="setting-section-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      </svg>
                      {selectedNode.type} 노드 세부 설정
                    </div>
                    
                    <div className="setting-row">
                      <label>노드 이름 (화면 표시용)</label>
                      <input id="field-displayName" type="text" className={`custom-input ${!canEditName ? 'viewer-input' : ''}`} value={selectedNode.name} 
                        onFocus={() => { nameBeforeEdit.current = { id: selectedNode.id, name: selectedNode.name }; }}
                        onBlur={() => {
                          const before = nameBeforeEdit.current;
                          nameBeforeEdit.current = null;
                          if (!canEditName || selectedNode.name.trim()) return;
                          const restored = before && before.id === selectedNode.id && before.name.trim() ? before.name : selectedNode.type;
                          setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, name: restored } : n));
                          if (onNodeNameChange) onNodeNameChange(selectedNode.id, restored);
                          window.dispatchEvent(new CustomEvent('global-toast', { detail: '노드 이름은 비워 둘 수 없어서 원래 이름으로 되돌렸습니다.' }));
                        }}
                        onChange={(e) => {
                          if (!canEditName) return;
                          const newName = e.target.value;
                          setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, name: newName } : n));
                          if (onNodeNameChange) onNodeNameChange(selectedNode.id, newName);
                          markFilesAsModified();
                          if (newName.trim()) logActivity(`[수정] 노드의 화면 표시 이름이 '${newName}'(으)로 변경되었습니다.`);
                        }}
                        style={inputStyle} readOnly={!canEditName}
                      />
                    </div>

                    {selectedNode.type === 'MySQL' ? (
                      <>
                        <div className="setting-row">
                          <label>서비스 이름 (name) <span style={{color:'red'}}>*</span></label>
                          <input id="field-name" type="text" className={`custom-input ${highlightedFields.includes('name') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.name || ''} placeholder="mysql_service" onChange={(e) => updateSetting('name', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>도커 이미지 버전 <span style={{color:'red'}}>*</span></label>
                          <select id="field-imageVersion" className={`custom-input ${highlightedFields.includes('imageVersion') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.imageVersion || ''} onChange={(e) => updateSetting('imageVersion', e.target.value)} style={inputStyle} disabled={isViewer}>
                            <option value="" disabled>버전을 선택하세요</option>
                            <option value="mysql:latest">mysql : latest</option>
                            <option value="mysql:8.4">mysql : 8.4</option>
                            <option value="mysql:8.0">mysql : 8.0</option>
                            <option value="mysql:5.7">mysql : 5.7</option>
                          </select>
                        </div>
                        <div className="setting-row">
                          <label>컨테이너 이름 (containerName) <span style={{color:'red'}}>*</span></label>
                          <input id="field-containerName" type="text" className={`custom-input ${highlightedFields.includes('containerName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.containerName || ''} placeholder="mysql_container" onChange={(e) => updateSetting('containerName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>포트 번호 (port) <span style={{color:'red'}}>*</span></label>
                          <input id="field-port" type="text" className={`custom-input ${highlightedFields.includes('port') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.port !== undefined ? settings.port : ''} placeholder="기본값: 3306" onChange={(e) => updateSetting('port', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>내 PC에서 MySQL에 접속할 때 쓰는 포트입니다. PC에서 MySQL을 이미 실행 중이면 3307처럼 다른 번호로 바꿔 주세요.</span>
                        </div>
                        <div className="setting-row">
                          <label>볼륨 이름 (volumeName)</label>
                          <input id="field-volumeName" type="text" className={`custom-input ${isViewer ? 'viewer-input' : ''}`} value={settings.volumeName || ''} placeholder="volume" onChange={(e) => updateSetting('volumeName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>DB 데이터를 보관할 볼륨 이름입니다. 지정해 두면 컨테이너를 다시 만들어도 데이터가 남습니다.</span>
                        </div>

                        <div className="setting-section-title" style={{ marginTop: '24px', marginBottom: '12px', fontSize: '12px', color: '#e53e3e' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', marginTop: '-2px' }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                          데이터베이스 설정 (env)
                        </div>
                        <div className="setting-row">
                          <label>데이터베이스 이름 (databaseName) <span style={{color:'red'}}>*</span></label>
                          <input id="field-databaseName" type="text" className={`custom-input ${highlightedFields.includes('databaseName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.databaseName || ''} placeholder="appdb" onChange={(e) => updateSetting('databaseName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>영문, 숫자, 언더바(_)만 사용할 수 있습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>사용자 이름 (username) <span style={{color:'red'}}>*</span></label>
                          <input id="field-username" type="text" className={`custom-input ${highlightedFields.includes('username') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.username || ''} placeholder="dbuser" onChange={(e) => updateEnvSetting('username', e.target.value)} onPaste={pasteEnvSetting('username')} style={inputStyle} readOnly={isViewer} />
                          {envHint('username', 'MySQL에 새로 만들어지는 사용자 계정입니다. 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있고, root는 관리자 계정 이름이라 쓸 수 없습니다.')}
                        </div>
                        <div className="setting-row">
                          <label>사용자 비밀번호 (userPassword) <span style={{color:'red'}}>*</span></label>
                          <PasswordInput key={`${selectedNode.id}-userPassword`} id="field-userPassword" className={`custom-input ${highlightedFields.includes('userPassword') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.userPassword || ''} placeholder="user password" onChange={(e) => updateEnvSetting('userPassword', e.target.value)} onPaste={pasteEnvSetting('userPassword')} style={inputStyle} readOnly={isViewer} />
                          {envHint('userPassword', '위 사용자 계정의 비밀번호입니다. 큰따옴표("), 백슬래시(\\), 달러 기호($)와 줄바꿈은 쓸 수 없습니다.')}
                        </div>
                        <div className="setting-row">
                          <label>루트 비밀번호 (rootPassword) <span style={{color:'red'}}>*</span></label>
                          <PasswordInput key={`${selectedNode.id}-rootPassword`} id="field-rootPassword" className={`custom-input ${highlightedFields.includes('rootPassword') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.rootPassword || ''} placeholder="root password" onChange={(e) => updateEnvSetting('rootPassword', e.target.value)} onPaste={pasteEnvSetting('rootPassword')} style={inputStyle} readOnly={isViewer} />
                          {envHint('rootPassword', 'MySQL 관리자(root) 계정의 비밀번호입니다. 8자 이상 입력해 주세요. 큰따옴표("), 백슬래시(\\), 달러 기호($)와 줄바꿈은 쓸 수 없습니다.')}
                        </div>
                      </>
                    ) : selectedNode.type === 'Redis' ? (
                      <>
                        <div className="setting-row">
                          <label>서비스 이름 (name) <span style={{color:'red'}}>*</span></label>
                          <input id="field-name" type="text" className={`custom-input ${highlightedFields.includes('name') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.name || ''} placeholder="redis_service" onChange={(e) => updateSetting('name', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>도커 이미지 버전 <span style={{color:'red'}}>*</span></label>
                          <select id="field-imageVersion" className={`custom-input ${highlightedFields.includes('imageVersion') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.imageVersion || ''} onChange={(e) => updateSetting('imageVersion', e.target.value)} style={inputStyle} disabled={isViewer}>
                            <option value="" disabled>버전을 선택하세요</option>
                            <option value="redis:latest">redis : latest</option>
                            <option value="redis:7.0">redis : 7.0</option>
                            <option value="redis:6.2">redis : 6.2</option>
                          </select>
                        </div>
                        <div className="setting-row">
                          <label>컨테이너 이름 (containerName) <span style={{color:'red'}}>*</span></label>
                          <input id="field-containerName" type="text" className={`custom-input ${highlightedFields.includes('containerName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.containerName || ''} placeholder="redis_container" onChange={(e) => updateSetting('containerName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>포트 번호 (port) <span style={{color:'red'}}>*</span></label>
                          <input id="field-port" type="text" className={`custom-input ${highlightedFields.includes('port') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.port !== undefined ? settings.port : ''} placeholder="기본값: 6379" onChange={(e) => updateSetting('port', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>내 PC에서 Redis에 접속할 때 쓰는 포트입니다. PC에서 Redis를 이미 실행 중이면 6380처럼 다른 번호로 바꿔 주세요.</span>
                        </div>
                        <div className="setting-row">
                          <label>볼륨 이름 (volumeName)</label>
                          <input id="field-volumeName" type="text" className={`custom-input ${isViewer ? 'viewer-input' : ''}`} value={settings.volumeName || ''} placeholder="volume" onChange={(e) => updateSetting('volumeName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>DB 데이터를 보관할 볼륨 이름입니다. 지정해 두면 컨테이너를 다시 만들어도 데이터가 남습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>비밀번호 (password) <span style={{color:'red'}}>*</span></label>
                          <PasswordInput key={`${selectedNode.id}-password`} id="field-password" className={`custom-input ${highlightedFields.includes('password') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.password || ''} placeholder="redis password" onChange={(e) => updateEnvSetting('password', e.target.value)} onPaste={pasteEnvSetting('password')} style={inputStyle} readOnly={isViewer} />
                          {envHint('password', 'Redis 접속 비밀번호입니다. 큰따옴표("), 백슬래시(\\), 달러 기호($)와 줄바꿈은 쓸 수 없습니다.')}
                        </div>
                      </>
                    ) : selectedNode.type === 'PostgreSQL' ? (
                      <>
                        <div className="setting-row">
                          <label>도커 이미지 버전 <span style={{color:'red'}}>*</span></label>
                          <select id="field-imageVersion" className={`custom-input ${highlightedFields.includes('imageVersion') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.imageVersion || ''} onChange={(e) => updateSetting('imageVersion', e.target.value)} style={inputStyle} disabled={isViewer}>
                            <option value="" disabled>버전을 선택하세요</option>
                            <option value="postgres:17">postgres : 17</option>
                            <option value="postgres:16">postgres : 16</option>
                            <option value="postgres:15">postgres : 15</option>
                            <option value="postgres:latest">postgres : latest</option>
                          </select>
                        </div>
                        <div className="setting-row">
                          <label>컨테이너 이름 (containerName)</label>
                          <input id="field-containerName" type="text" className={`custom-input ${highlightedFields.includes('containerName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.containerName || ''} placeholder="비우면 기본 이름으로 생성" onChange={(e) => updateSetting('containerName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>비우면 기본 이름으로 만들어집니다. 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>포트 번호 (port) <span style={{color:'red'}}>*</span></label>
                          <input id="field-port" type="text" className={`custom-input ${highlightedFields.includes('port') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.port !== undefined ? settings.port : ''} placeholder="기본값: 5432" onChange={(e) => updateSetting('port', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>내 PC에 열리는 포트입니다. 컨테이너 안쪽은 5432로 고정이라, PC에서 PostgreSQL을 이미 실행 중이면 5433처럼 다른 번호로 바꿔 주세요.</span>
                        </div>
                        <div className="setting-row">
                          <label>볼륨 이름 (volumeName)</label>
                          <input id="field-volumeName" type="text" className={`custom-input ${isViewer ? 'viewer-input' : ''}`} value={settings.volumeName || ''} placeholder="비우면 볼륨 없이 생성" onChange={(e) => updateSetting('volumeName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>DB 데이터를 보관할 볼륨 이름입니다. 비우면 볼륨 없이 만들어져, 컨테이너를 지우면 데이터도 함께 사라집니다.</span>
                        </div>

                        <div className="setting-section-title" style={{ marginTop: '24px', marginBottom: '12px', fontSize: '12px', color: '#e53e3e' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', marginTop: '-2px' }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                          데이터베이스 설정 (env)
                        </div>
                        <div className="setting-row">
                          <label>데이터베이스 이름 (databaseName) <span style={{color:'red'}}>*</span></label>
                          <input id="field-databaseName" type="text" className={`custom-input ${highlightedFields.includes('databaseName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.databaseName || ''} placeholder="appdb" onChange={(e) => updateSetting('databaseName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>영문, 숫자, 언더바(_)만 사용할 수 있습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>사용자 이름 (username) <span style={{color:'red'}}>*</span></label>
                          <input id="field-username" type="text" className={`custom-input ${highlightedFields.includes('username') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.username || ''} placeholder="appuser" onChange={(e) => updateEnvSetting('username', e.target.value)} onPaste={pasteEnvSetting('username')} style={inputStyle} readOnly={isViewer} />
                          {envHint('username', 'PostgreSQL에서는 이 계정이 관리자 계정입니다. 큰따옴표("), 백슬래시(\\), 달러 기호($)와 줄바꿈은 쓸 수 없습니다.')}
                        </div>
                        <div className="setting-row">
                          <label>비밀번호 (password) <span style={{color:'red'}}>*</span></label>
                          <PasswordInput key={`${selectedNode.id}-password`} id="field-password" className={`custom-input ${highlightedFields.includes('password') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.password || ''} placeholder="8자 이상" onChange={(e) => updateEnvSetting('password', e.target.value)} onPaste={pasteEnvSetting('password')} style={inputStyle} readOnly={isViewer} />
                          {envHint('password', '위 사용자 계정의 비밀번호입니다. 8자 이상 입력해 주세요. 큰따옴표("), 백슬래시(\\), 달러 기호($)와 줄바꿈은 쓸 수 없습니다.')}
                        </div>
                      </>
                    ) : selectedNode.type === 'MongoDB' ? (
                      <>
                        <div className="setting-row">
                          <label>도커 이미지 버전 <span style={{color:'red'}}>*</span></label>
                          <select id="field-imageVersion" className={`custom-input ${highlightedFields.includes('imageVersion') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.imageVersion || ''} onChange={(e) => updateSetting('imageVersion', e.target.value)} style={inputStyle} disabled={isViewer}>
                            <option value="" disabled>버전을 선택하세요</option>
                            <option value="mongo:8.0">mongo : 8.0</option>
                            <option value="mongo:7.0">mongo : 7.0</option>
                            <option value="mongo:6.0">mongo : 6.0</option>
                            <option value="mongo:latest">mongo : latest</option>
                          </select>
                        </div>
                        <div className="setting-row">
                          <label>컨테이너 이름 (containerName)</label>
                          <input id="field-containerName" type="text" className={`custom-input ${highlightedFields.includes('containerName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.containerName || ''} placeholder="비우면 mongo로 생성" onChange={(e) => updateSetting('containerName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>비우면 mongo라는 이름으로 만들어집니다. 클라우드 배포에서는 쓰이지 않습니다. 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>포트 번호 (port) <span style={{color:'red'}}>*</span></label>
                          <input id="field-port" type="text" className={`custom-input ${highlightedFields.includes('port') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.port !== undefined ? settings.port : ''} placeholder="기본값: 27017" onChange={(e) => updateSetting('port', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>내 PC에 열리는 포트입니다. 컨테이너 안쪽은 27017로 고정이라, PC에서 MongoDB를 이미 실행 중이면 27018처럼 다른 번호로 바꿔 주세요.</span>
                        </div>
                        <div className="setting-row">
                          <label>볼륨 이름 (volumeName)</label>
                          <input id="field-volumeName" type="text" className={`custom-input ${isViewer ? 'viewer-input' : ''}`} value={settings.volumeName || ''} placeholder="비우면 볼륨 없이 생성" onChange={(e) => updateSetting('volumeName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>DB 데이터를 보관할 볼륨 이름입니다. 비우면 볼륨 없이 만들어져, 컨테이너를 지우면 데이터도 함께 사라집니다.</span>
                        </div>

                        <div className="setting-section-title" style={{ marginTop: '24px', marginBottom: '12px', fontSize: '12px', color: '#e53e3e' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', marginTop: '-2px' }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                          데이터베이스 설정 (env)
                        </div>
                        <div className="setting-row">
                          <label>데이터베이스 이름 (databaseName) <span style={{color:'red'}}>*</span></label>
                          <input id="field-databaseName" type="text" className={`custom-input ${highlightedFields.includes('databaseName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.databaseName || ''} placeholder="appdb" onChange={(e) => updateSetting('databaseName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>앱이 접속할 DB 이름입니다. 영문, 숫자, 언더바(_)만 사용할 수 있습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>사용자 이름 (username) <span style={{color:'red'}}>*</span></label>
                          <input id="field-username" type="text" className={`custom-input ${highlightedFields.includes('username') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.username || ''} placeholder="appuser" onChange={(e) => updateEnvSetting('username', e.target.value)} onPaste={pasteEnvSetting('username')} style={inputStyle} readOnly={isViewer} />
                          {envHint('username', '앱이 MongoDB에 접속할 때 쓰는 계정입니다. 큰따옴표("), 백슬래시(\\), 달러 기호($)와 줄바꿈은 쓸 수 없습니다.')}
                        </div>
                        <div className="setting-row">
                          <label>비밀번호 (password) <span style={{color:'red'}}>*</span></label>
                          <PasswordInput key={`${selectedNode.id}-password`} id="field-password" className={`custom-input ${highlightedFields.includes('password') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.password || ''} placeholder="8자 이상" onChange={(e) => updateEnvSetting('password', e.target.value)} onPaste={pasteEnvSetting('password')} style={inputStyle} readOnly={isViewer} />
                          {envHint('password', '위 사용자 계정의 비밀번호입니다. 8자 이상 입력해 주세요. 큰따옴표("), 백슬래시(\\), 달러 기호($)와 줄바꿈은 쓸 수 없습니다.')}
                        </div>
                      </>
                    ) : selectedNode.type === 'Spring Boot' ? (
                      <>
                        <div className="setting-row">
                          <label>서비스 이름 (name) <span style={{color:'red'}}>*</span></label>
                          <input id="field-name" type="text" className={`custom-input ${highlightedFields.includes('name') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.name || ''} placeholder="spring_service" onChange={(e) => updateSetting('name', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>Java 버전 <span style={{color:'red'}}>*</span></label>
                          <select id="field-javaVersion" className={`custom-input ${highlightedFields.includes('javaVersion') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.javaVersion || ''} onChange={(e) => updateSetting('javaVersion', e.target.value)} style={inputStyle} disabled={isViewer}>
                            <option value="" disabled>버전 선택</option>
                            <option value="11">Java 11</option>
                            <option value="17">Java 17</option>
                            <option value="21">Java 21</option>
                          </select>
                        </div>
                        <div className="setting-row">
                          <label>컨테이너 이름 (containerName) <span style={{color:'red'}}>*</span></label>
                          <input id="field-containerName" type="text" className={`custom-input ${highlightedFields.includes('containerName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.containerName || ''} placeholder="spring_container" onChange={(e) => updateSetting('containerName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>포트 번호 (port) <span style={{color:'red'}}>*</span></label>
                          <input id="field-port" type="text" className={`custom-input ${highlightedFields.includes('port') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.port !== undefined ? settings.port : ''} placeholder="기본값: 8080" onChange={(e) => updateSetting('port', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>Spring Boot 애플리케이션이 사용할 포트입니다. 다른 노드와 같은 번호는 쓸 수 없습니다.</span>
                        </div>
                      </>
                    ) : selectedNode.type === 'Node.js' ? (
                      <>
                        <div className="setting-row">
                          <label>서비스 이름 (name) <span style={{color:'red'}}>*</span></label>
                          <input id="field-name" type="text" className={`custom-input ${highlightedFields.includes('name') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.name || ''} placeholder="node_service" onChange={(e) => updateSetting('name', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>Node.js 버전 <span style={{color:'red'}}>*</span></label>
                          <select id="field-nodeVersion" className={`custom-input ${highlightedFields.includes('nodeVersion') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.nodeVersion || ''} onChange={(e) => updateSetting('nodeVersion', e.target.value)} style={inputStyle} disabled={isViewer}>
                            <option value="" disabled>버전 선택</option>
                            <option value="20">Node.js 20</option>
                            <option value="22">Node.js 22</option>
                            <option value="24">Node.js 24</option>
                          </select>
                          <span style={hintStyle}>앱을 실행할 Node.js 버전입니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>컨테이너 이름 (containerName)</label>
                          <input id="field-containerName" type="text" className={`custom-input ${highlightedFields.includes('containerName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.containerName || ''} placeholder="선택 입력" onChange={(e) => updateSetting('containerName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>필요할 때만 입력하면 됩니다. 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>포트 번호 (port) <span style={{color:'red'}}>*</span></label>
                          <input id="field-port" type="text" className={`custom-input ${highlightedFields.includes('port') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.port !== undefined ? settings.port : ''} placeholder="기본값: 3000" onChange={(e) => updateSetting('port', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>Node.js 앱이 사용할 포트입니다. 다른 노드와 같은 번호는 쓸 수 없습니다.</span>
                        </div>
                      </>
                    ) : selectedNode.type === 'Nginx' ? (
                      <>
                        <div className="setting-row">
                          <label>도커 이미지 버전 <span style={{color:'red'}}>*</span></label>
                          <select id="field-imageVersion" className={`custom-input ${highlightedFields.includes('imageVersion') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.imageVersion || ''} onChange={(e) => updateSetting('imageVersion', e.target.value)} style={inputStyle} disabled={isViewer}>
                            <option value="" disabled>버전을 선택하세요</option>
                            <option value="nginx:1.27">nginx : 1.27</option>
                            <option value="nginx:stable">nginx : stable</option>
                            <option value="nginx:latest">nginx : latest</option>
                          </select>
                        </div>
                        <div className="setting-row">
                          <label>컨테이너 이름 (containerName)</label>
                          <input id="field-containerName" type="text" className={`custom-input ${highlightedFields.includes('containerName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.containerName || ''} placeholder="비우면 nginx로 생성" onChange={(e) => updateSetting('containerName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>비우면 nginx라는 이름으로 만들어집니다. 영문이나 숫자로 시작하고, 영문, 숫자, 점(.), 하이픈(-), 언더스코어(_)만 쓸 수 있습니다. 다른 노드의 컨테이너 이름과 겹치면 안 됩니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>포트 번호 (port) <span style={{color:'red'}}>*</span></label>
                          <input id="field-port" type="text" className={`custom-input ${highlightedFields.includes('port') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.port !== undefined ? settings.port : ''} placeholder="기본값: 80" onChange={(e) => updateSetting('port', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>밖에서 접속할 때 쓰는 포트입니다. 1부터 65535까지 쓸 수 있고, 다른 노드와 같은 번호는 쓸 수 없습니다. 내 PC에서 80번을 이미 쓰고 있으면 8000처럼 다른 번호로 바꿔 주세요.</span>
                        </div>
                      </>
                    ) : selectedNode.type === 'Caddy' ? (
                      <>
                        <div className="setting-row">
                          <span style={{ ...hintStyle, marginTop: 0 }}>Caddy는 클라우드 배포(AWS·OCI)에서만 쓸 수 있고, 80번과 443번 포트를 그대로 씁니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>도커 이미지 버전 <span style={{color:'red'}}>*</span></label>
                          <select id="field-imageVersion" className={`custom-input ${highlightedFields.includes('imageVersion') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.imageVersion || ''} onChange={(e) => updateSetting('imageVersion', e.target.value)} style={inputStyle} disabled={isViewer}>
                            <option value="" disabled>버전을 선택하세요</option>
                            <option value="caddy:2">caddy : 2</option>
                            <option value="caddy:2.8">caddy : 2.8</option>
                            <option value="caddy:latest">caddy : latest</option>
                          </select>
                        </div>
                        <div className="setting-row">
                          <label>도메인 (domain)</label>
                          <input id="field-domain" type="text" className={`custom-input ${highlightedFields.includes('domain') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.domain || ''} placeholder="example.com (선택)" onChange={(e) => updateSetting('domain', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>비우면 HTTP(80번)로만 접속됩니다. 넣으면 HTTPS 인증서가 자동으로 발급됩니다. example.com처럼 점이 들어간 주소만 쓸 수 있고, https://, IP 주소, localhost는 쓸 수 없습니다.</span>
                        </div>
                        <div className="setting-row">
                          <label>볼륨 이름 (volumeName) {String(settings.domain || '').trim() && <span style={{color:'red'}}>*</span>}</label>
                          <input id="field-volumeName" type="text" className={`custom-input ${highlightedFields.includes('volumeName') ? 'highlight-flash' : ''} ${isViewer ? 'viewer-input' : ''}`} value={settings.volumeName || ''} placeholder="caddy_data" onChange={(e) => updateSetting('volumeName', e.target.value)} style={inputStyle} readOnly={isViewer} />
                          <span style={hintStyle}>HTTPS 인증서를 보관하는 곳의 이름입니다. 도메인을 넣었다면 꼭 입력해야 합니다. 영문이나 숫자로 시작하고, 영문, 숫자, 점(.), 하이픈(-), 언더스코어(_)만 쓸 수 있습니다.</span>
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
            {globalErrorsRightPanel.length > 0 || nodeErrorsMapRightPanel.size > 0 ? (
              <div className="error-list">
                {globalErrorsRightPanel.length > 0 && (
                  <div className="error-group">
                    <div className="error-group-header" onClick={() => toggleErrorGroup('global')}>
                      <span className="toggle-icon" style={{ marginRight: '8px', fontSize: '10px', color: '#9b2c2c' }}>
                        {collapsedErrorGroups.includes('global') ? '▶' : '▼'}
                      </span>
                      프로젝트 & 클라우드 설정
                    </div>
                    {!collapsedErrorGroups.includes('global') && (
                      <div className="error-group-content">
                        {globalErrorsRightPanel.map((err, idx) => (
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

                {Array.from(nodeErrorsMapRightPanel.entries()).map(([nodeId, errs]) => {
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