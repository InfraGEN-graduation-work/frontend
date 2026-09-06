import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import './MainPage.css';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import Canvas from './components/Canvas';
import RightSideBar from './components/RightSideBar';
import Generate from './components/Generate'; 
import type { NodeData, SelectionArea, Edge, FileGroup, CloudProvider, CloudSettings } from './types';
import Tutorial from './components/Tutorial';
import { useAuth } from './contexts/AuthContext';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://infragen.kro.kr/api/v1';

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

const toastAnimation = keyframes`
  0% { opacity: 0; transform: translate(-50%, 20px); }
  15% { opacity: 1; transform: translate(-50%, 0); }
  85% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, 20px); }
`;

const ToastNotification = styled.div`
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #4a5568;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 9999;
  animation: ${toastAnimation} 3s ease forwards;
`;

const MainPage: React.FC = () => {
  const { projectId } = useParams(); 
  const navigate = useNavigate();
  const { fetchWithAuth, isAutoSaveEnabled } = useAuth();

  const [showTutorial, setShowTutorial] = useState(false);
  const [userInfo, setUserInfo] = useState({ nickname: '로딩중...', email: '로딩중...' });

  const [projectName, setProjectName] = useState('로딩중...');
  const [projectDescription, setProjectDescription] = useState('');

  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('AWS');
  const [includeLocal, setIncludeLocal] = useState<boolean>(true); 
  const [cloudSettings, setCloudSettings] = useState<CloudSettings>({
    region: 'ap-northeast-2',
    vpcName: 'my-vpc',
    subnetName: 'my-subnet',
    internetGatewayName: 'my-igw',
    routeTableName: 'my-rt',
    securityGroupName: 'my-sg',
    instanceName: 'my-instance',
    vpcCidr: '10.0.0.0/16',
    subnetCidr: '10.0.1.0/24',
    amiId: 'ami-12345678',
    instanceType: 't3.micro',
    adminCidr: '0.0.0.0/0',
    appCidr: '0.0.0.0/0',
    hostnameLabel: 'myhost',
    compartmentId: 'ocid1.compartment.oc1..',
    availabilityDomain: 'AD-1',
    sshAuthorizedKeys: ''
  });

  const [, setSelectedCategory] = useState<string | null>(null);
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
  const [activeSubTab, setActiveSubTab] = useState(0);
  
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
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isDataLoaded = useRef(false);
  const isUndoRedo = useRef(false);
  const hasUnsavedChanges = useRef(false);
  const autoSaveCallback = useRef<(() => void) | null>(null);

  // ==========================================
  // 유효성 검사 (Validation) 로직 
  // ==========================================
  const validationErrors: { name: string; desc: string }[] = [];
  
  if (nodes.length === 0) {
    validationErrors.push({ name: '노드 미배치', desc: '캔버스에 노드를 1개 이상 배치해야 합니다.' });
  }
  if (targetFileIds.length === 0) {
    validationErrors.push({ name: '생성 대상 없음', desc: '생성할 파일 목록(Target)에 폴더를 배치하지 않았습니다.' });
  }

  // 1. 노드별 세팅 누락 검사
  nodes.forEach(node => {
    const settings = node.settings || {};
    if (node.type === 'MySQL' && !settings.imageVersion) {
      validationErrors.push({ name: 'MySQL 버전 누락', desc: `'${node.name}' 노드의 [도커 이미지 버전]을 Settings 탭에서 선택해주세요.` });
    }
    if (node.type === 'Redis' && !settings.imageVersion) {
      validationErrors.push({ name: 'Redis 버전 누락', desc: `'${node.name}' 노드의 [도커 이미지 버전]을 Settings 탭에서 선택해주세요.` });
    }
    if (node.type === 'Spring Boot' && !settings.javaVersion) {
      validationErrors.push({ name: 'Spring Boot 버전 누락', desc: `'${node.name}' 노드의 [Java 버전]을 Settings 탭에서 선택해주세요.` });
    }
  });

  // 2. 노드 간 연결 규칙 검증 ("MySQL·Redis에서 Spring Boot 방향으로 연결합니다")
  edges.forEach(edge => {
    const sNode = nodes.find(n => n.id === edge.sourceId);
    const tNode = nodes.find(n => n.id === edge.targetId);
    if (sNode && tNode) {
      const isSourceDb = sNode.type === 'MySQL' || sNode.type === 'Redis';
      const isTargetServer = tNode.type === 'Spring Boot';

      // 만약 Spring Boot가 소스이거나 DB가 타겟이면 잘못된 연결
      if (!isSourceDb || !isTargetServer) {
        validationErrors.push({
          name: '잘못된 노드 연결 방향',
          desc: `'${sNode.name}'(${sNode.type})에서 '${tNode.name}'(${tNode.type})로 연결되었습니다. 인프라 연결은 Database(MySQL/Redis)에서 Spring Boot 방향이어야 합니다.`
        });
      }
    }
  });

  // 3. 동일 타입 DB 중복 연결 검사
  const springNodes = nodes.filter(n => n.type === 'Spring Boot');
  springNodes.forEach(springNode => {
    const connectedMysqlCount = edges.filter(e => {
      const s = nodes.find(n => n.id === e.sourceId);
      const t = nodes.find(n => n.id === e.targetId);
      return (s?.id === springNode.id || t?.id === springNode.id) && (s?.type === 'MySQL' || t?.type === 'MySQL');
    }).length;

    if (connectedMysqlCount > 1) {
      validationErrors.push({ name: 'MySQL 중복 연결', desc: `'${springNode.name}'에 MySQL이 2개 이상 연결되어 있습니다. (1개만 허용)` });
    }

    const connectedRedisCount = edges.filter(e => {
      const s = nodes.find(n => n.id === e.sourceId);
      const t = nodes.find(n => n.id === e.targetId);
      return (s?.id === springNode.id || t?.id === springNode.id) && (s?.type === 'Redis' || t?.type === 'Redis');
    }).length;

    if (connectedRedisCount > 1) {
      validationErrors.push({ name: 'Redis 중복 연결', desc: `'${springNode.name}'에 Redis가 2개 이상 연결되어 있습니다. (1개만 허용)` });
    }
  });

  // 4. 클라우드 필수 글로벌 설정 누락 검사
  if (cloudProvider === 'AWS') {
    const requiredAws = [
      { key: 'region', label: 'Region' }, { key: 'vpcName', label: 'VPC Name' }, { key: 'subnetName', label: 'Subnet Name' },
      { key: 'internetGatewayName', label: 'IGW Name' }, { key: 'routeTableName', label: 'Route Table Name' },
      { key: 'securityGroupName', label: 'Security Group Name' }, { key: 'instanceName', label: 'Instance Name' },
      { key: 'amiId', label: 'AMI ID' }, { key: 'adminCidr', label: 'Admin CIDR' }, { key: 'appCidr', label: 'App CIDR' }
    ];
    requiredAws.forEach(({ key, label }) => {
      if (!String(cloudSettings[key as keyof CloudSettings] || '').trim()) {
        validationErrors.push({ name: `AWS 필수값 누락`, desc: `Settings 탭에서 [${label}] 값을 입력하세요.` });
      }
    });
  } else if (cloudProvider === 'OCI') {
    const requiredOci = [
      { key: 'region', label: 'Region' }, { key: 'vpcName', label: 'VCN Name' }, { key: 'subnetName', label: 'Subnet Name' },
      { key: 'internetGatewayName', label: 'IGW Name' }, { key: 'routeTableName', label: 'Route Table Name' },
      { key: 'securityGroupName', label: 'Security List Name' }, { key: 'instanceName', label: 'Instance Name' },
      { key: 'hostnameLabel', label: 'Hostname' }, { key: 'compartmentId', label: 'Compartment ID' },
      { key: 'availabilityDomain', label: 'Availability Domain' }, { key: 'amiId', label: 'Image ID' },
      { key: 'adminCidr', label: 'Admin CIDR' }, { key: 'appCidr', label: 'App CIDR' }, { key: 'sshAuthorizedKeys', label: 'SSH Authorized Keys' }
    ];
    requiredOci.forEach(({ key, label }) => {
      if (!String(cloudSettings[key as keyof CloudSettings] || '').trim()) {
        validationErrors.push({ name: `OCI 필수값 누락`, desc: `Settings 탭에서 [${label}] 값을 입력하세요.` });
      }
    });
  }

  useEffect(() => { setActiveSubTab(0); }, [selectedFileId]);

  useEffect(() => {
    const handleGlobalToast = (e: any) => {
      setToastMessage(e.detail);
      setTimeout(() => setToastMessage(null), 3000);
    };
    window.addEventListener('global-toast', handleGlobalToast);
    return () => window.removeEventListener('global-toast', handleGlobalToast);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activityLog.length > 0 || hasUnsavedChanges.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activityLog]);

  useEffect(() => {
    fetchWithAuth(`${BASE_URL}/members/me`)
      .then(res => {
        if (res.status === 401) { navigate('/login'); throw new Error('Unauthorized'); }
        return res.json();
      })
      .then(data => {
        const isSuccess = data.isSuccess ?? data.is_success;
        if (isSuccess && data.result) setUserInfo({ nickname: data.result.nickname, email: data.result.email });
        else setUserInfo({ nickname: '사용자', email: '알 수 없음' });
      })
      .catch(() => setUserInfo({ nickname: '사용자', email: '알 수 없음' }));

    if (projectId) {
      fetchWithAuth(`${BASE_URL}/projects/${projectId}`)
      .then(res => res.json())
      .then(data => {
        const isSuccess = data.isSuccess ?? data.is_success;
        if (isSuccess && data.result) {
          setProjectName(data.result.title);
          setProjectDescription(data.result.description || '');

          const fetchedNodes = data.result.nodes || [];
          const loadedNodes: NodeData[] = fetchedNodes.map((n: any) => ({
            id: n.nodeId || n.id.toString(), 
            type: n.componentType === 'SPRING_BOOT' ? 'Spring Boot' : n.componentType === 'MYSQL' ? 'MySQL' : n.componentType === 'REDIS' ? 'Redis' : n.componentType,
            name: n.nodeName,
            x: n.positionX,
            y: n.positionY,
            settings: n.properties || {}
          }));
          setNodes(loadedNodes);

          if (fetchedNodes.length > 0) {
            const firstProps = fetchedNodes[0].properties || {};
            if (firstProps.globalCloudProvider) setCloudProvider(firstProps.globalCloudProvider as CloudProvider);
            if (firstProps.globalIncludeLocal !== undefined) setIncludeLocal(firstProps.globalIncludeLocal === 'true');
            if (firstProps.globalCloudSettings) {
              try { setCloudSettings(JSON.parse(firstProps.globalCloudSettings)); } catch(e) {}
            }
          }

          const fetchedEdges = data.result.edges || [];
          const loadedEdges: Edge[] = fetchedEdges.map((e: any) => ({
            id: e.edgeId || `edge-${e.id}`,
            sourceId: e.sourceNodeId?.toString(),
            targetId: e.targetNodeId?.toString()
          }));
          setEdges(loadedEdges);

          const reconstructedFiles: Record<string, any> = {};
          loadedNodes.forEach((n: any) => {
            const props = n.settings;
            if (props && props.fileId) {
              if (!reconstructedFiles[props.fileId]) {
                let parsedFiles = [];
                try { parsedFiles = props.fileGeneratedCodes ? JSON.parse(props.fileGeneratedCodes) : []; } catch (e) {}

                reconstructedFiles[props.fileId] = {
                  id: props.fileId,
                  name: props.fileName || '새 폴더',
                  isGenerated: String(props.fileIsGenerated) === 'true',
                  nodeIds: [],
                  isExpanded: true,
                  generatedFiles: parsedFiles,
                  _isTarget: props.fileIsTarget !== 'false'
                };
              }
              reconstructedFiles[props.fileId].nodeIds.push(n.id);
            }
          });
          const loadedFiles = Object.values(reconstructedFiles);
          setFiles(loadedFiles);
          
          const loadedTargetFileIds = loadedFiles.filter((f: any) => f._isTarget).map(f => f.id);
          setTargetFileIds(loadedTargetFileIds);

          prevEdges.current = loadedEdges;
          prevFiles.current = loadedFiles;
          prevTargetFileIds.current = loadedTargetFileIds;
          setTimeout(() => { isDataLoaded.current = true; hasUnsavedChanges.current = false; }, 100);

        } else {
          setProjectName('알 수 없는 프로젝트');
        }
      })
      .catch(() => setProjectName('연결 오류'));
    }
  }, [navigate, projectId, fetchWithAuth]);
  
  const prevEdges = useRef(edges);
  useEffect(() => {
    if (isDataLoaded.current && !isUndoRedo.current) {
      hasUnsavedChanges.current = true;
      if (edges.length > prevEdges.current.length) {
        const addedEdges = edges.filter(e => !prevEdges.current.some(pe => pe.id === e.id));
        addedEdges.forEach(e => {
          const source = nodes.find(n => n.id === e.sourceId);
          const target = nodes.find(n => n.id === e.targetId);
          if (source && target) setActivityLog(prev => [...prev, `[연결] '${source.name}' 노드와 '${target.name}' 노드를 연결했습니다.`]);
        });
      }
    }
    prevEdges.current = edges;
  }, [edges, nodes]);

  const prevFiles = useRef(files);
  useEffect(() => {
    if (isDataLoaded.current && !isUndoRedo.current) {
      hasUnsavedChanges.current = true;
      files.forEach(currentFile => {
        const previousFile = prevFiles.current.find(f => f.id === currentFile.id);
        if (previousFile) {
          if (previousFile.name !== currentFile.name) {
            if (previousFile.name === '') setActivityLog(prev => [...prev, `[생성] '${currentFile.name}' 폴더를 새로 만들었습니다.`]);
            else setActivityLog(prev => [...prev, `[수정] 폴더명이 '${previousFile.name}'에서 '${currentFile.name}'(으)로 변경되었습니다.`]);
          }
          if (currentFile.nodeIds.length > previousFile.nodeIds.length) {
            const addedNodeIds = currentFile.nodeIds.filter(id => !previousFile.nodeIds.includes(id));
            addedNodeIds.forEach(nodeId => {
              const node = nodes.find(n => n.id === nodeId);
              if (node) setActivityLog(prev => [...prev, `[배치] '${node.name}' 노드를 '${currentFile.name}' 폴더 안에 포함시켰습니다.`]);
            });
          }
        }
      });
    }
    prevFiles.current = files;
  }, [files, nodes]);

  const prevTargetFileIds = useRef(targetFileIds);
  useEffect(() => {
    if (isDataLoaded.current && !isUndoRedo.current) {
      hasUnsavedChanges.current = true;
      if (targetFileIds.length > prevTargetFileIds.current.length) {
        const addedIds = targetFileIds.filter(id => !prevTargetFileIds.current.includes(id));
        addedIds.forEach(id => {
          const file = files.find(f => f.id === id);
          if (file) setActivityLog(prev => [...prev, `[이동] '${file.name}' 폴더가 생성할 대상 목록에 들어갔습니다.`]);
        });
      }
    }
    prevTargetFileIds.current = targetFileIds;
  }, [targetFileIds, files]);

  useEffect(() => {
    if (isDataLoaded.current && !isUndoRedo.current) hasUnsavedChanges.current = true;
  }, [projectName, projectDescription, nodes, includeLocal, cloudProvider, cloudSettings]);

  const processProperties = (n: NodeData, rawProperties: any) => {
    if (n.type === 'Redis') {
      if (!rawProperties.port) rawProperties.port = 6379;
      if (!rawProperties.name) rawProperties.name = 'redis_service';
      if (!rawProperties.containerName) rawProperties.containerName = 'redis_container';
    }
    const finalProperties: Record<string, any> = {};
    for (const key in rawProperties) {
      if (rawProperties[key] !== undefined && rawProperties[key] !== null && rawProperties[key] !== '') {
        if (typeof rawProperties[key] === 'object') finalProperties[key] = rawProperties[key];
        else if (key === 'port') finalProperties[key] = Number(rawProperties[key]);
        else if (key === 'fileGeneratedCodes' || key.startsWith('global')) finalProperties[key] = rawProperties[key];
        else finalProperties[key] = String(rawProperties[key]).trim();
      }
    }
    return finalProperties;
  };

  const getMappedCanvasData = (currentFiles: FileGroup[] = files) => {
    const mappedNodes = nodes.map(n => {
      const file = currentFiles.find(f => f.nodeIds.includes(n.id));
      const rawProperties: any = { ...(n as any).settings };
      
      rawProperties.globalCloudProvider = cloudProvider;
      rawProperties.globalIncludeLocal = String(includeLocal);
      rawProperties.globalCloudSettings = JSON.stringify(cloudSettings);
      
      if (file) {
        rawProperties.fileId = file.id;
        rawProperties.fileName = file.name;
        rawProperties.fileIsGenerated = String(file.isGenerated);
        rawProperties.fileGeneratedCodes = JSON.stringify(file.generatedFiles || []);
        rawProperties.fileIsTarget = String(targetFileIds.includes(file.id));
      } else {
        delete rawProperties.fileId; delete rawProperties.fileName; delete rawProperties.fileIsGenerated;
        delete rawProperties.fileGeneratedCodes; delete rawProperties.fileIsTarget;
      }

      return {
        nodeId: n.id,
        nodeName: n.name,
        componentType: n.type.toUpperCase().replace(/ /g, '_'),
        positionX: Math.round(n.x),
        positionY: Math.round(n.y),
        properties: processProperties(n, rawProperties)
      };
    });

    const mappedEdges = edges.map(e => {
      let sNode = nodes.find(n => n.id === e.sourceId);
      let tNode = nodes.find(n => n.id === e.targetId);
      // DB/Redis에서 Spring Boot 방향으로 강제 교정하여 전송
      if (sNode?.type === 'Spring Boot' && (tNode?.type === 'MySQL' || tNode?.type === 'Redis')) {
        const temp = sNode; sNode = tNode; tNode = temp;
      }
      return {
        edgeId: e.id, 
        sourceNodeId: sNode?.id || '', 
        targetNodeId: tNode?.id || '', 
        sourceNodeName: sNode?.name || '',
        targetNodeName: tNode?.name || ''
      };
    }).filter(e => e.sourceNodeId && e.targetNodeId);

    return { mappedNodes, mappedEdges };
  };

  const getGeneratePayloadForFolder = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return { generateNodes: [], generateEdges: [] };

    const folderNodes = nodes.filter(n => file.nodeIds.includes(n.id));
    const generateNodes = folderNodes.map(n => {
      const rawProperties: any = { ...(n as any).settings };
      rawProperties.fileId = file.id; rawProperties.fileName = file.name; rawProperties.fileIsGenerated = String(file.isGenerated);
      rawProperties.fileGeneratedCodes = JSON.stringify(file.generatedFiles || []); rawProperties.fileIsTarget = String(targetFileIds.includes(file.id));
      return {
        nodeId: n.id, 
        nodeName: n.name,
        componentType: n.type.toUpperCase().replace(/ /g, '_'),
        positionX: Math.round(n.x),
        positionY: Math.round(n.y),
        properties: processProperties(n, rawProperties)
      };
    });

    const folderEdges = edges.filter(e => file.nodeIds.includes(e.sourceId) && file.nodeIds.includes(e.targetId));
    const generateEdges = folderEdges.map(e => {
      const sourceNode = nodes.find(n => n.id === e.sourceId);
      const targetNode = nodes.find(n => n.id === e.targetId);
      let finalSourceId = e.sourceId; let finalTargetId = e.targetId;
      if (sourceNode?.type === 'Spring Boot' && (targetNode?.type === 'MySQL' || targetNode?.type === 'Redis')) {
        finalSourceId = e.targetId; finalTargetId = e.sourceId;
      }
      return { edgeId: e.id, sourceNodeId: finalSourceId, targetNodeId: finalTargetId, connectionType: "DEFAULT" };
    });

    return { generateNodes, generateEdges };
  };

  const handleSaveCanvas = async (isAutoSave: boolean = false) => {
    if (!projectId) return;
    if (isAutoSave && !hasUnsavedChanges.current) return;

    const { mappedNodes, mappedEdges } = getMappedCanvasData();

    try {
      const res = await fetchWithAuth(`${BASE_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
        if (activityLog.length > 0) {
          const combinedLogString = activityLog.join('\n');
          await fetchWithAuth(`${BASE_URL}/projects/${projectId}/histories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: combinedLogString })
          });
          setActivityLog([]); 
        }
        hasUnsavedChanges.current = false; 

        if (!isAutoSave) window.dispatchEvent(new CustomEvent('global-toast', { detail: '프로젝트가 성공적으로 저장되었습니다.' }));
        else {
          setToastMessage('자동 저장되었습니다.');
          setTimeout(() => setToastMessage(null), 3000);
        }
      } else {
        if (!isAutoSave) alert(data.message || '저장에 실패했습니다.');
      }
    } catch (err) {
      if (!isAutoSave) alert('서버 오류가 발생했습니다.');
    }
  };

  useEffect(() => { autoSaveCallback.current = () => { if (hasUnsavedChanges.current) handleSaveCanvas(true); }; }); 

  useEffect(() => {
    if (!isAutoSaveEnabled || !projectId) return;
    const tick = () => { if (autoSaveCallback.current) autoSaveCallback.current(); };
    const timerId = setInterval(tick, 10 * 60 * 1000); 
    return () => clearInterval(timerId);
  }, [isAutoSaveEnabled, projectId]);

  const handleUpdateProjectName = async (newName: string) => {
    if (!newName.trim() || newName === projectName || !projectId) return;
    const previousName = projectName;
    setProjectName(newName);
    setActivityLog(prev => [...prev, `[수정] 프로젝트 이름이 '${newName}'(으)로 변경되었습니다.`]);
    const { mappedNodes, mappedEdges } = getMappedCanvasData();

    try {
      const res = await fetchWithAuth(`${BASE_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newName, description: projectDescription, nodes: mappedNodes, edges: mappedEdges })
      });
      const data = await res.json();
      if (!res.ok || !(data.isSuccess ?? data.is_success)) {
        alert(data.message || '프로젝트 이름 저장에 실패했습니다.');
        setProjectName(previousName);
      } else hasUnsavedChanges.current = false;
    } catch (err) {
      alert('서버 오류가 발생했습니다.');
      setProjectName(previousName);
    }
  };

  const handleGoHome = () => {
    if (activityLog.length > 0 || hasUnsavedChanges.current) {
      if (!window.confirm('저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?\n(저장하지 않고 나가면 최근 작업 내역이 날아갈 수 있습니다.)')) return;
    }
    navigate('/dashboard');
  };

  const handleResetUI = () => {
    setZoomLevel(1); setIsSelectMode(false); setSelectedNodeIds([]); setSelectedFileId(null);
    setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
    setLeftActiveTab('Project'); setShowRightSidebar(false); setUiResetTrigger(prev => prev + 1);
  };

  const saveHistory = () => {
    setHistory((prev) => [...prev, { nodes: [...nodes], edges: [...edges], selectedNodeIds: [...selectedNodeIds], selection: { ...selection }, files: JSON.parse(JSON.stringify(files)), targetFileIds: [...targetFileIds] }]);
    setRedoStack([]); 
  };

  const markFilesAsModified = () => setFiles((prev) => prev.map(f => ({ ...f, isGenerated: false })));

  const handleGenerateClick = () => {
    if (validationErrors.length > 0) setIsErrorModalOpen(true);
    else setIsConfirmModalOpen(true);
  };

  const confirmGenerate = async () => {
    setIsConfirmModalOpen(false); setAppMode('generating'); setGenProgress(0);
    saveHistory(); 
    
    if (projectId) {
      try {
        const progressInterval = setInterval(() => setGenProgress(prev => (prev >= 90 ? 90 : prev + 5)), 100);

        const { mappedNodes, mappedEdges } = getMappedCanvasData();
        await fetchWithAuth(`${BASE_URL}/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: projectName, description: projectDescription, nodes: mappedNodes, edges: mappedEdges })
        });

        const updatedFilesList = [...files];
        let hasError = false;
        let errorMsg = '';

        for (const tFileId of targetFileIds) {
          const { generateNodes, generateEdges } = getGeneratePayloadForFolder(tFileId);
          if (generateNodes.length === 0) continue; 

          const generatePayload = {
            deploymentOption: cloudProvider, 
            includeLocalSpec: includeLocal,
            deploymentTarget: cloudProvider === 'AWS' ? {
              region: cloudSettings.region || 'ap-northeast-2',
              vpcName: cloudSettings.vpcName,
              subnetName: cloudSettings.subnetName,
              internetGatewayName: cloudSettings.internetGatewayName,
              routeTableName: cloudSettings.routeTableName,
              securityGroupName: cloudSettings.securityGroupName,
              instanceName: cloudSettings.instanceName,
              vpcCidr: cloudSettings.vpcCidr || '10.0.0.0/16',
              subnetCidr: cloudSettings.subnetCidr || '10.0.1.0/24',
              amiId: cloudSettings.amiId,
              instanceType: cloudSettings.instanceType || 't3.micro',
              adminCidr: cloudSettings.adminCidr,
              appCidr: cloudSettings.appCidr
            } : {
              region: cloudSettings.region || 'ap-seoul-1',
              vcnName: cloudSettings.vpcName,
              subnetName: cloudSettings.subnetName,
              internetGatewayName: cloudSettings.internetGatewayName,
              routeTableName: cloudSettings.routeTableName,
              securityListName: cloudSettings.securityGroupName,
              instanceName: cloudSettings.instanceName,
              hostnameLabel: cloudSettings.hostnameLabel,
              compartmentId: cloudSettings.compartmentId,
              availabilityDomain: cloudSettings.availabilityDomain,
              imageId: cloudSettings.amiId,
              shape: cloudSettings.instanceType || 'VM.Standard.E2.1.Micro',
              vcnCidr: cloudSettings.vpcCidr || '10.0.0.0/16',
              subnetCidr: cloudSettings.subnetCidr || '10.0.1.0/24',
              adminCidr: cloudSettings.adminCidr,
              appCidr: cloudSettings.appCidr,
              sshAuthorizedKeys: cloudSettings.sshAuthorizedKeys
            },
            nodes: generateNodes,
            edges: generateEdges
          };

          const generateRes = await fetchWithAuth(`${BASE_URL}/projects/${projectId}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(generatePayload)
          });

          const generateData = await generateRes.json();

          if (generateRes.ok && (generateData.isSuccess ?? generateData.is_success)) {
            const generatedFilesFromApi = generateData.result.files || [];
            const fileIdx = updatedFilesList.findIndex(f => f.id === tFileId);
            if (fileIdx > -1) {
              updatedFilesList[fileIdx] = { ...updatedFilesList[fileIdx], isGenerated: true, generatedFiles: generatedFilesFromApi };
            }
          } else {
            hasError = true;
            errorMsg = generateData.message || '코드 생성에 실패했습니다. 올바른 값이 입력되었는지 확인해주세요.';
            break;
          }
        }
        
        clearInterval(progressInterval);
        setGenProgress(100); 

        if (!hasError) {
          setFiles(updatedFilesList); 
          setActivityLog([]); 
          hasUnsavedChanges.current = false;
          
          const finalMapped = getMappedCanvasData(updatedFilesList); 
          
          await fetchWithAuth(`${BASE_URL}/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: projectName, description: projectDescription, nodes: finalMapped.mappedNodes, edges: finalMapped.mappedEdges })
          });
        } else { alert(errorMsg); setAppMode('editor'); }
      } catch (err) { alert('서버 오류가 발생했습니다.'); setAppMode('editor'); }
    } else setAppMode('editor');
  };

  const closeErrorModalAndShowValidation = () => {
    setIsErrorModalOpen(false); setLeftActiveTab('Validation');
    if (!showRightSidebar) setShowRightSidebar(true);
  };

  const undo = () => {
    if (history.length === 0) return;
    isUndoRedo.current = true; 
    const previousState = history[history.length - 1];
    setRedoStack((prev) => [...prev, { nodes: [...nodes], edges: [...edges], selectedNodeIds: [...selectedNodeIds], selection: { ...selection }, files: JSON.parse(JSON.stringify(files)), targetFileIds: [...targetFileIds] }]);
    setNodes(previousState.nodes); setEdges(previousState.edges); setSelectedNodeIds(previousState.selectedNodeIds); setSelection(previousState.selection); setFiles(previousState.files); setTargetFileIds(previousState.targetFileIds);
    setHistory((prev) => prev.slice(0, -1));
    setTimeout(() => { isUndoRedo.current = false; }, 100); 
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    isUndoRedo.current = true; 
    const nextState = redoStack[redoStack.length - 1];
    setHistory((prev) => [...prev, { nodes: [...nodes], edges: [...edges], selectedNodeIds: [...selectedNodeIds], selection: { ...selection }, files: JSON.parse(JSON.stringify(files)), targetFileIds: [...targetFileIds] }]);
    setNodes(nextState.nodes); setEdges(nextState.edges); setSelectedNodeIds(nextState.selectedNodeIds); setSelection(nextState.selection); setFiles(nextState.files); setTargetFileIds(nextState.targetFileIds);
    setRedoStack((prev) => prev.slice(0, -1));
    setTimeout(() => { isUndoRedo.current = false; }, 100); 
  };

  const toggleRightSidebar = () => setShowRightSidebar(!showRightSidebar);
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.1, 0.5));

  const addNode = (type: string, baseName: string, x: number, y: number) => {
    saveHistory(); markFilesAsModified();
    let finalName = baseName; let counter = 1;
    while (nodes.some(n => n.name === finalName)) { finalName = `${baseName}_${counter}`; counter++; }
    const newNode: NodeData = { id: `node-${Date.now()}`, type, name: finalName, x, y };
    setNodes((prev) => [...prev, newNode]);
    setActivityLog(prev => [...prev, `[배치] '${finalName}' 노드를 캔버스에 배치했습니다.`]);
  };

  const deleteSelected = () => {
    if (selectedNodeIds.length === 0) return;
    saveHistory(); markFilesAsModified();
    const deletedNodes = nodes.filter(n => selectedNodeIds.includes(n.id)).map(n => n.name);
    if (deletedNodes.length > 0) setActivityLog(prev => [...prev, `[삭제] 캔버스에서 ${deletedNodes.map(n => `'${n}'`).join(', ')} 노드를 삭제했습니다.`]);
    setNodes((prev) => prev.filter(node => !selectedNodeIds.includes(node.id)));
    setEdges((prev) => prev.filter(edge => !selectedNodeIds.includes(edge.sourceId) && !selectedNodeIds.includes(edge.targetId)));
    setFiles((prev) => prev.map(f => ({ ...f, nodeIds: f.nodeIds.filter(id => !selectedNodeIds.includes(id)) })));
    setSelectedNodeIds([]); setSelectedFileId(null); setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
  };

  const onCancelSelection = () => {
    saveHistory(); setIsSelectMode(false); setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
    setSelectedNodeIds([]); setSelectedFileId(null);
  };

  const deleteRightPanelItems = (fileIdsToDelete: string[], nodeIdsToDelete: string[]) => {
    if (fileIdsToDelete.length === 0 && nodeIdsToDelete.length === 0) return;
    saveHistory(); markFilesAsModified();
    if (selectedFileId && fileIdsToDelete.includes(selectedFileId)) setSelectedFileId(null);
    const deletedFiles = files.filter(f => fileIdsToDelete.includes(f.id)).map(f => f.name);
    const deletedNodes = nodes.filter(n => nodeIdsToDelete.includes(n.id)).map(n => n.name);
    if (deletedFiles.length > 0) setActivityLog(prev => [...prev, `[삭제] 우측 패널에서 ${deletedFiles.map(n => `'${n}'`).join(', ')} 폴더를 삭제했습니다.`]);
    if (deletedNodes.length > 0) setActivityLog(prev => [...prev, `[삭제] 우측 패널에서 ${deletedNodes.map(n => `'${n}'`).join(', ')} 노드를 삭제했습니다.`]);
    
    setFiles((prev) => prev.filter(f => !fileIdsToDelete.includes(f.id)).map(f => ({ ...f, nodeIds: f.nodeIds.filter(id => !nodeIdsToDelete.includes(id)) })));
    setNodes((prev) => prev.filter(n => !nodeIdsToDelete.includes(n.id)));
    setEdges((prev) => prev.filter(e => !nodeIdsToDelete.includes(e.sourceId) && !nodeIdsToDelete.includes(e.targetId)));
    setTargetFileIds((prev) => prev.filter(id => !fileIdsToDelete.includes(id)));
  };

  return (
    <div className="app-container">
      <Header 
        onGenerate={handleGenerateClick} isGenerateMode={appMode === 'generating'} 
        onResetUI={handleResetUI} onSaveCanvas={() => handleSaveCanvas(false)}
        onOpenTutorial={() => setShowTutorial(true)}
      />
      
      {appMode === 'editor' ? (
        <div className="main-layout">
          <LeftPanel 
            projectName={projectName} onUpdateProjectName={handleUpdateProjectName} 
            nodes={nodes} activeTab={leftActiveTab} setActiveTab={setLeftActiveTab}
            onSelectCategory={() => {}} onToggleRightSidebar={toggleRightSidebar}
            showRightSidebar={showRightSidebar} setShowRightSidebar={setShowRightSidebar}
            onZoomIn={handleZoomIn} onZoomOut={handleZoomOut}
            onSelectMode={() => { saveHistory(); setIsSelectMode(true); }}
            onCancelSelection={onCancelSelection} onDelete={deleteSelected}
            onUndo={undo} onRedo={redo} canUndo={history.length > 0} canRedo={redoStack.length > 0}
            isSelectMode={isSelectMode} resetTrigger={uiResetTrigger} userInfo={userInfo}
            onGoHome={handleGoHome} cloudProvider={cloudProvider} setCloudProvider={setCloudProvider}
          />
          <Canvas 
            nodes={nodes} setNodes={setNodes} edges={edges} setEdges={setEdges}
            selectedNodeIds={selectedNodeIds} setSelectedNodeIds={setSelectedNodeIds}
            addNode={addNode} zoomLevel={zoomLevel} isSelectMode={isSelectMode}
            selection={selection} setSelection={setSelection} saveHistory={saveHistory}
            markFilesAsModified={markFilesAsModified} setSelectedFileId={setSelectedFileId}
            setViewport={setViewport} focusNodeId={focusNodeId} setFocusNodeId={setFocusNodeId} resetTrigger={uiResetTrigger}
          />
          
          {selectedFileId && (
            <div className="code-viewer-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {(() => {
                const f = files.find(file => file.id === selectedFileId);
                if (!f) return null;
                return (
                  <>
                    <div className="code-viewer-header" style={{ padding: '16px 16px 0 16px', marginBottom: 0, borderBottom: 'none' }}>
                      <div className="code-viewer-tab">
                        {f.name} <span style={{fontSize:'11px', color:'#718096', fontWeight:'normal'}}>(프로젝트 폴더)</span>
                      </div>
                    </div>
                    
                    <div className="code-viewer-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, border: 'none', background: 'transparent' }}>
                      {f.generatedFiles && f.generatedFiles.length > 0 ? (
                        <>
                          <div style={{ display: 'flex', background: '#f8f9fa', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
                            {f.generatedFiles.map((gf, idx) => (
                              <button
                                key={idx} onClick={() => setActiveSubTab(idx)} title={gf.fileName}
                                style={{ flex: 1, padding: '10px 8px', border: 'none', borderRight: '1px solid var(--border)', background: activeSubTab === idx ? 'white' : 'transparent', fontWeight: activeSubTab === idx ? 'bold' : 'normal', color: activeSubTab === idx ? 'var(--mint)' : '#4a5568', cursor: 'pointer', borderBottom: activeSubTab === idx ? '2px solid var(--mint)' : '2px solid transparent', fontSize: '14px' }}
                              >{idx + 1}</button>
                            ))}
                          </div>
                          <div style={{ padding: '16px', overflowY: 'auto', flex: 1, background: 'white', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '12px', fontFamily: "'Consolas', 'Courier New', monospace" }}>
                            <div style={{ fontWeight: 'bold', color: '#2d3748', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center' }}>
                              {f.generatedFiles[activeSubTab]?.fileName}
                            </div>
                            {f.generatedFiles[activeSubTab]?.content}
                          </div>
                        </>
                      ) : (
                        <div style={{ padding: '16px', background: 'white', flex: 1, fontSize: '12px', color: '#718096' }}>
                          {`// 폴더에 생성된 코드가 없습니다.\n// Generate 버튼을 클릭하여 코드를 생성하세요.`}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {showRightSidebar && (
            <RightSideBar 
              nodes={nodes} setNodes={setNodes} edges={edges} activeTab={leftActiveTab} saveHistory={saveHistory}
              files={files} setFiles={setFiles} targetFileIds={targetFileIds} setTargetFileIds={setTargetFileIds}
              markFilesAsModified={markFilesAsModified} deleteRightPanelItems={deleteRightPanelItems}
              selectedFileId={selectedFileId} setSelectedFileId={setSelectedFileId}
              setSelectedNodeIds={setSelectedNodeIds} selectedNodeIds={selectedNodeIds} viewport={viewport} zoomLevel={zoomLevel}
              setFocusNodeId={setFocusNodeId} validationErrors={validationErrors} resetTrigger={uiResetTrigger}
              setSelection={setSelection} setIsSelectMode={setIsSelectMode}
              cloudProvider={cloudProvider} includeLocal={includeLocal} setIncludeLocal={setIncludeLocal}
              cloudSettings={cloudSettings} setCloudSettings={setCloudSettings}
            />
          )}
        </div>
      ) : (
        <Generate genProgress={genProgress} targetFileIds={targetFileIds} files={files} projectName={projectName} onBack={() => { setAppMode('editor'); setTargetFileIds([]); }} />
      )}

      {isErrorModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title error">프로젝트를 생성할 수 없습니다.</div>
            <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <div style={{fontWeight: 'bold', marginBottom: '12px', color: '#e53e3e'}}>총 {validationErrors.length}개의 오류가 발견되었습니다.</div>
              {validationErrors.map((err, idx) => (
                <div key={idx} style={{ padding: '10px', background: '#fff5f5', borderLeft: '4px solid #fc8181', marginBottom: '10px', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 'bold', color: '#c53030', fontSize: '13px', marginBottom: '4px' }}>{err.name}</div>
                  <div style={{ color: '#4a5568', fontSize: '12px' }}>{err.desc}</div>
                </div>
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
                targetFileIds.map(id => <div key={id} style={{color: '#718096', marginBottom: '4px'}}>- {files.find(f => f.id === id)?.name} (폴더)</div>)
              ) : (
                <div style={{color: '#718096'}}>- 생성할 폴더가 없습니다.</div>
              )}
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setIsConfirmModalOpen(false)}>취소</button>
              <button className="modal-btn confirm" onClick={confirmGenerate}>생성</button>
            </div>
          </div>
        </div>
      )}

      {showTutorial && <Tutorial nodes={nodes} onFinish={() => setShowTutorial(false)} onSkip={() => setShowTutorial(false)} />}
      {toastMessage && <ToastNotification>{toastMessage}</ToastNotification>}
    </div>
  );
};

export default MainPage;