import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { Client } from '@stomp/stompjs';
import './MainPage.css';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import Canvas from './components/Canvas';
import type { DraggedNodePosition } from './components/Canvas';
import RightSideBar from './components/RightSideBar';
import Generate from './components/Generate'; 
import type { NodeData, SelectionArea, Edge, FileGroup, CloudProvider, CloudSettings } from './types';
import Tutorial from './components/Tutorial';
import { useAuth } from './contexts/AuthContext';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://infragen.p-e.kr/api/v1';
const WS_BASE_URL = BASE_URL.replace(/^http/, 'ws').replace(/\/api\/v1$/, '');

const SELF_WRITE_WINDOW_MS = 5000;

const DEFAULT_CLOUD_SETTINGS: CloudSettings = {
  region: 'ap-northeast-2', vpcName: 'infragen-vpc', subnetName: 'infragen-subnet',
  internetGatewayName: 'infragen-igw', routeTableName: 'infragen-rt', securityGroupName: 'infragen-sg',
  instanceName: 'infragen-instance', vpcCidr: '10.0.0.0/16', subnetCidr: '10.0.1.0/24',
  amiId: 'ami-084e92d3e117f7692', instanceType: 't3.micro', adminCidr: '0.0.0.0/0',
  appCidr: '0.0.0.0/0', hostnameLabel: 'infragenhost', compartmentId: '',
  availabilityDomain: 'AD-1', sshAuthorizedKeys: ''
};

const isApiSuccess = (data: any) => Boolean(data?.isSuccess ?? data?.is_success);

const showToast = (message: string) => window.dispatchEvent(new CustomEvent('global-toast', { detail: message }));

const COMPONENT_TYPE_TO_NODE_TYPE: Record<string, string> = {
  SPRING_BOOT: 'Spring Boot',
  MYSQL: 'MySQL',
  POSTGRESQL: 'PostgreSQL',
  REDIS: 'Redis'
};
const toComponentType = (nodeType: string) => nodeType.toUpperCase().replace(/ /g, '_');

const DEPENDENCY_NODE_TYPES = ['MySQL', 'PostgreSQL', 'Redis'];
const isDependencyType = (type?: string) => Boolean(type && DEPENDENCY_NODE_TYPES.includes(type));

const ENV_KEYS_BY_COMPONENT: Record<string, string[]> = {
  MYSQL: ['databaseName', 'username', 'userPassword', 'rootPassword'],
  POSTGRESQL: ['databaseName', 'username', 'password']
};

const DB_NAME_REGEX = /^[a-zA-Z0-9_]+$/;

const GENERATE_ERROR_MESSAGES: Record<string, string> = {
  PARSING400_23: 'PostgreSQL 노드의 [도커 이미지 버전]이 비어 있습니다.',
  PARSING400_24: 'PostgreSQL 노드의 [사용자 이름]이 비어 있습니다.',
  PARSING400_6: '데이터베이스 이름에는 영문, 숫자, 언더바(_)만 사용할 수 있습니다.',
  PARSING400_7: '데이터베이스 비밀번호는 8자 이상이어야 합니다. (MySQL은 루트 비밀번호, PostgreSQL은 비밀번호)',
  PARSING400_5: '포트 번호는 1024~65535 사이여야 합니다.',
  PARSING400_4: '여러 노드가 같은 포트 번호를 쓰고 있습니다.',
  PARSING400_25: '하나의 Spring Boot에 같은 종류의 DB(MySQL·PostgreSQL·Redis)가 2개 이상 연결되어 있습니다. 하나만 남겨 주세요.',
  PARSING400_10: '연결 방향이 잘못되었습니다. Database에서 Spring Boot 방향으로 연결해 주세요.',
  GENERATION400_3: '코드 생성 요청을 처리하지 못했습니다. 설정을 확인한 뒤 다시 시도해 주세요.',
  GENERATION400_4: '배포 환경이 선택되지 않았습니다. 왼쪽 패널에서 LOCAL·AWS·OCI 중 하나를 골라 주세요.',
  GENERATION400_5: '클라우드 배포 설정이 비어 있습니다. Settings 탭에서 클라우드 설정을 입력해 주세요.',
  GENERATION400_6: '로컬 환경 설정이 올바르지 않습니다. 배포 환경을 다시 선택한 뒤 시도해 주세요.',
  GENERATION400_7: '선택한 배포 환경과 클라우드 설정이 맞지 않습니다. 배포 환경을 다시 선택해 주세요.',
  GENERATION400_8: '클라우드 필수 설정값이 비어 있거나 올바르지 않습니다. Settings 탭에서 확인해 주세요.',
  GENERATION400_9: '하나의 Spring Boot에 같은 종류의 DB(MySQL·PostgreSQL·Redis)가 2개 이상 연결되어 있습니다. 하나만 남겨 주세요.',
  COMMON400_1: '입력값 중 형식이 올바르지 않은 항목이 있습니다. 노드 설정과 클라우드 설정을 다시 확인해 주세요.'
};
const GENERATE_SETTINGS_ERROR_CODES = ['GENERATION400_4', 'GENERATION400_5', 'GENERATION400_6', 'GENERATION400_7', 'GENERATION400_8'];

const SECRET_ENV_KEY = /(PASSWORD|SECRET|TOKEN|PRIVATE_KEY|CREDENTIAL)/i;
const ENV_ASSIGNMENT = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/;
const isEnvFile = (fileName?: string) => /(^|\/)\.env(\.[\w-]+)?$/.test(fileName || '');
const isSecretEnvLine = (line: string) => {
  const match = ENV_ASSIGNMENT.exec(line);
  return Boolean(match && SECRET_ENV_KEY.test(match[2]) && match[4].trim() !== '');
};
const hasEnvSecrets = (content: string) => content.split(/\r?\n/).some(isSecretEnvLine);
const maskEnvSecrets = (content: string) => content.split(/\r?\n/).map(line => {
  if (!isSecretEnvLine(line)) return line;
  const match = ENV_ASSIGNMENT.exec(line)!;
  return `${match[1]}${match[2]}${match[3]}********`;
}).join('\n');

const isVersionConflict = (res: Response, data: any) => {
  if (res.status !== 409) return false;
  const code = String(data?.code || '');
  return code === '' || code.startsWith('COLLAB409');
};

const pickSnapshotVersion = (result: any): number | null => {
  if (typeof result?.serverVersion === 'number') return result.serverVersion;
  const ops = Array.isArray(result?.operations) ? result.operations : [];
  const lastOp = ops[ops.length - 1];
  if (typeof lastOp?.serverVersion === 'number') return lastOp.serverVersion;
  if (typeof result?.graphVersion === 'number') return result.graphVersion;
  return null;
};

type ResyncReason = 'connect' | 'resync' | 'conflict';

const LIVE_SYNC_DEBOUNCE_MS = 300;
const LIVE_SYNC_QUIET_MS = 400;
const VERSIONED_WRITE_RETRIES = 3;
const DRAG_OP_INTERVAL_MS = 40;
const DRAG_OP_PIPELINE = 2;
const DRAG_OP_ACK_TIMEOUT_MS = 1000;
const DRAG_OP_MAX_NODES = 3;
const LOCAL_DRAG_HOLD_MS = 1500;
const REMOTE_MOVE_START_MS = 50;
const REMOTE_MOVE_IDLE_MS = 300;
const REMOTE_MOVE_MAX_MS = 160;
const NAME_OP_DEBOUNCE_MS = 300;

const EDITOR_STRUCTURE_MESSAGE = 'EDITOR는 노드 이동과 이름 변경만 할 수 있습니다. (노드 추가·삭제·연결·설정 변경은 OWNER만 가능)';
const GENERATE_OWNER_ONLY_MESSAGE = '코드 생성은 방장(OWNER)만 할 수 있습니다.';
const CONFLICT_SAVE_MESSAGE = '다른 사람이 편집 중이라 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const GENERIC_ERROR_MESSAGE = '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const saveNotAllowedMessage = (role: string) => role === 'EDITOR'
  ? 'EDITOR는 프로젝트를 저장할 수 없습니다. 노드 이동과 이름 변경은 자동으로 저장됩니다.'
  : 'VIEWER는 프로젝트를 수정하거나 저장할 수 없습니다.';
const writeFailMessage = (data: any, fallback: string) => String(data?.code || '').startsWith('COLLAB409')
  ? CONFLICT_SAVE_MESSAGE
  : (data?.message || fallback);
const OPERATION_ERROR_MESSAGES: Record<string, string> = {
  PROJECT403_1: '이 프로젝트를 수정할 권한이 없습니다.',
  PROJECT404_1: '프로젝트를 찾을 수 없습니다.'
};

type CollabOpType = 'UPDATE_NODE_NAME' | 'UPDATE_NODE_POSITION';

interface PendingOp {
  operationId: string;
  type: CollabOpType;
  nodeId: string;
  payload: Record<string, unknown>;
}

interface RemoteMotion {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  duration: number;
}

const motionPosition = (m: RemoteMotion, now: number) => {
  const t = m.duration <= 0 ? 1 : Math.min(1, Math.max(0, (now - m.start) / m.duration));
  return { x: m.fromX + (m.toX - m.fromX) * t, y: m.fromY + (m.toY - m.fromY) * t, done: t >= 1 };
};

interface SnapshotResult {
  project: any | null;
  operations: any[];
  version: number | null;
}

const makeId = (prefix: string) => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch (e) {}
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getTabClientId = () => {
  const key = 'infragen-collab-client-id';
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
    const created = makeId('client');
    sessionStorage.setItem(key, created);
    return created;
  } catch (e) {
    return makeId('client');
  }
};

const opKey = (op: { type: string; nodeId: string }) => `${op.type}:${op.nodeId}`;

const applyOpToNodes = (list: NodeData[], op: any): NodeData[] => {
  if (!op || typeof op.nodeId !== 'string') return list;
  if (op.type === 'UPDATE_NODE_NAME') {
    const value = op.payload?.value;
    if (typeof value !== 'string') return list;
    return list.map(n => n.id === op.nodeId ? { ...n, name: value } : n);
  }
  if (op.type === 'UPDATE_NODE_POSITION') {
    const x = Number(op.payload?.positionX);
    const y = Number(op.payload?.positionY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return list;
    return list.map(n => n.id === op.nodeId ? { ...n, x, y } : n);
  }
  return list;
};

const computeServerNodeStates = (project: any, operations: any[]) => {
  const states = new Map<string, { name: string; x: number; y: number }>();
  (project?.nodes || []).forEach((n: any) => {
    const id = n.nodeId || String(n.id);
    states.set(id, { name: n.nodeName, x: Number(n.positionX), y: Number(n.positionY) });
  });
  operations.forEach(op => {
    const target = states.get(op?.nodeId);
    if (!target) return;
    if (op.type === 'UPDATE_NODE_NAME' && typeof op.payload?.value === 'string') target.name = op.payload.value;
    if (op.type === 'UPDATE_NODE_POSITION') {
      const x = Number(op.payload?.positionX);
      const y = Number(op.payload?.positionY);
      if (Number.isFinite(x) && Number.isFinite(y)) { target.x = x; target.y = y; }
    }
  });
  return states;
};

const isOpReflected = (op: PendingOp, serverNodes: Map<string, { name: string; x: number; y: number }>) => {
  const node = serverNodes.get(op.nodeId);
  if (!node) return true;
  if (op.type === 'UPDATE_NODE_NAME') return node.name === op.payload.value;
  return Math.round(node.x) === Math.round(Number(op.payload.positionX))
    && Math.round(node.y) === Math.round(Number(op.payload.positionY));
};

const coalesceOps = (ops: PendingOp[]) => {
  const latest = new Map<string, PendingOp>();
  ops.forEach(op => {
    latest.delete(opKey(op));
    latest.set(opKey(op), op);
  });
  return Array.from(latest.values());
};

const buildGraphSignature = (
  graphNodes: NodeData[], graphEdges: Edge[], graphFiles: FileGroup[], graphTargetIds: string[],
  provider: CloudProvider, local: boolean, settings: CloudSettings
) => JSON.stringify({
  n: graphNodes.map(n => {
    const s = n.settings || {};
    const keys = Object.keys(s).filter(k => !k.startsWith('file') && !k.startsWith('global')).sort();
    return [n.id, n.type, keys.map(k => [k, s[k]])];
  }),
  e: graphEdges.map(e => [e.sourceId, e.targetId]),
  f: graphFiles.map(f => [
    f.id, f.name, f.nodeIds, f.isGenerated,
    (f.generatedFiles || []).length,
    (f.generatedFiles || []).reduce((sum, g) => sum + (g.content?.length || 0), 0)
  ]),
  t: graphTargetIds,
  p: provider,
  l: local,
  c: settings
});

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

const SyncBanner = styled.div`
  position: fixed;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #2d3748;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 9998;
  pointer-events: none;
`;

interface ValidationError {
  name: string;
  desc: string;
  targetNodeId?: string;
  isGlobal?: boolean;
  targetField?: string;
  isProjectTab?: boolean;
  edgeId?: string;
}

const computeFileHash = (
  fileObj: FileGroup, 
  currentNodes: NodeData[], 
  currentEdges: Edge[], 
  cProvider: string, 
  cLocal: boolean, 
  cSettings: any
) => {
  const fNodes = currentNodes.filter(n => fileObj.nodeIds.includes(n.id));
  const sortedNodes = [...fNodes].sort((a, b) => a.name.localeCompare(b.name)).map(n => {
    const sortedSet: any = {};
    if (n.settings) {
      Object.keys(n.settings).sort().forEach(k => { sortedSet[k] = n.settings![k]; });
    }
    return { type: n.type, name: n.name, settings: sortedSet };
  });

  const fEdges = currentEdges.filter(e => fileObj.nodeIds.includes(e.sourceId) && fileObj.nodeIds.includes(e.targetId));
  const mappedEdges = fEdges.map(e => {
    const s = currentNodes.find(n => n.id === e.sourceId);
    const t = currentNodes.find(n => n.id === e.targetId);
    return { source: s?.name || '', target: t?.name || '' };
  }).sort((a, b) => (a.source + a.target).localeCompare(b.source + b.target));

  const sortedCloudSettings: any = {};
  if (cSettings) {
    Object.keys(cSettings).sort().forEach(k => { sortedCloudSettings[k] = cSettings[k]; });
  }

  return JSON.stringify({
    fileName: fileObj.name,
    nodes: sortedNodes,
    edges: mappedEdges,
    cloudProvider: cProvider,
    includeLocal: cLocal,
    cloudSettings: sortedCloudSettings
  });
};

const MainPage: React.FC = () => {
  const { projectId } = useParams(); 
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { initialProvider?: CloudProvider } | null;
  const { fetchWithAuth, isAutoSaveEnabled, accessToken } = useAuth();

  const [showTutorial, setShowTutorial] = useState(false);
  const [userInfo, setUserInfo] = useState({ id: 0, nickname: '로딩중...', email: '로딩중...' });

  const [myRole, setMyRole] = useState<'OWNER' | 'EDITOR' | 'VIEWER'>('VIEWER');

  const [projectName, setProjectName] = useState('로딩중...');
  const [projectDescription, setProjectDescription] = useState('');

  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('LOCAL');
  const [includeLocal, setIncludeLocal] = useState<boolean>(true); 

  const [cloudSettings, setCloudSettings] = useState<CloudSettings>(DEFAULT_CLOUD_SETTINGS);

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
  const [showSecrets, setShowSecrets] = useState(false);

  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [focusEdgeId, setFocusEdgeId] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);
  const [clipboard, setClipboard] = useState<NodeData[]>([]);

  const [viewport, setViewport] = useState<ViewportState>({
    scrollLeft: 0, scrollTop: 0, clientWidth: 100, clientHeight: 100, scrollWidth: 500, scrollHeight: 500
  });

  const [appMode, setAppMode] = useState<'editor' | 'generating'>('editor');
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isHomeConfirmModalOpen, setIsHomeConfirmModalOpen] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [uiResetTrigger, setUiResetTrigger] = useState(0);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(320);
  const [codeViewerWidth, setCodeViewerWidth] = useState(350);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isResizingCodeViewer, setIsResizingCodeViewer] = useState(false);

  const [serverVersion, setServerVersion] = useState(0);
  const serverVersionRef = useRef(0);
  const [tabClientId] = useState(getTabClientId);
  const clientId = useRef(tabClientId);
  const appliedOperations = useRef<Set<string>>(new Set());
  const stompClient = useRef<Client | null>(null);
  const nodesRef = useRef(nodes);

  const isDataLoaded = useRef(false);
  const isUndoRedo = useRef(false);
  const hasUnsavedChanges = useRef(false);
  const autoSaveCallback = useRef<(() => void) | null>(null);

  const hasLoadedOnce = useRef(false);
  const lastSelfWriteAt = useRef(0);

  const filesStructureDep = files.map(f => `${f.id}:${f.name}:${f.nodeIds.join(',')}`).join('|');

  useEffect(() => { serverVersionRef.current = serverVersion; }, [serverVersion]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const logActivity = useCallback((msg: string) => {
    setActivityLog(prev => prev.includes(msg) ? prev : [...prev, msg]);
  }, []);

  const myRoleRef = useRef(myRole);
  useEffect(() => { myRoleRef.current = myRole; }, [myRole]);
  const accessTokenRef = useRef(accessToken);
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);

  const inFlightOps = useRef(new Map<string, PendingOp>());
  const heldOps = useRef<PendingOp[]>([]);
  const latestOwnOpByKey = useRef(new Map<string, string>());
  const syncPausedRef = useRef(true);
  const bufferedBroadcasts = useRef<any[]>([]);
  const syncChain = useRef<Promise<void>>(Promise.resolve());
  const performSyncRef = useRef<(reason: ResyncReason) => Promise<void>>(async () => {});
  const [isConflictSyncing, setIsConflictSyncing] = useState(false);
  const [unappliedOps, setUnappliedOps] = useState<PendingOp[]>([]);

  const lastTokenRefreshAt = useRef(0);

  const lastDragOpAt = useRef(0);
  const lastSentDragPositions = useRef(new Map<string, { x: number; y: number }>());
  const pendingDragPositions = useRef<DraggedNodePosition[] | null>(null);
  const dragOpTimer = useRef<number | null>(null);
  const positionOpSentAt = useRef(new Map<string, number>());
  const dragFlushRef = useRef<() => void>(() => {});
  const locallyDraggedAt = useRef(new Map<string, number>());
  const remoteMotions = useRef(new Map<string, RemoteMotion>());
  const lastRemoteMoveAt = useRef(new Map<string, { at: number; avgGap: number | null }>());
  const motionFrame = useRef<number | null>(null);
  const pendingNameEdits = useRef(new Map<string, { name: string; timer: number }>());

  const lastSyncedGraphSig = useRef<string | null>(null);
  const latestGraphSigRef = useRef<string | null>(null);
  const liveSyncInFlight = useRef(false);
  const liveSyncAgain = useRef(false);
  const liveSyncFailedNotified = useRef(false);
  const liveSyncTimer = useRef<{ sig: string; timer: number } | null>(null);
  const liveSyncQuietTimer = useRef<number | null>(null);
  const lastRemoteOpAt = useRef(0);
  const runLiveSyncRef = useRef<() => void>(() => {});
  const latestMappedRef = useRef<() => { mappedNodes: any[]; mappedEdges: any[] }>(() => ({ mappedNodes: [], mappedEdges: [] }));
  const graphStateRef = useRef({ nodes, edges, files, targetFileIds, cloudProvider, includeLocal, cloudSettings });

  const markSelfWrite = useCallback(() => {
    lastSelfWriteAt.current = Date.now();
  }, []);

  const bumpServerVersion = useCallback((version: unknown) => {
    if (typeof version !== 'number' || !Number.isFinite(version)) return;
    if (version > serverVersionRef.current) {
      serverVersionRef.current = version;
      setServerVersion(version);
    }
  }, []);

  const setServerVersionExact = useCallback((version: number) => {
    serverVersionRef.current = version;
    setServerVersion(version);
  }, []);

  const restoreFullProjectGraph = useCallback((resultProject: any) => {
    isDataLoaded.current = false;
    remoteMotions.current.clear();
    lastRemoteMoveAt.current.clear();

    setProjectName(resultProject.title);
    setProjectDescription(resultProject.description || '');

    const fetchedNodes = resultProject.nodes || [];
    let loadedCloudProvider: CloudProvider = 'LOCAL';
    let loadedIncludeLocal = true;
    let loadedCloudSettings: CloudSettings = { ...DEFAULT_CLOUD_SETTINGS };

    if (fetchedNodes.length > 0) {
      const firstProps = fetchedNodes[0].properties || {};
      if (firstProps.globalCloudProvider) loadedCloudProvider = firstProps.globalCloudProvider as CloudProvider;
      if (firstProps.globalIncludeLocal !== undefined) loadedIncludeLocal = String(firstProps.globalIncludeLocal) === 'true';
      if (firstProps.globalCloudSettings) {
        try { 
          const parsed = JSON.parse(firstProps.globalCloudSettings); 
          loadedCloudSettings = { ...loadedCloudSettings, ...parsed }; 
        } catch(e) {}
      }
      setCloudProvider(loadedCloudProvider);
      setIncludeLocal(loadedIncludeLocal);
      setCloudSettings(loadedCloudSettings);
    } else {
      if (navState?.initialProvider) {
        setCloudProvider(navState.initialProvider);
        if (navState.initialProvider === 'OCI') {
          setCloudSettings(prev => ({
            ...prev, region: 'ap-seoul-1', instanceType: 'VM.Standard.E2.1.Micro', amiId: '' 
          }));
        }
      }
    }

    const loadedNodes: NodeData[] = fetchedNodes.map((n: any) => {
      const props = n.properties || {};
      const envKeys = ENV_KEYS_BY_COMPONENT[n.componentType];
      if (envKeys && props.env && typeof props.env === 'object') {
        envKeys.forEach(key => { if (props.env[key] !== undefined) props[key] = props.env[key]; });
        delete props.env;
      }
      return {
        id: n.nodeId || n.id.toString(), 
        type: COMPONENT_TYPE_TO_NODE_TYPE[n.componentType] || n.componentType,
        name: n.nodeName,
        x: n.positionX,
        y: n.positionY,
        settings: props
      };
    });
    setNodes(loadedNodes);

    const fetchedEdges = resultProject.edges || [];
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
            name: props.fileName || '생성할 노드 목록',
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

    const loadedFiles = Object.values(reconstructedFiles).map((f: any) => {
      if (f.isGenerated) {
        f.lastHash = computeFileHash(f, loadedNodes, loadedEdges, loadedCloudProvider, loadedIncludeLocal, loadedCloudSettings);
      }
      return f as FileGroup;
    });
    setFiles(loadedFiles);

    const loadedTargetFileIds = loadedFiles.filter((f: any) => f._isTarget).map(f => f.id);
    setTargetFileIds(loadedTargetFileIds);

    prevEdges.current = loadedEdges;
    prevFiles.current = loadedFiles;
    prevTargetFileIds.current = loadedTargetFileIds;
    hasLoadedOnce.current = true;
    setTimeout(() => { isDataLoaded.current = true; hasUnsavedChanges.current = false; }, 100);
  }, [navState]);

  const applyOperations = useCallback((ops: any[], options: { force?: boolean } = {}) => {
    const toApply = ops.filter(op => op && typeof op.operationId === 'string' && (options.force || !appliedOperations.current.has(op.operationId)));
    if (toApply.length === 0) return;
    toApply.forEach(op => {
      appliedOperations.current.add(op.operationId);
      if (op.type === 'UPDATE_NODE_POSITION') remoteMotions.current.delete(op.nodeId);
    });
    setNodes(prev => toApply.reduce<NodeData[]>((acc, op) => applyOpToNodes(acc, op), prev));
  }, []);

  const isLocallyDragging = useCallback((nodeId: string) => {
    const at = locallyDraggedAt.current.get(nodeId);
    return at !== undefined && Date.now() - at < LOCAL_DRAG_HOLD_MS;
  }, []);

  const runRemoteMotionFrame = useCallback(() => {
    motionFrame.current = null;
    const motions = remoteMotions.current;
    if (motions.size === 0) return;
    const now = performance.now();
    const frame = new Map<string, { x: number; y: number }>();
    motions.forEach((m, id) => {
      const pos = motionPosition(m, now);
      frame.set(id, pos);
      if (pos.done) motions.delete(id);
    });
    setNodes(prev => prev.map(n => {
      const pos = frame.get(n.id);
      return pos ? { ...n, x: pos.x, y: pos.y } : n;
    }));
    if (motions.size > 0) motionFrame.current = requestAnimationFrame(runRemoteMotionFrame);
  }, []);

  const animateRemotePosition = useCallback((op: any) => {
    const toX = Number(op.payload?.positionX);
    const toY = Number(op.payload?.positionY);
    if (!Number.isFinite(toX) || !Number.isFinite(toY)) return;
    const nodeId = op.nodeId;
    if (isLocallyDragging(nodeId)) return;

    const now = performance.now();
    const running = remoteMotions.current.get(nodeId);
    let from: { x: number; y: number } | null = running ? motionPosition(running, now) : null;
    if (!from) {
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (!node) {
        setNodes(prev => applyOpToNodes(prev, op));
        return;
      }
      from = { x: node.x, y: node.y };
    }

    const last = lastRemoteMoveAt.current.get(nodeId);
    const gap = last ? now - last.at : Infinity;
    let duration = REMOTE_MOVE_START_MS;
    let avgGap: number | null = null;
    if (gap <= REMOTE_MOVE_IDLE_MS) {
      avgGap = last?.avgGap == null ? gap : last.avgGap * 0.7 + gap * 0.3;
      duration = Math.min(REMOTE_MOVE_MAX_MS, Math.max(16, avgGap * 1.1));
    }
    lastRemoteMoveAt.current.set(nodeId, { at: now, avgGap });

    remoteMotions.current.set(nodeId, { fromX: from.x, fromY: from.y, toX, toY, start: now, duration });
    if (motionFrame.current === null) motionFrame.current = requestAnimationFrame(runRemoteMotionFrame);
  }, [isLocallyDragging, runRemoteMotionFrame]);

  useEffect(() => () => {
    if (motionFrame.current !== null) cancelAnimationFrame(motionFrame.current);
    if (dragOpTimer.current !== null) window.clearTimeout(dragOpTimer.current);
  }, []);

  const processIncomingOp = useCallback((op: any) => {
    if (!op || typeof op.operationId !== 'string') return;

    if (inFlightOps.current.has(op.operationId)) {
      inFlightOps.current.delete(op.operationId);
      if (op.type === 'UPDATE_NODE_POSITION' && positionOpSentAt.current.delete(op.operationId) && pendingDragPositions.current) {
        dragFlushRef.current();
      }
      const key = opKey(op);
      if (latestOwnOpByKey.current.get(key) === op.operationId) {
        latestOwnOpByKey.current.delete(key);
        const draggingNow = op.type === 'UPDATE_NODE_POSITION' && isLocallyDragging(op.nodeId);
        if (!draggingNow) applyOperations([op], { force: true });
      }
    } else {
      lastRemoteOpAt.current = Date.now();
      const alreadyCovered = typeof op.serverVersion === 'number' && op.serverVersion <= serverVersionRef.current;
      if (!alreadyCovered) {
        if (op.type === 'UPDATE_NODE_POSITION') {
          if (!appliedOperations.current.has(op.operationId)) animateRemotePosition(op);
        } else {
          applyOperations([op]);
        }
      }
    }

    appliedOperations.current.add(op.operationId);
    bumpServerVersion(op.serverVersion);
  }, [applyOperations, animateRemotePosition, isLocallyDragging, bumpServerVersion]);

  const fetchCollaborationData = useCallback(async (afterVer: number = 0, mode: 'full' | 'light' | 'none' = 'full'): Promise<SnapshotResult | null> => {
    if (!projectId) return null;
    try {
      const url = `${BASE_URL}/projects/${projectId}/collaboration?afterVersion=${afterVer}`;
      const res = await fetchWithAuth(url);
      const data = await res.json().catch(() => null);

      if (!res.ok || !isApiSuccess(data)) {
        if (mode === 'full') {
          window.dispatchEvent(new CustomEvent('global-toast', { detail: data?.message || '프로젝트를 불러오지 못했습니다.' }));
        }
        return null;
      }

      const result = data.result || {};
      const project = result.project ?? null;
      const operations: any[] = Array.isArray(result.operations)
        ? [...result.operations].sort((a, b) => (Number(a?.serverVersion) || 0) - (Number(b?.serverVersion) || 0))
        : [];
      const version = pickSnapshotVersion(result);

      if (mode === 'none') return { project, operations, version };

      if (project && mode === 'full') {
        restoreFullProjectGraph(project);
        operations.forEach(op => {
          if (typeof op?.operationId !== 'string') return;
          inFlightOps.current.delete(op.operationId);
          const key = opKey(op);
          if (latestOwnOpByKey.current.get(key) === op.operationId) latestOwnOpByKey.current.delete(key);
        });
        applyOperations(operations, { force: true });
        if (version !== null) setServerVersionExact(version);
      } else {
        if (project) {
          if (typeof project.title === 'string') setProjectName(project.title);
          setProjectDescription(project.description || '');
        }
        operations.forEach(op => processIncomingOp(op));
        bumpServerVersion(version);
      }
      return { project, operations, version };
    } catch (err) {
      console.error("Collaboration sync failed", err);
      return null;
    }
  }, [projectId, fetchWithAuth, restoreFullProjectGraph, applyOperations, processIncomingOp, bumpServerVersion, setServerVersionExact]);

  const syncServerVersion = useCallback(() => {
    return fetchCollaborationData(serverVersionRef.current, 'light');
  }, [fetchCollaborationData]);

  const sendVersionedWrite = useCallback(async (send: (baseVersion: number, isRetry: boolean) => Promise<Response>) => {
    markSelfWrite();
    let res = await send(serverVersionRef.current, false);
    let data: any = await res.json().catch(() => ({}));

    for (let attempt = 0; attempt < VERSIONED_WRITE_RETRIES && isVersionConflict(res, data); attempt++) {
      await syncServerVersion();
      markSelfWrite();
      res = await send(serverVersionRef.current, true);
      data = await res.json().catch(() => ({}));
    }

    const ok = res.ok && isApiSuccess(data);
    if (ok) {
      markSelfWrite();
      await syncServerVersion();
    }
    return { ok, data };
  }, [markSelfWrite, syncServerVersion]);

  useEffect(() => {
    const handleGlobalToast = (e: any) => {
      setToastMessage(e.detail);
      setTimeout(() => setToastMessage(null), 3000);
    };
    window.addEventListener('global-toast', handleGlobalToast);
    return () => window.removeEventListener('global-toast', handleGlobalToast);
  }, []);

  useEffect(() => {
    fetchWithAuth(`${BASE_URL}/members/me`)
      .then(res => {
        if (res.status === 401) { navigate('/login'); throw new Error('Unauthorized'); }
        return res.json();
      })
      .then(data => {
        const isSuccess = data.isSuccess ?? data.is_success;
        if (isSuccess && data.result) setUserInfo({ id: data.result.id, nickname: data.result.nickname, email: data.result.email });
        else setUserInfo({ id: 0, nickname: '사용자', email: '알 수 없음' });
      })
      .catch(() => setUserInfo({ id: 0, nickname: '사용자', email: '알 수 없음' }));

    fetchWithAuth(`${BASE_URL}/projects`)
      .then(res => res.json())
      .then(data => {
        if (data.isSuccess ?? data.is_success) {
          const currentProject = (data.result.projectList || []).find((p: any) => p.projectId === Number(projectId));
          const role = String(currentProject?.accessRole || currentProject?.role || 'VIEWER').toUpperCase();
          setMyRole(role === 'OWNER' || role === 'EDITOR' ? role : 'VIEWER');
        }
      })
      .catch(() => {});
  }, [projectId, fetchWithAuth, navigate]);

  const publishOp = useCallback((op: PendingOp) => {
    const client = stompClient.current;
    if (!projectId || !client?.connected || syncPausedRef.current) {
      heldOps.current.push(op);
      return;
    }
    inFlightOps.current.set(op.operationId, op);
    try {
      client.publish({
        destination: `/app/projects/${projectId}/operations`,
        body: JSON.stringify({
          operationId: op.operationId,
          clientId: clientId.current,
          baseVersion: serverVersionRef.current,
          type: op.type,
          nodeId: op.nodeId,
          payload: op.payload
        })
      });
    } catch (e) {
      inFlightOps.current.delete(op.operationId);
      heldOps.current.push(op);
    }
  }, [projectId]);

  const sendOperation = useCallback((type: CollabOpType, nodeId: string, payload: Record<string, unknown>) => {
    if (myRoleRef.current === 'VIEWER') return;
    const op: PendingOp = { operationId: makeId('op'), type, nodeId, payload };
    appliedOperations.current.add(op.operationId);
    latestOwnOpByKey.current.set(opKey(op), op.operationId);
    if (type === 'UPDATE_NODE_POSITION') positionOpSentAt.current.set(op.operationId, Date.now());
    publishOp(op);
  }, [publishOp]);

  const countPositionOpsInFlight = useCallback(() => {
    const now = Date.now();
    let count = 0;
    positionOpSentAt.current.forEach((sentAt, operationId) => {
      if (!inFlightOps.current.has(operationId) || now - sentAt > DRAG_OP_ACK_TIMEOUT_MS) positionOpSentAt.current.delete(operationId);
      else count++;
    });
    return count;
  }, []);

  const sendNodePositions = useCallback((positions: DraggedNodePosition[], skipUnchanged: boolean) => {
    positions.forEach(p => {
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      const last = lastSentDragPositions.current.get(p.id);
      if (skipUnchanged && last && last.x === x && last.y === y) return;
      lastSentDragPositions.current.set(p.id, { x, y });
      sendOperation('UPDATE_NODE_POSITION', p.id, { positionX: x, positionY: y });
    });
  }, [sendOperation]);

  const flushDragPositions = useCallback(() => {
    if (dragOpTimer.current !== null) {
      window.clearTimeout(dragOpTimer.current);
      dragOpTimer.current = null;
    }
    const positions = pendingDragPositions.current;
    if (!positions) return;
    const now = Date.now();
    const wait = DRAG_OP_INTERVAL_MS * positions.length - (now - lastDragOpAt.current);
    if (wait > 0) {
      dragOpTimer.current = window.setTimeout(flushDragPositions, wait);
      return;
    }
    if (countPositionOpsInFlight() >= DRAG_OP_PIPELINE * positions.length) {
      dragOpTimer.current = window.setTimeout(flushDragPositions, DRAG_OP_ACK_TIMEOUT_MS);
      return;
    }
    pendingDragPositions.current = null;
    lastDragOpAt.current = now;
    sendNodePositions(positions, true);
  }, [sendNodePositions, countPositionOpsInFlight]);

  useEffect(() => { dragFlushRef.current = flushDragPositions; }, [flushDragPositions]);

  const handleNodesDragMove = useCallback((positions: DraggedNodePosition[]) => {
    if (positions.length === 0) return;
    const now = Date.now();
    positions.forEach(p => {
      locallyDraggedAt.current.set(p.id, now);
      remoteMotions.current.delete(p.id);
    });
    if (positions.length > DRAG_OP_MAX_NODES) return;

    pendingDragPositions.current = positions;
    if (dragOpTimer.current === null) flushDragPositions();
  }, [flushDragPositions]);

  const handleNodesDragEnd = useCallback((positions: DraggedNodePosition[]) => {
    if (dragOpTimer.current !== null) {
      window.clearTimeout(dragOpTimer.current);
      dragOpTimer.current = null;
    }
    pendingDragPositions.current = null;
    sendNodePositions(positions, false);
    lastSentDragPositions.current.clear();
    lastDragOpAt.current = 0;
    positions.forEach(p => locallyDraggedAt.current.delete(p.id));
  }, [sendNodePositions]);

  const handleNodeNameChange = useCallback((nodeId: string, newName: string) => {
    const existing = pendingNameEdits.current.get(nodeId);
    if (existing) window.clearTimeout(existing.timer);
    const timer = window.setTimeout(() => {
      pendingNameEdits.current.delete(nodeId);
      if (!newName.trim()) return;
      sendOperation('UPDATE_NODE_NAME', nodeId, { value: newName });
    }, NAME_OP_DEBOUNCE_MS);
    pendingNameEdits.current.set(nodeId, { name: newName, timer });
  }, [sendOperation]);

  const reapplyPendingNameEdits = () => {
    if (pendingNameEdits.current.size === 0) return;
    const edits = new Map(Array.from(pendingNameEdits.current.entries()).map(([id, edit]) => [id, edit.name]));
    setNodes(prev => prev.map(n => edits.has(n.id) ? { ...n, name: edits.get(n.id) as string } : n));
  };

  const requestTokenRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastTokenRefreshAt.current < 10000) return;
    lastTokenRefreshAt.current = now;
    fetchWithAuth(`${BASE_URL}/members/me`).catch(() => {});
  }, [fetchWithAuth]);

  const settleInFlightOps = (reason: ResyncReason, snapshot: SnapshotResult | null, restored: boolean) => {
    const pending = Array.from(inFlightOps.current.values());
    if (pending.length === 0) return;

    if (reason === 'resync') {
      if (restored) applyOperations(pending, { force: true });
      return;
    }

    inFlightOps.current.clear();
    pending.forEach(op => {
      const key = opKey(op);
      if (latestOwnOpByKey.current.get(key) === op.operationId) latestOwnOpByKey.current.delete(key);
    });

    let unapplied = pending;
    if (snapshot?.project) {
      const serverNodes = computeServerNodeStates(snapshot.project, snapshot.operations);
      unapplied = pending.filter(op => !isOpReflected(op, serverNodes));
    }
    if (unapplied.length > 0) setUnappliedOps(prev => coalesceOps([...prev, ...unapplied]));
  };

  const flushHeldOps = () => {
    if (heldOps.current.length === 0 || !stompClient.current?.connected) return;
    const held = coalesceOps(heldOps.current);
    heldOps.current = [];
    applyOperations(held, { force: true });
    held.forEach(op => publishOp(op));
  };

  const performSync = async (reason: ResyncReason) => {
    syncPausedRef.current = true;
    if (reason === 'conflict') setIsConflictSyncing(true);

    const firstLoad = !hasLoadedOnce.current;
    const isSelfWrite = Date.now() - lastSelfWriteAt.current < SELF_WRITE_WINDOW_MS;
    const keepLocalGraph = !firstLoad && myRole === 'OWNER' && (isSelfWrite || hasUnsavedChanges.current);

    let snapshot: SnapshotResult | null = null;
    let restored = false;
    try {
      if (firstLoad) {
        snapshot = await fetchCollaborationData(0, 'full');
        restored = Boolean(snapshot?.project);
      } else if (keepLocalGraph) {
        snapshot = await fetchCollaborationData(serverVersionRef.current, 'light');
        if (reason === 'resync' && !isSelfWrite) {
          window.dispatchEvent(new CustomEvent('global-toast', { detail: '다른 곳에서 프로젝트가 변경되었습니다. 저장하지 않은 작업이 있어 캔버스는 그대로 유지했습니다.' }));
        }
      } else if (reason === 'resync') {
        snapshot = await fetchCollaborationData(0, 'full');
        restored = Boolean(snapshot?.project);
      } else {
        snapshot = await fetchCollaborationData(serverVersionRef.current, 'full');
        restored = Boolean(snapshot?.project);
      }
    } finally {
      const buffered = bufferedBroadcasts.current.sort((a, b) => (Number(a?.serverVersion) || 0) - (Number(b?.serverVersion) || 0));
      bufferedBroadcasts.current = [];
      syncPausedRef.current = false;
      buffered.forEach(op => processIncomingOp(op));

      settleInFlightOps(reason, snapshot, restored);
      if (restored) reapplyPendingNameEdits();
      flushHeldOps();
      if (reason === 'conflict') setIsConflictSyncing(false);
    }
  };

  const runSync = useCallback((reason: ResyncReason) => {
    syncChain.current = syncChain.current
      .then(() => performSyncRef.current(reason))
      .catch(err => console.error('Collaboration sync failed', err));
  }, []);

  const retryUnappliedOps = () => {
    const ops = unappliedOps;
    setUnappliedOps([]);
    if (ops.length === 0) return;
    setNodes(prev => ops.reduce<NodeData[]>((acc, op) => applyOpToNodes(acc, op), prev));
    ops.forEach(op => sendOperation(op.type, op.nodeId, op.payload));
  };

  const discardUnappliedOps = async () => {
    const ops = unappliedOps;
    setUnappliedOps([]);
    if (ops.length === 0) return;
    const snapshot = await fetchCollaborationData(0, 'none');
    if (!snapshot?.project) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '최신 내용을 불러오지 못했습니다. 새로고침해 주세요.' }));
      return;
    }
    const serverNodes = computeServerNodeStates(snapshot.project, snapshot.operations);
    const targets = new Set(ops.map(op => op.nodeId));
    setNodes(prev => prev.map(n => {
      if (!targets.has(n.id)) return n;
      const server = serverNodes.get(n.id);
      return server ? { ...n, name: server.name, x: server.x, y: server.y } : n;
    }));
  };

  const describeOp = (op: PendingOp) => {
    const name = nodes.find(n => n.id === op.nodeId)?.name || '알 수 없는 노드';
    return op.type === 'UPDATE_NODE_NAME'
      ? `노드 이름을 '${String(op.payload.value)}'(으)로 변경`
      : `'${name}' 노드 위치 이동`;
  };

  const collabHandlers = useRef({
    runSync: (_reason: ResyncReason) => {},
    processIncomingOp: (_op: any) => {},
    requestTokenRefresh: () => {}
  });
  useEffect(() => {
    performSyncRef.current = performSync;
    collabHandlers.current = {
      runSync,
      processIncomingOp,
      requestTokenRefresh
    };
  });

  const hasAccessToken = Boolean(accessToken);

  useEffect(() => {
    if (!projectId || !userInfo.id || !hasAccessToken) return;

    const client: Client = new Client({
      brokerURL: `${WS_BASE_URL}/ws/collaboration`,
      reconnectDelay: 3000,
      beforeConnect: () => {
        client.connectHeaders = { Authorization: `Bearer ${accessTokenRef.current ?? ''}` };
      },
      onConnect: () => {
        console.log('STOMP Collaboration Connected');
        syncPausedRef.current = true;
        bufferedBroadcasts.current = [];

        client.subscribe(`/topic/projects/${projectId}/operations`, (msg) => {
          let op: any;
          try { op = JSON.parse(msg.body); } catch (e) { return; }
          if (syncPausedRef.current) bufferedBroadcasts.current.push(op);
          else collabHandlers.current.processIncomingOp(op);
        });

        client.subscribe(`/topic/projects/${projectId}/resync`, () => {
          collabHandlers.current.runSync('resync');
        });

        client.subscribe(`/user/queue/projects/${projectId}/operation-results`, (msg) => {
          let result: any = {};
          try { result = JSON.parse(msg.body); } catch (e) {}
          const code = String(result?.code || '');
          if (code === 'COLLAB409_1' || code === 'COLLAB409_2') {
            collabHandlers.current.runSync('conflict');
          } else {
            window.dispatchEvent(new CustomEvent('global-toast', { detail: OPERATION_ERROR_MESSAGES[code] || '변경 내용을 반영하지 못했습니다. 새로고침해 주세요.' }));
          }
        });

        collabHandlers.current.runSync('connect');
      },
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        collabHandlers.current.requestTokenRefresh();
      },
      onWebSocketClose: () => {
        syncPausedRef.current = true;
      }
    });

    stompClient.current = client;
    client.activate();

    return () => {
      client.deactivate();
      if (stompClient.current === client) stompClient.current = null;
    };
  }, [projectId, userInfo.id, hasAccessToken]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(200, Math.min(e.clientX - 10, window.innerWidth / 2));
        setLeftWidth(newWidth);
      } else if (isResizingRight) {
        const newWidth = Math.max(200, Math.min(window.innerWidth - e.clientX - 10, window.innerWidth / 2));
        setRightWidth(newWidth);
      } else if (isResizingCodeViewer) {
        const rightSidebarSpace = showRightSidebar ? rightWidth + 16 : 0;
        const paddingRight = 10;
        const newWidth = window.innerWidth - e.clientX - rightSidebarSpace - paddingRight;
        setCodeViewerWidth(Math.max(250, Math.min(newWidth, window.innerWidth * 0.6)));
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false); setIsResizingRight(false); setIsResizingCodeViewer(false);
    };

    if (isResizingLeft || isResizingRight || isResizingCodeViewer) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none'; 
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingLeft, isResizingRight, isResizingCodeViewer, showRightSidebar, rightWidth]);

  useEffect(() => {
    if (!isDataLoaded.current) return;

    setFiles(prevFiles => {
      let changed = false;
      const nextFiles = prevFiles.map(f => {
        if (f.lastHash) {
          const currentHash = computeFileHash(f, nodes, edges, cloudProvider, includeLocal, cloudSettings);
          const isNowMatched = (currentHash === f.lastHash);
          if (f.isGenerated !== isNowMatched) {
            changed = true;
            return { ...f, isGenerated: isNowMatched };
          }
        }
        return f;
      });
      return changed ? nextFiles : prevFiles;
    });
  }, [nodes, edges, cloudProvider, includeLocal, cloudSettings, filesStructureDep]);

  useEffect(() => {
    if (isDataLoaded.current) {
      const currentFileIds = files.map(f => f.id);
      if (targetFileIds.length !== currentFileIds.length || !currentFileIds.every(id => targetFileIds.includes(id))) {
        setTargetFileIds(currentFileIds);
      }
    }
  }, [files, targetFileIds]);

  const unassignedNodeIds = nodes.filter(n => !files.some(f => f.nodeIds.includes(n.id))).map(n => n.id);
  const activeNodes = nodes.filter(n => !unassignedNodeIds.includes(n.id));
  const activeEdges = edges.filter(e => !unassignedNodeIds.includes(e.sourceId) && !unassignedNodeIds.includes(e.targetId));

  const prevAssignedNodeIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    const assigned = new Set(files.flatMap(f => f.nodeIds));
    const previous = prevAssignedNodeIds.current;
    prevAssignedNodeIds.current = assigned;
    if (!previous || myRole !== 'OWNER' || !isDataLoaded.current || isUndoRedo.current) return;

    const nodeIdSet = new Set(nodes.map(n => n.id));
    const movedOut = new Set(Array.from(previous).filter(id => !assigned.has(id) && nodeIdSet.has(id)));
    if (movedOut.size === 0) return;

    const cut = edges.filter(e => movedOut.has(e.sourceId) || movedOut.has(e.targetId));
    if (cut.length === 0) return;
    setEdges(prev => prev.filter(e => !movedOut.has(e.sourceId) && !movedOut.has(e.targetId)));
    const movedNames = nodes.filter(n => movedOut.has(n.id)).map(n => `'${n.name}'`).join(', ');
    logActivity(`[연결 해제] ${movedNames} 노드를 낱개로 옮겨 연결을 끊었습니다.`);
  }, [files, nodes, edges, myRole, logActivity]);

  const validationErrors: ValidationError[] = [];

  if (activeNodes.length === 0 && nodes.length > 0) {
    validationErrors.push({ name: '생성 대상 노드 없음', desc: '코드로 생성할 노드를 [생성할 노드 목록]으로 이동해주세요.', isProjectTab: true });
  } else if (nodes.length === 0) {
    validationErrors.push({ name: '노드 미배치', desc: '캔버스에 노드를 1개 이상 배치해야 합니다.' });
  }

  if (targetFileIds.length === 0) {
    validationErrors.push({ 
      name: '생성 대상 없음', 
      desc: '[생성할 노드 목록]이 없습니다.', 
      isProjectTab: true, 
      targetField: 'target-file-box' 
    });
  }

  const nameRegex = /^[a-zA-Z0-9_-]+$/;
  const portMap = new Map<number, {id: string, name: string}[]>();

  activeNodes.forEach(node => {
    const settings = node.settings || {};

    if (!String(node.name || '').trim()) {
      validationErrors.push({ name: '노드 이름 누락', desc: `${node.type} 노드의 [노드 이름]이 비어 있습니다.`, targetNodeId: node.id, targetField: 'displayName' });
    }

    const checkNameFormat = (val: string | undefined, label: string, fieldKey: string) => {
      if (val && !nameRegex.test(val)) {
        validationErrors.push({ 
          name: `${label} 형식 오류`, 
          desc: `'${node.name}' 노드의 [${label}]에는 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.`,
          targetNodeId: node.id, targetField: fieldKey 
        });
      }
    };

    if (!settings.name) validationErrors.push({ name: '서비스 이름 누락', desc: `'${node.name}' 노드의 [서비스 이름]을 입력해주세요.`, targetNodeId: node.id, targetField: 'name' });
    else checkNameFormat(settings.name, '서비스 이름', 'name');

    const checkDatabaseName = (val: string) => {
      if (!DB_NAME_REGEX.test(val)) {
        validationErrors.push({ name: '데이터베이스 이름 형식 오류', desc: `'${node.name}' 노드의 [데이터베이스 이름]에는 영문, 숫자, 언더바(_)만 사용할 수 있습니다.`, targetNodeId: node.id, targetField: 'databaseName' });
      }
    };

    if (!settings.containerName) {
      if (node.type !== 'PostgreSQL') validationErrors.push({ name: '컨테이너 이름 누락', desc: `'${node.name}' 노드의 [컨테이너 이름]을 입력해주세요.`, targetNodeId: node.id, targetField: 'containerName' });
    }
    else checkNameFormat(settings.containerName, '컨테이너 이름', 'containerName');

    if (!settings.port) {
      validationErrors.push({ name: '포트 번호 누락', desc: `'${node.name}' 노드의 [포트 번호]를 입력해주세요.`, targetNodeId: node.id, targetField: 'port' });
    } else {
      const portNum = Number(settings.port);
      if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
        validationErrors.push({ name: '포트 번호 범위 초과', desc: `'${node.name}' 노드의 포트 번호는 1024부터 65535 사이의 숫자여야 합니다.`, targetNodeId: node.id, targetField: 'port' });
      } else {
        if (!portMap.has(portNum)) portMap.set(portNum, []);
        portMap.get(portNum)!.push({ id: node.id, name: node.name });
      }
    }

    if (node.type === 'MySQL') {
      if (!settings.imageVersion) validationErrors.push({ name: 'MySQL 버전 누락', desc: `'${node.name}' 노드의 [도커 이미지 버전]을 선택해주세요.`, targetNodeId: node.id, targetField: 'imageVersion' });
      if (!settings.databaseName) validationErrors.push({ name: 'DB 이름 누락', desc: `'${node.name}' 노드의 [데이터베이스 이름]을 입력해주세요.`, targetNodeId: node.id, targetField: 'databaseName' });
      else checkDatabaseName(String(settings.databaseName));
      if (!settings.username) validationErrors.push({ name: 'DB 사용자 누락', desc: `'${node.name}' 노드의 [사용자 이름]을 입력해주세요.`, targetNodeId: node.id, targetField: 'username' });
      else checkNameFormat(settings.username, '사용자 이름', 'username');
      if (!settings.userPassword) validationErrors.push({ name: 'DB 비밀번호 누락', desc: `'${node.name}' 노드의 [사용자 비밀번호]를 입력해주세요.`, targetNodeId: node.id, targetField: 'userPassword' });
      if (!settings.rootPassword || String(settings.rootPassword).length < 8) validationErrors.push({ name: 'DB 루트 비밀번호 오류', desc: `'${node.name}' 노드의 [루트 비밀번호]를 8자리 이상 입력해주세요.`, targetNodeId: node.id, targetField: 'rootPassword' });
    }

    if (node.type === 'Redis') {
      if (!settings.imageVersion) validationErrors.push({ name: 'Redis 버전 누락', desc: `'${node.name}' 노드의 [도커 이미지 버전]을 선택해주세요.`, targetNodeId: node.id, targetField: 'imageVersion' });
      if (!settings.password) validationErrors.push({ name: 'Redis 비밀번호 누락', desc: `'${node.name}' 노드의 [비밀번호]를 입력해주세요.`, targetNodeId: node.id, targetField: 'password' });
    }

    if (node.type === 'PostgreSQL') {
      if (!settings.imageVersion) validationErrors.push({ name: 'PostgreSQL 버전 누락', desc: `'${node.name}' 노드의 [도커 이미지 버전]을 선택해주세요.`, targetNodeId: node.id, targetField: 'imageVersion' });
      if (!settings.databaseName) validationErrors.push({ name: 'DB 이름 누락', desc: `'${node.name}' 노드의 [데이터베이스 이름]을 입력해주세요.`, targetNodeId: node.id, targetField: 'databaseName' });
      else checkDatabaseName(String(settings.databaseName));
      if (!String(settings.username || '').trim()) validationErrors.push({ name: 'DB 사용자 누락', desc: `'${node.name}' 노드의 [사용자 이름]을 입력해주세요.`, targetNodeId: node.id, targetField: 'username' });
      if (!settings.password || String(settings.password).length < 8) validationErrors.push({ name: 'DB 비밀번호 오류', desc: `'${node.name}' 노드의 [비밀번호]를 8자리 이상 입력해주세요.`, targetNodeId: node.id, targetField: 'password' });
    }

    if (node.type === 'Spring Boot') {
      if (!settings.javaVersion) validationErrors.push({ name: 'Spring Boot 버전 누락', desc: `'${node.name}' 노드의 [Java 버전]을 선택해주세요.`, targetNodeId: node.id, targetField: 'javaVersion' });
    }
  });

  portMap.forEach((nodesInfo, port) => {
    if (nodesInfo.length > 1) {
      nodesInfo.forEach(nodeInfo => {
        validationErrors.push({ 
          name: '포트 번호 중복', 
          desc: `포트 번호 ${port}가 여러 노드(${nodesInfo.map(n => n.name).join(', ')})에서 중복 사용되고 있습니다.`, 
          targetNodeId: nodeInfo.id, 
          targetField: 'port' 
        });
      });
    }
  });

  activeEdges.forEach(edge => {
    const sNode = activeNodes.find(n => n.id === edge.sourceId);
    const tNode = activeNodes.find(n => n.id === edge.targetId);
    if (sNode && tNode) {
      const isSourceDb = isDependencyType(sNode.type);
      const isTargetServer = tNode.type === 'Spring Boot';
      if (!isSourceDb || !isTargetServer) {
        validationErrors.push({
          name: '잘못된 노드 연결 방향',
          desc: `'${sNode.name}'(${sNode.type})에서 '${tNode.name}'(${tNode.type})로 연결되었습니다. 연결은 Database에서 Spring Boot 방향이어야 합니다.`,
          targetNodeId: sNode.id,
          edgeId: edge.id
        });
      }
    }
  });

  const connectedNodeIds = new Set(activeEdges.flatMap(e => [e.sourceId, e.targetId]));
  activeNodes.forEach(node => {
    if (connectedNodeIds.has(node.id)) return;
    validationErrors.push({
      name: '연결되지 않은 노드',
      desc: `'${node.name}' 노드가 다른 노드와 연결되어 있지 않습니다. 다른 노드와 연결하거나, 생성에서 빼려면 [낱개로 배치된 Node]로 옮겨 주세요.`,
      targetNodeId: node.id,
      isProjectTab: true
    });
  });

  activeNodes.filter(n => n.type === 'Spring Boot').forEach(app => {
    const connectedByType = new Map<string, { names: string[]; edgeId: string }>();
    activeEdges.forEach(edge => {
      const otherId = edge.sourceId === app.id ? edge.targetId : edge.targetId === app.id ? edge.sourceId : null;
      const other = otherId ? activeNodes.find(n => n.id === otherId) : undefined;
      if (!other || !isDependencyType(other.type)) return;
      const entry = connectedByType.get(other.type) || { names: [], edgeId: edge.id };
      entry.names.push(other.name);
      entry.edgeId = edge.id;
      connectedByType.set(other.type, entry);
    });
    connectedByType.forEach((entry, type) => {
      if (entry.names.length > 1) {
        validationErrors.push({
          name: '같은 종류 DB 중복 연결',
          desc: `'${app.name}'에 ${type} 노드가 ${entry.names.length}개(${entry.names.join(', ')}) 연결되어 있습니다. 같은 종류의 DB는 하나만 연결할 수 있습니다.`,
          targetNodeId: app.id,
          edgeId: entry.edgeId
        });
      }
    });
  });

  const checkCloudNameFormat = (val: string | undefined, label: string, key: string) => {
    if (val && !nameRegex.test(val)) {
      validationErrors.push({ name: `클라우드 이름 형식 오류`, desc: `Settings 탭의 [${label}]에는 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.`, isGlobal: true, targetField: key });
    }
  };

  const cloudNameFields = [
    { key: 'vpcName', label: 'VPC/VCN Name' }, { key: 'subnetName', label: 'Subnet Name' },
    { key: 'internetGatewayName', label: 'IGW Name' }, { key: 'routeTableName', label: 'Route Table Name' },
    { key: 'securityGroupName', label: 'Security Group/List Name' }, { key: 'instanceName', label: 'Instance Name' }
  ];

  if (cloudProvider !== 'LOCAL') {
    cloudNameFields.forEach(({ key, label }) => {
      checkCloudNameFormat(cloudSettings[key as keyof CloudSettings], label, key);
    });

    if (cloudProvider === 'AWS') {
      const requiredAws = [
        { key: 'region', label: 'Region' }, { key: 'vpcName', label: 'VPC Name' }, { key: 'subnetName', label: 'Subnet Name' },
        { key: 'internetGatewayName', label: 'IGW Name' }, { key: 'routeTableName', label: 'Route Table Name' },
        { key: 'securityGroupName', label: 'Security Group Name' }, { key: 'instanceName', label: 'Instance Name' },
        { key: 'amiId', label: 'AMI ID' }, { key: 'adminCidr', label: 'Admin CIDR' }, { key: 'appCidr', label: 'App CIDR' }
      ];
      requiredAws.forEach(({ key, label }) => {
        if (!String(cloudSettings[key as keyof CloudSettings] || '').trim()) {
          validationErrors.push({ name: `AWS 필수값 누락`, desc: `Settings 탭에서 [${label}] 값을 입력하세요.`, isGlobal: true, targetField: key });
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
          validationErrors.push({ name: `OCI 필수값 누락`, desc: `Settings 탭에서 [${label}] 값을 입력하세요.`, isGlobal: true, targetField: key });
        }
      });
    }
  }

  useEffect(() => { setActiveSubTab(0); }, [selectedFileId]);
  useEffect(() => { setShowSecrets(false); }, [selectedFileId, activeSubTab]);

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

  const prevEdges = useRef(edges);
  useEffect(() => {
    if (isDataLoaded.current && !isUndoRedo.current) {
      hasUnsavedChanges.current = true;
      if (edges.length > prevEdges.current.length) {
        const addedEdges = edges.filter(e => !prevEdges.current.some(pe => pe.id === e.id));
        addedEdges.forEach(e => {
          const source = nodes.find(n => n.id === e.sourceId);
          const target = nodes.find(n => n.id === e.targetId);
          if (source && target) logActivity(`[연결] '${source.name}' 노드와 '${target.name}' 노드를 연결했습니다.`);
        });
      }
    }
    prevEdges.current = edges;
  }, [edges, nodes, logActivity]);

  const prevFiles = useRef(files);
  useEffect(() => {
    if (isDataLoaded.current && !isUndoRedo.current) {
      hasUnsavedChanges.current = true;
      files.forEach(currentFile => {
        const previousFile = prevFiles.current.find(f => f.id === currentFile.id);
        if (previousFile) {
          if (previousFile.name !== currentFile.name) {
            if (previousFile.name === '') logActivity(`[생성] '${currentFile.name}' 폴더를 새로 만들었습니다.`);
            else logActivity(`[수정] 폴더명이 '${previousFile.name}'에서 '${currentFile.name}'(으)로 변경되었습니다.`);
          }
          if (currentFile.nodeIds.length > previousFile.nodeIds.length) {
            const addedNodeIds = currentFile.nodeIds.filter(id => !previousFile.nodeIds.includes(id));
            addedNodeIds.forEach(nodeId => {
              const node = nodes.find(n => n.id === nodeId);
              if (node) logActivity(`[배치] '${node.name}' 노드를 '${currentFile.name}' 안에 포함시켰습니다.`);
            });
          }
        }
      });
    }
    prevFiles.current = files;
  }, [files, nodes, logActivity]);

  const prevTargetFileIds = useRef(targetFileIds);
  useEffect(() => {
    if (isDataLoaded.current && !isUndoRedo.current) {
      hasUnsavedChanges.current = true;
      if (targetFileIds.length > prevTargetFileIds.current.length) {
        const addedIds = targetFileIds.filter(id => !prevTargetFileIds.current.includes(id));
        addedIds.forEach(id => {
          const file = files.find(f => f.id === id);
          if (file) logActivity(`[이동] '${file.name}' 폴더가 생성할 대상 목록에 들어갔습니다.`);
        });
      }
    }
    prevTargetFileIds.current = targetFileIds;
  }, [targetFileIds, files, logActivity]);

  useEffect(() => {
    if (isDataLoaded.current && !isUndoRedo.current) hasUnsavedChanges.current = true;
  }, [projectName, projectDescription, nodes, includeLocal, cloudProvider, cloudSettings]);

  const processProperties = (n: NodeData, rawProperties: any) => {
    const finalProperties: Record<string, any> = {};
    for (const key in rawProperties) {
      if (rawProperties[key] !== undefined && rawProperties[key] !== null && rawProperties[key] !== '') {
        if (typeof rawProperties[key] === 'object') finalProperties[key] = rawProperties[key];
        else if (key === 'port') finalProperties[key] = Number(rawProperties[key]);
        else if (key === 'fileGeneratedCodes' || key.startsWith('global')) finalProperties[key] = rawProperties[key];
        else finalProperties[key] = String(rawProperties[key]).trim();
      }
    }

    const envKeys = ENV_KEYS_BY_COMPONENT[toComponentType(n.type)];
    if (envKeys) {
      const envObj: Record<string, string> = {};
      envKeys.forEach(k => {
        if (finalProperties[k]) {
          envObj[k] = String(finalProperties[k]).trim();
          delete finalProperties[k];
        }
      });
      finalProperties.env = envObj;
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

      const motion = remoteMotions.current.get(n.id);
      return {
        nodeId: n.id,
        nodeName: String(n.name || '').trim() ? n.name : n.type,
        componentType: toComponentType(n.type),
        positionX: Math.round(motion ? motion.toX : n.x),
        positionY: Math.round(motion ? motion.toY : n.y),
        properties: processProperties(n, rawProperties)
      };
    });

    const mappedEdges = edges.map(e => {
      let sNode = nodes.find(n => n.id === e.sourceId);
      let tNode = nodes.find(n => n.id === e.targetId);
      if (sNode?.type === 'Spring Boot' && isDependencyType(tNode?.type)) {
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

  const putProjectGraph = (currentFiles?: FileGroup[]) => {
    const firstFiles = currentFiles ?? files;
    const firstMapped = getMappedCanvasData(firstFiles);
    let sentSig = buildGraphSignature(nodes, edges, firstFiles, targetFileIds, cloudProvider, includeLocal, cloudSettings);

    return sendVersionedWrite(async (baseVersion, isRetry) => {
      let mapped = firstMapped;
      if (isRetry) {
        await new Promise(resolve => setTimeout(resolve, 60));
        mapped = latestMappedRef.current();
        const g = graphStateRef.current;
        sentSig = buildGraphSignature(g.nodes, g.edges, g.files, g.targetFileIds, g.cloudProvider, g.includeLocal, g.cloudSettings);
      }
      return fetchWithAuth(`${BASE_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: projectName,
          description: projectDescription,
          nodes: mapped.mappedNodes,
          edges: mapped.mappedEdges,
          baseVersion
        })
      });
    }).then(result => {
      if (result.ok) {
        lastSyncedGraphSig.current = sentSig;
        liveSyncFailedNotified.current = false;
      }
      return result;
    });
  };

  const runLiveSync = async () => {
    if (myRole !== 'OWNER' || appMode !== 'editor' || !projectId || !hasLoadedOnce.current) return;
    const quietFor = Date.now() - lastRemoteOpAt.current;
    if (quietFor < LIVE_SYNC_QUIET_MS) {
      if (liveSyncQuietTimer.current === null) {
        liveSyncQuietTimer.current = window.setTimeout(() => {
          liveSyncQuietTimer.current = null;
          runLiveSyncRef.current();
        }, LIVE_SYNC_QUIET_MS - quietFor + 20);
      }
      return;
    }
    if (liveSyncInFlight.current) {
      liveSyncAgain.current = true;
      return;
    }
    const targetSig = latestGraphSigRef.current;
    if (targetSig === null || targetSig === lastSyncedGraphSig.current) return;

    liveSyncInFlight.current = true;
    try {
      const { ok } = await putProjectGraph();
      if (ok) {
        if (latestGraphSigRef.current === lastSyncedGraphSig.current) hasUnsavedChanges.current = false;
      } else if (!liveSyncFailedNotified.current) {
        liveSyncFailedNotified.current = true;
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '변경 사항을 실시간으로 저장하지 못했습니다. 상단 저장 버튼으로 다시 저장해 주세요.' }));
      }
    } catch (err) {
      if (!liveSyncFailedNotified.current) {
        liveSyncFailedNotified.current = true;
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '변경 사항을 실시간으로 저장하지 못했습니다. 상단 저장 버튼으로 다시 저장해 주세요.' }));
      }
    } finally {
      liveSyncInFlight.current = false;
      if (liveSyncAgain.current) {
        liveSyncAgain.current = false;
        window.setTimeout(() => runLiveSyncRef.current(), LIVE_SYNC_DEBOUNCE_MS);
      }
    }
  };

  useEffect(() => {
    runLiveSyncRef.current = () => { runLiveSync(); };
    latestMappedRef.current = () => getMappedCanvasData();
    graphStateRef.current = { nodes, edges, files, targetFileIds, cloudProvider, includeLocal, cloudSettings };
  });

  useEffect(() => {
    const clearLiveSyncTimer = () => {
      if (liveSyncTimer.current) window.clearTimeout(liveSyncTimer.current.timer);
      liveSyncTimer.current = null;
    };
    if (myRole !== 'OWNER' || appMode !== 'editor') {
      clearLiveSyncTimer();
      return;
    }
    const sig = buildGraphSignature(nodes, edges, files, targetFileIds, cloudProvider, includeLocal, cloudSettings);
    latestGraphSigRef.current = sig;

    if (!isDataLoaded.current || lastSyncedGraphSig.current === null) {
      lastSyncedGraphSig.current = sig;
      return;
    }
    if (sig === lastSyncedGraphSig.current) {
      clearLiveSyncTimer();
      hasUnsavedChanges.current = false;
      return;
    }
    if (liveSyncTimer.current?.sig === sig) return;
    clearLiveSyncTimer();
    liveSyncTimer.current = {
      sig,
      timer: window.setTimeout(() => {
        liveSyncTimer.current = null;
        runLiveSyncRef.current();
      }, LIVE_SYNC_DEBOUNCE_MS)
    };
  }, [nodes, edges, files, targetFileIds, cloudProvider, includeLocal, cloudSettings, myRole, appMode]);

  useEffect(() => () => {
    if (liveSyncTimer.current) window.clearTimeout(liveSyncTimer.current.timer);
    if (liveSyncQuietTimer.current !== null) window.clearTimeout(liveSyncQuietTimer.current);
  }, []);

  const handleSaveCanvas = async (isAutoSave: boolean = false) => {
    if (appMode !== 'editor') return;
    if (myRole === 'VIEWER' || myRole === 'EDITOR') {
      if (!isAutoSave) showToast(saveNotAllowedMessage(myRole));
      return;
    }

    if (!projectId) return;
    if (isAutoSave && !hasUnsavedChanges.current && activityLog.length === 0) return;

    try {
      const { ok, data } = await putProjectGraph();

      if (ok) {
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
        if (!isAutoSave) showToast(writeFailMessage(data, '저장에 실패했습니다.'));
      }
    } catch (err) {
      if (!isAutoSave) showToast(GENERIC_ERROR_MESSAGE);
    }
  };

  useEffect(() => { 
    autoSaveCallback.current = () => { 
      if (appMode === 'editor' && (hasUnsavedChanges.current || activityLog.length > 0) && myRole === 'OWNER') {
        handleSaveCanvas(true); 
      }
    }; 
  }); 

  useEffect(() => {
    if (!isAutoSaveEnabled || !projectId || myRole !== 'OWNER') return;
    const tick = () => { if (autoSaveCallback.current) autoSaveCallback.current(); };
    const timerId = setInterval(tick, 10 * 60 * 1000); 
    return () => clearInterval(timerId);
  }, [isAutoSaveEnabled, projectId, myRole]);

  const handleUpdateProjectName = async (newName: string) => {
    if (myRole !== 'OWNER') {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '프로젝트 이름은 방장(OWNER)만 수정할 수 있습니다.' }));
      return;
    }
    if (!newName.trim() || newName === projectName || !projectId) return;
    const previousName = projectName;
    const hadUnsavedChanges = hasUnsavedChanges.current;
    setProjectName(newName);
    logActivity(`[수정] 프로젝트 이름이 '${newName}'(으)로 변경되었습니다.`);

    try {
      const { ok, data } = await sendVersionedWrite((baseVersion) => fetchWithAuth(`${BASE_URL}/projects/${projectId}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newName, 
          description: projectDescription, 
          baseVersion 
        })
      }));

      if (!ok) {
        showToast(writeFailMessage(data, '프로젝트 이름 저장에 실패했습니다.'));
        setProjectName(previousName);
      } else {
        hasUnsavedChanges.current = hadUnsavedChanges;
      }
    } catch (err) {
      showToast(GENERIC_ERROR_MESSAGE);
      setProjectName(previousName);
    }
  };

  const handleGoHome = () => {
    if (activityLog.length > 0 || hasUnsavedChanges.current) {
      setIsHomeConfirmModalOpen(true);
    } else {
      navigate('/dashboard');
    }
  };

  const confirmGoHome = () => {
    setIsHomeConfirmModalOpen(false);
    navigate('/dashboard');
  };

  const handleResetUI = () => {
    setZoomLevel(1); setIsSelectMode(false); setSelectedNodeIds([]); setSelectedFileId(null);
    setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
    setLeftActiveTab('Project'); setShowRightSidebar(false); setUiResetTrigger(prev => prev + 1);
  };

  const saveHistory = useCallback(() => {
    if (myRole === 'VIEWER') return;
    setHistory((prev) => [...prev, { nodes: [...nodes], edges: [...edges], selectedNodeIds: [...selectedNodeIds], selection: { ...selection }, files: JSON.parse(JSON.stringify(files)), targetFileIds: [...targetFileIds] }]);
    setRedoStack([]); 
  }, [nodes, edges, selectedNodeIds, selection, files, targetFileIds, myRole]);

  const markFilesAsModified = useCallback(() => {}, []);

  const handleGenerateClick = () => {
    if (myRole === 'VIEWER' || myRole === 'EDITOR') {
      showToast(GENERATE_OWNER_ONLY_MESSAGE);
      return;
    }
    if (validationErrors.length > 0) setIsErrorModalOpen(true);
    else setIsConfirmModalOpen(true);
  };

  const confirmGenerate = async () => {
    setIsConfirmModalOpen(false); setAppMode('generating'); setGenProgress(0);
    saveHistory(); 

    if (!projectId) {
      setAppMode('editor');
      return;
    }

    const progressInterval = setInterval(() => setGenProgress(prev => (prev >= 90 ? 90 : prev + 5)), 100);

    try {
      const firstSave = await putProjectGraph();
      if (!firstSave.ok) {
        clearInterval(progressInterval);
        showToast(writeFailMessage(firstSave.data, '프로젝트 저장 중 오류가 발생하여 코드 생성을 중단합니다.'));
        setAppMode('editor');
        return;
      }

      if (activityLog.length > 0) {
        const combinedLogString = activityLog.join('\n');
        await fetchWithAuth(`${BASE_URL}/projects/${projectId}/histories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: combinedLogString })
        });
        setActivityLog([]); 
      }

      const generateNodes = activeNodes.map(n => {
        const rawProperties: any = { ...(n as any).settings };
        rawProperties.fileId = files[0]?.id || 'default';
        rawProperties.fileName = files[0]?.name || '생성할 노드 목록';
        rawProperties.fileIsGenerated = String(files[0]?.isGenerated || false);
        rawProperties.fileGeneratedCodes = JSON.stringify(files[0]?.generatedFiles || []);
        rawProperties.fileIsTarget = 'true';
        return {
          nodeId: n.id, 
          componentType: toComponentType(n.type),
          positionX: Math.round(n.x),
          positionY: Math.round(n.y),
          properties: processProperties(n, rawProperties)
        };
      });

      const generateEdges = activeEdges.map(e => {
        const sourceNode = nodes.find(n => n.id === e.sourceId);
        const targetNode = nodes.find(n => n.id === e.targetId);
        let finalSourceId = e.sourceId; let finalTargetId = e.targetId;
        if (sourceNode?.type === 'Spring Boot' && isDependencyType(targetNode?.type)) {
          finalSourceId = e.targetId; finalTargetId = e.sourceId;
        }
        return { edgeId: e.id, sourceNodeId: finalSourceId, targetNodeId: finalTargetId, connectionType: "DEFAULT" };
      });

      const generatePayload = {
        deploymentOption: cloudProvider, 
        includeLocalSpec: cloudProvider === 'LOCAL' ? false : includeLocal,
        deploymentTarget: cloudProvider === 'LOCAL' ? null : (cloudProvider === 'AWS' ? {
          deploymentOption: 'AWS', 
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
          deploymentOption: 'OCI', 
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
        }),
        nodes: generateNodes,
        edges: generateEdges
      };

      const generateRes = await fetchWithAuth(`${BASE_URL}/projects/${projectId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generatePayload)
      });

      const generateData = await generateRes.json().catch(() => ({}));

      clearInterval(progressInterval);
      setGenProgress(100); 

      if (generateRes.ok && isApiSuccess(generateData)) {
        const generatedFilesFromApi = generateData.result?.files || [];

        const updatedFilesList = [...files];
        if (updatedFilesList.length > 0) {
          const newHash = computeFileHash(updatedFilesList[0], nodes, edges, cloudProvider, includeLocal, cloudSettings);
          updatedFilesList[0] = { ...updatedFilesList[0], isGenerated: true, generatedFiles: generatedFilesFromApi, lastHash: newHash };
        }

        setFiles(updatedFilesList); 

        const secondSave = await putProjectGraph(updatedFilesList);
        if (secondSave.ok) {
          hasUnsavedChanges.current = false;
        } else {
          hasUnsavedChanges.current = true;
          window.dispatchEvent(new CustomEvent('global-toast', { detail: '코드는 생성됐지만 프로젝트에 저장하지 못했습니다. 에디터로 돌아가 저장 버튼을 눌러주세요.' }));
        }
      } else {
        const code = String(generateData?.code || '');
        showToast(GENERATE_ERROR_MESSAGES[code] || generateData?.message || '코드 생성에 실패했습니다. 올바른 값이 입력되었는지 확인해주세요.');
        setAppMode('editor');
        if (GENERATE_SETTINGS_ERROR_CODES.includes(code)) {
          setSelectedNodeIds([]);
          setLeftActiveTab('Settings');
          setShowRightSidebar(true);
        } else if (code.startsWith('PARSING400') || code === 'GENERATION400_9' || code === 'COMMON400_1') {
          setLeftActiveTab('Validation');
          setShowRightSidebar(true);
        }
      }
    } catch (err) {
      clearInterval(progressInterval);
      showToast(GENERIC_ERROR_MESSAGE);
      setAppMode('editor');
    }
  };

  const closeErrorModalAndShowValidation = () => {
    setIsErrorModalOpen(false); setLeftActiveTab('Validation');
    if (!showRightSidebar) setShowRightSidebar(true);
  };

  const [highlightFieldRequest, setHighlightFieldRequest] = useState<{ fields: string[]; token: number } | null>(null);

  const jumpToNextError = useCallback(() => {
    if (validationErrors.length === 0) return;
    const err = validationErrors[0];

    if (err.targetNodeId && err.targetField) {
      setSelectedNodeIds([err.targetNodeId]);
      setSelectedFileId(null);
      setFocusNodeId(err.targetNodeId);
      setLeftActiveTab('Settings');
      if (!showRightSidebar) setShowRightSidebar(true);

      const fieldsForNode = Array.from(new Set(
        validationErrors
          .filter(e => e.targetNodeId === err.targetNodeId && e.targetField)
          .map(e => e.targetField as string)
      ));
      if (fieldsForNode.length > 0) {
        setHighlightFieldRequest({ fields: fieldsForNode, token: Date.now() });
      }
    } else if (err.targetNodeId && !err.targetField) {
      setSelectedNodeIds([err.targetNodeId]);
      setSelectedFileId(null);
      setLeftActiveTab('Settings');
      if (!showRightSidebar) setShowRightSidebar(true);
      if (err.edgeId) {
        setFocusEdgeId(err.edgeId);
      } else {
        setFocusNodeId(err.targetNodeId);
      }
      window.dispatchEvent(new CustomEvent('global-toast', { detail: err.desc }));
    } else if (err.isProjectTab) {
      setLeftActiveTab('Project');
      if (!showRightSidebar) setShowRightSidebar(true);
      if (err.targetField) setHighlightFieldRequest({ fields: [err.targetField], token: Date.now() });
    } else {
      setLeftActiveTab('Settings');
      if (!showRightSidebar) setShowRightSidebar(true);
      if (err.targetField) setHighlightFieldRequest({ fields: [err.targetField], token: Date.now() });
    }
  }, [validationErrors, showRightSidebar]);

  const undo = useCallback(() => {
    if (myRole !== 'OWNER' || history.length === 0) return;
    isUndoRedo.current = true; 
    const previousState = history[history.length - 1];
    setRedoStack((prev) => [...prev, { nodes: [...nodes], edges: [...edges], selectedNodeIds: [...selectedNodeIds], selection: { ...selection }, files: JSON.parse(JSON.stringify(files)), targetFileIds: [...targetFileIds] }]);
    setNodes(previousState.nodes); setEdges(previousState.edges); setSelectedNodeIds(previousState.selectedNodeIds); setSelection(previousState.selection); setFiles(previousState.files); setTargetFileIds(previousState.targetFileIds);
    setHistory((prev) => prev.slice(0, -1));
    setTimeout(() => { isUndoRedo.current = false; }, 100); 
  }, [history, nodes, edges, selectedNodeIds, selection, files, targetFileIds, myRole]);

  const redo = () => {
    if (myRole !== 'OWNER' || redoStack.length === 0) return;
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
    if (myRole !== 'OWNER') {
      if (myRole === 'EDITOR') window.dispatchEvent(new CustomEvent('global-toast', { detail: EDITOR_STRUCTURE_MESSAGE }));
      return;
    }
    saveHistory();
    let finalName = baseName; let counter = 1;
    while (nodes.some(n => n.name === finalName)) { finalName = `${baseName}_${counter}`; counter++; }

    const defaultSettings: any = {};
    if (type === 'MySQL') {
      defaultSettings.imageVersion = 'mysql:8.0';
      defaultSettings.port = '3306';
    } else if (type === 'Spring Boot') {
      defaultSettings.javaVersion = '17';
      defaultSettings.port = '8080';
    } else if (type === 'Redis') {
      defaultSettings.imageVersion = 'redis:7.0';
      defaultSettings.port = '6379';
    } else if (type === 'PostgreSQL') {
      defaultSettings.imageVersion = 'postgres:17';
      defaultSettings.port = '5432';
    }

    const newNode: NodeData = { id: `node-${Date.now()}`, type, name: finalName, x, y, settings: defaultSettings };
    setNodes((prev) => [...prev, newNode]);

    setFiles((prevFiles) => {
      const updatedFiles = [...prevFiles];
      if (updatedFiles.length === 0) {
        updatedFiles.push({ id: `file-${Date.now()}`, name: '생성할 노드 목록', isGenerated: false, nodeIds: [newNode.id], isExpanded: true });
      } else {
        updatedFiles[0] = { ...updatedFiles[0], nodeIds: [...updatedFiles[0].nodeIds, newNode.id] };
      }
      return updatedFiles;
    });

    logActivity(`[배치] '${finalName}' 노드를 캔버스에 배치했습니다.`);
  };

  const deleteSelected = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    if (myRole !== 'OWNER') {
      if (myRole === 'EDITOR') window.dispatchEvent(new CustomEvent('global-toast', { detail: EDITOR_STRUCTURE_MESSAGE }));
      return;
    }
    saveHistory();
    const deletedNodes = nodes.filter(n => selectedNodeIds.includes(n.id)).map(n => n.name);
    if (deletedNodes.length > 0) logActivity(`[삭제] 캔버스에서 ${deletedNodes.map(n => `'${n}'`).join(', ')} 노드를 삭제했습니다.`);
    setNodes((prev) => prev.filter(node => !selectedNodeIds.includes(node.id)));
    setEdges((prev) => prev.filter(edge => !selectedNodeIds.includes(edge.sourceId) && !selectedNodeIds.includes(edge.targetId)));
    setFiles((prev) => prev.map(f => ({ ...f, nodeIds: f.nodeIds.filter(id => !selectedNodeIds.includes(id)) })));
    setSelectedNodeIds([]); setSelectedFileId(null); setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
  }, [selectedNodeIds, nodes, saveHistory, myRole, logActivity]);

  const onCancelSelection = () => {
    saveHistory(); setIsSelectMode(false); setSelection({ x: 0, y: 0, width: 0, height: 0, active: false });
    setSelectedNodeIds([]); setSelectedFileId(null);
  };

  const deleteRightPanelItems = (fileIdsToDelete: string[], nodeIdsToDelete: string[]) => {
    if (myRole !== 'OWNER' || (fileIdsToDelete.length === 0 && nodeIdsToDelete.length === 0)) return;
    saveHistory();
    if (selectedFileId && fileIdsToDelete.includes(selectedFileId)) setSelectedFileId(null);
    const deletedFiles = files.filter(f => fileIdsToDelete.includes(f.id)).map(f => f.name);
    const deletedNodes = nodes.filter(n => nodeIdsToDelete.includes(n.id)).map(n => n.name);
    if (deletedFiles.length > 0) logActivity(`[삭제] 우측 패널에서 ${deletedFiles.map(n => `'${n}'`).join(', ')} 폴더를 삭제했습니다.`);
    if (deletedNodes.length > 0) logActivity(`[삭제] 우측 패널에서 ${deletedNodes.map(n => `'${n}'`).join(', ')} 노드를 삭제했습니다.`);

    setFiles((prev) => prev.filter(f => !fileIdsToDelete.includes(f.id)).map(f => ({ ...f, nodeIds: f.nodeIds.filter(id => !nodeIdsToDelete.includes(id)) })));
    setNodes((prev) => prev.filter(n => !nodeIdsToDelete.includes(n.id)));
    setEdges((prev) => prev.filter(e => !nodeIdsToDelete.includes(e.sourceId) && !nodeIdsToDelete.includes(e.targetId)));
    setTargetFileIds((prev) => prev.filter(id => !fileIdsToDelete.includes(id)));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (appMode !== 'editor') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (myRole === 'VIEWER' || isConflictSyncing) return;

      const pressedKey = e.key.toLowerCase();
      const isModifier = e.ctrlKey || e.metaKey;
      const wantsStructureChange =
        (isModifier && (pressedKey === 'z' || pressedKey === 'x' || pressedKey === 'v')) ||
        ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeIds.length > 0);
      if (wantsStructureChange && myRole !== 'OWNER') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('global-toast', { detail: EDITOR_STRUCTURE_MESSAGE }));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault(); undo();
      }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (nodes.length > 0) { setSelectedNodeIds(nodes.map(n => n.id)); setSelectedFileId(null); }
      }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        if (selectedNodeIds.length > 0) {
          e.preventDefault();
          const nodesToCopy = nodes.filter(n => selectedNodeIds.includes(n.id));
          setClipboard(JSON.parse(JSON.stringify(nodesToCopy))); 
          window.dispatchEvent(new CustomEvent('global-toast', { detail: `${nodesToCopy.length}개의 노드를 잘라냈습니다.` }));
          deleteSelected();
        }
      }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedNodeIds.length > 0) {
          e.preventDefault();
          const nodesToCopy = nodes.filter(n => selectedNodeIds.includes(n.id));
          setClipboard(JSON.parse(JSON.stringify(nodesToCopy))); 
          window.dispatchEvent(new CustomEvent('global-toast', { detail: `${nodesToCopy.length}개의 노드가 복사되었습니다.` }));
        }
      }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (clipboard.length > 0) {
          e.preventDefault(); saveHistory();

          const newSelectedIds: string[] = [];
          const newNodes: NodeData[] = [];

          clipboard.forEach((n, idx) => {
            let baseName = n.name;
            if (/\d+$/.test(baseName)) baseName = baseName.replace(/_\d+$/, ''); 
            let finalName = baseName; let counter = 1;
            const allCurrentNames = [...nodes.map(node => node.name), ...newNodes.map(node => node.name)];

            while (allCurrentNames.includes(finalName)) { finalName = `${baseName}_${counter}`; counter++; }

            const newNodeId = `node-${Date.now()}-${idx}`;
            newSelectedIds.push(newNodeId);

            const newSettings = { ...n.settings };
            if (newSettings.name) newSettings.name = finalName;

            newNodes.push({ ...n, id: newNodeId, name: finalName, x: n.x + 30, y: n.y + 30, settings: newSettings });
          });

          setNodes(prev => [...prev, ...newNodes]);
          setSelectedNodeIds(newSelectedIds);

          setFiles((prev) => {
            const updatedFiles = [...prev];
            if (updatedFiles.length === 0) {
              updatedFiles.push({ id: `file-${Date.now()}`, name: '생성할 노드 목록', isGenerated: false, nodeIds: newNodes.map(n => n.id), isExpanded: true });
            } else {
              updatedFiles[0] = { ...updatedFiles[0], nodeIds: [...updatedFiles[0].nodeIds, ...newNodes.map(n => n.id)] };
            }
            return updatedFiles;
          });

          logActivity(`[붙여넣기] ${newNodes.length}개의 노드를 캔버스에 붙여넣었습니다.`);
        }
      }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0) { e.preventDefault(); deleteSelected(); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, selectedNodeIds, clipboard, deleteSelected, undo, saveHistory, myRole, logActivity, appMode, isConflictSyncing]);

  const globalErrors = validationErrors.filter(e => e.isGlobal || !e.targetNodeId);
  const nodeErrorsMap = new Map<string, typeof validationErrors>();

  validationErrors.forEach(e => {
    if (!e.isGlobal && e.targetNodeId) {
      if (!nodeErrorsMap.has(e.targetNodeId)) nodeErrorsMap.set(e.targetNodeId, []);
      nodeErrorsMap.get(e.targetNodeId)!.push(e);
    }
  });

  const isOwner = myRole === 'OWNER';
  const canMoveNodes = myRole !== 'VIEWER' && !isConflictSyncing;
  const canEditStructure = isOwner && !isConflictSyncing;
  const canRenameNodes = myRole !== 'VIEWER' && !isConflictSyncing;

  return (
    <div className={`app-container ${myRole === 'VIEWER' ? 'viewer-mode' : ''}`}>
      <style>
        {unassignedNodeIds.map(id => `
          div[data-id="${id}"], div[id="${id}"] {
            opacity: 0.85 !important;
            filter: saturate(30%) !important;
          }
        `).join('\n')}
        {myRole !== 'OWNER' && `
          .react-flow__connection-line { display: none !important; }
          .left-panel [draggable="true"] {
            opacity: 0.5 !important;
            cursor: not-allowed !important;
          }
        `}
      </style>

     <Header 
      onGenerate={myRole === 'VIEWER' || myRole === 'EDITOR' ? () => showToast(GENERATE_OWNER_ONLY_MESSAGE) : handleGenerateClick} 
      isGenerateMode={appMode === 'generating'} 
      onResetUI={handleResetUI} 
      onSaveCanvas={myRole === 'VIEWER' || myRole === 'EDITOR' ? () => showToast(saveNotAllowedMessage(myRole)) : () => handleSaveCanvas(false)}
      onOpenTutorial={() => setShowTutorial(true)}
      onGoHome={handleGoHome}
    />

      {appMode === 'editor' ? (
        <div className="main-layout">
          <LeftPanel 
            projectName={projectName} onUpdateProjectName={handleUpdateProjectName} 
            nodes={nodes} activeTab={leftActiveTab} setActiveTab={setLeftActiveTab}
            onSelectCategory={() => {}} onToggleRightSidebar={toggleRightSidebar}
            showRightSidebar={showRightSidebar} setShowRightSidebar={setShowRightSidebar}
            onZoomIn={handleZoomIn} onZoomOut={handleZoomOut}
            onSelectMode={() => { if(myRole !== 'VIEWER') { saveHistory(); setIsSelectMode(true); } }}
            onCancelSelection={onCancelSelection} onDelete={deleteSelected}
            onUndo={undo} onRedo={redo} canUndo={isOwner && history.length > 0} canRedo={isOwner && redoStack.length > 0}
            isSelectMode={isSelectMode} resetTrigger={uiResetTrigger} userInfo={userInfo}
            onGoHome={handleGoHome} cloudProvider={cloudProvider} setCloudProvider={setCloudProvider}
            width={leftWidth}
            myRole={myRole}
          />

          <div 
            className={`resizer ${isResizingLeft ? 'active' : ''}`} 
            onMouseDown={(e) => { e.preventDefault(); setIsResizingLeft(true); }} 
          />

          <Canvas 
            nodes={nodes} setNodes={canMoveNodes ? setNodes : () => {}} 
            edges={edges} setEdges={canEditStructure ? setEdges : () => {}}
            unassignedNodeIds={unassignedNodeIds}
            selectedNodeIds={selectedNodeIds} setSelectedNodeIds={setSelectedNodeIds}
            addNode={addNode} 
            zoomLevel={zoomLevel} isSelectMode={isSelectMode}
            selection={selection} setSelection={setSelection} 
            saveHistory={saveHistory}
            markFilesAsModified={markFilesAsModified} setSelectedFileId={setSelectedFileId}
            setViewport={setViewport} focusNodeId={focusNodeId} setFocusNodeId={setFocusNodeId} resetTrigger={uiResetTrigger}
            setActiveTab={setLeftActiveTab} setShowRightSidebar={setShowRightSidebar}
            canMoveNodes={canMoveNodes}
            canEditStructure={canEditStructure}
            onNodesDragMove={handleNodesDragMove}
            onNodesDragEnd={handleNodesDragEnd}
            focusEdgeId={focusEdgeId}
            setFocusEdgeId={setFocusEdgeId}
          />

          {selectedFileId && (
            <>
              <div 
                className={`resizer ${isResizingCodeViewer ? 'active' : ''}`} 
                onMouseDown={(e) => { e.preventDefault(); setIsResizingCodeViewer(true); }} 
              />
              <div className="code-viewer-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', width: `${codeViewerWidth}px`, flexShrink: 0 }}>
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
                            {(() => {
                              const current = f.generatedFiles[activeSubTab];
                              const content = current?.content || '';
                              const canMask = isEnvFile(current?.fileName) && hasEnvSecrets(content);
                              return (
                                <div style={{ padding: '16px', overflowY: 'auto', flex: 1, background: 'white', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '12px', fontFamily: "'Consolas', 'Courier New', monospace" }}>
                                  <div style={{ fontWeight: 'bold', color: '#2d3748', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <span>{current?.fileName}</span>
                                    {canMask && (
                                      <button
                                        type="button"
                                        className="secret-toggle-btn"
                                        onClick={() => setShowSecrets(prev => !prev)}
                                        style={{ flexShrink: 0, padding: '3px 8px', fontSize: '11px', fontWeight: 600, color: '#4a5568', background: '#f1f3f5', border: '1px solid #cbd5e0', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                      >
                                        {showSecrets ? '비밀번호 숨기기' : '비밀번호 표시'}
                                      </button>
                                    )}
                                  </div>
                                  {canMask && !showSecrets ? maskEnvSecrets(content) : content}
                                </div>
                              );
                            })()}
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
            </>
          )}

          {showRightSidebar && (
            <>
              <div 
                className={`resizer ${isResizingRight ? 'active' : ''}`} 
                onMouseDown={(e) => { e.preventDefault(); setIsResizingRight(true); }} 
              />
              <RightSideBar 
                projectName={projectName}
                nodes={nodes} setNodes={setNodes} edges={edges} activeTab={leftActiveTab} setActiveTab={setLeftActiveTab} saveHistory={saveHistory}
                files={files} setFiles={setFiles} targetFileIds={targetFileIds} setTargetFileIds={setTargetFileIds}
                markFilesAsModified={markFilesAsModified} deleteRightPanelItems={deleteRightPanelItems}
                selectedFileId={selectedFileId} setSelectedFileId={setSelectedFileId}
                setSelectedNodeIds={setSelectedNodeIds} selectedNodeIds={selectedNodeIds} viewport={viewport} zoomLevel={zoomLevel}
                setFocusNodeId={setFocusNodeId} validationErrors={validationErrors} resetTrigger={uiResetTrigger}
                setSelection={setSelection} setIsSelectMode={setIsSelectMode}
                cloudProvider={cloudProvider} includeLocal={includeLocal} setIncludeLocal={setIncludeLocal}
                cloudSettings={cloudSettings} setCloudSettings={setCloudSettings}
                width={rightWidth}
                isViewer={!canEditStructure}
                canRename={canRenameNodes}
                logActivity={logActivity}
                highlightFieldRequest={highlightFieldRequest}
                onNodeNameChange={handleNodeNameChange}
              />
            </>
          )}
        </div>
      ) : (
        <Generate genProgress={genProgress} targetFileIds={targetFileIds} files={files} projectName={projectName} onBack={() => { setAppMode('editor'); }} />
      )}

      {isErrorModalOpen && (
        <div className="modal-overlay">
          <style>{`
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

            .modal-error-group { margin-bottom: 8px; border: 1px solid #fbd5d5; border-radius: 8px; background: #fafafa; overflow: hidden; }
            .modal-error-group-header { padding: 10px 12px; font-size: 13px; font-weight: bold; color: #9b2c2c; background: #fdf2f2; display: flex; align-items: center; }
            .modal-error-group-content { padding: 10px; display: flex; flex-direction: column; gap: 8px; background: white; border-top: 1px solid #fbd5d5; }
          `}</style>
          <div className="modal-content">
            <div className="modal-title error">프로젝트를 생성할 수 없습니다.</div>
            <div className="modal-body hide-scrollbar" style={{ maxHeight: '400px', overflowY: 'auto', padding: '12px' }}>
              <div style={{fontWeight: 'bold', marginBottom: '12px', color: '#e53e3e'}}>총 {validationErrors.length}개의 오류가 발견되었습니다.</div>

              {globalErrors.length > 0 && (
                <div className="modal-error-group">
                  <div className="modal-error-group-header">프로젝트 & 클라우드 설정</div>
                  <div className="modal-error-group-content">
                    {globalErrors.map((err, idx) => (
                      <div key={idx} style={{ padding: '10px', background: '#fff5f5', borderLeft: '4px solid #fc8181', borderRadius: '4px' }}>
                        <div style={{ fontWeight: 'bold', color: '#c53030', fontSize: '13px', marginBottom: '4px' }}>{err.name}</div>
                        <div style={{ color: '#4a5568', fontSize: '12px' }}>{err.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.from(nodeErrorsMap.entries()).map(([nodeId, errs]) => {
                const nodeName = nodes.find(n => n.id === nodeId)?.name || '알 수 없는 노드';
                return (
                  <div key={nodeId} className="modal-error-group">
                    <div className="modal-error-group-header">{nodeName} (노드)</div>
                    <div className="modal-error-group-content">
                      {errs.map((err, idx) => (
                        <div key={idx} style={{ padding: '10px', background: '#fff5f5', borderLeft: '4px solid #fc8181', borderRadius: '4px' }}>
                          <div style={{ fontWeight: 'bold', color: '#c53030', fontSize: '13px', marginBottom: '4px' }}>{err.name}</div>
                          <div style={{ color: '#4a5568', fontSize: '12px' }}>{err.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="modal-actions">
              <button className="modal-btn confirm" id="error-modal-confirm-btn" onClick={closeErrorModalAndShowValidation}>확인</button>
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
            <div className="modal-actions" style={{ gap: '10px' }}>
              <button className="modal-btn cancel" onClick={() => setIsConfirmModalOpen(false)}>취소</button>
              <button className="modal-btn confirm" id="generate-confirm-btn" onClick={confirmGenerate}>생성</button>
            </div>
          </div>
        </div>
      )}

      {isHomeConfirmModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title error">저장하지 않은 변경사항이 있습니다.</div>
            <div className="modal-body" style={{ color: '#4a5568', fontSize: '14px', lineHeight: '1.5' }}>
              정말 나가시겠습니까?<br />
              <span style={{ color: '#e53e3e', fontSize: '13px' }}>
                (저장하지 않고 나가면 최근 작업 내역이 날아갈 수 있습니다.)
              </span>
            </div>
            <div className="modal-actions" style={{ gap: '10px' }}>
              <button className="modal-btn cancel" onClick={() => setIsHomeConfirmModalOpen(false)}>취소</button>
              <button className="modal-btn confirm" style={{ backgroundColor: '#e53e3e', borderColor: '#e53e3e' }} onClick={confirmGoHome}>나가기</button>
            </div>
          </div>
        </div>
      )}

      {isConflictSyncing && (
        <SyncBanner>다른 사람의 편집 내용과 맞추는 중입니다. 잠시만 기다려 주세요…</SyncBanner>
      )}

      {unappliedOps.length > 0 && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title error">반영되지 않은 변경이 있습니다</div>
            <div className="modal-body" style={{ fontSize: '13px', lineHeight: 1.6 }}>
              <div style={{ marginBottom: '8px' }}>다른 사람의 편집과 겹쳐 아래 변경이 저장되지 않았습니다. 다시 적용할까요?</div>
              {unappliedOps.map(op => (
                <div key={op.operationId} style={{ color: '#4a5568' }}>• {describeOp(op)}</div>
              ))}
            </div>
            <div className="modal-actions" style={{ gap: '10px' }}>
              <button className="modal-btn cancel" onClick={discardUnappliedOps}>버리기</button>
              <button className="modal-btn confirm" onClick={retryUnappliedOps}>다시 적용</button>
            </div>
          </div>
        </div>
      )}

      {showTutorial && (
        <Tutorial
          nodes={nodes}
          selectedNodeIds={selectedNodeIds}
          hasErrors={validationErrors.length > 0}
          onJumpToNextError={jumpToNextError}
          onFinish={() => setShowTutorial(false)}
          onSkip={() => setShowTutorial(false)}
        />
        )}
      {toastMessage && <ToastNotification>{toastMessage}</ToastNotification>}
    </div>
  );
};

export default MainPage;