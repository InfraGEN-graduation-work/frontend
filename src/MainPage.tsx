import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { Client } from '@stomp/stompjs';
import './MainPage.css';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import Canvas from './components/Canvas';
import type { DraggedNodePosition } from './components/Canvas';
import { CollabCursorLayer, CursorSender, LocalCursor, RemoteCursorStore, CURSOR_ROLE_COLORS, CURSOR_UNKNOWN_COLOR } from './components/CollabCursors';
import type { CursorAppearance, CursorPoint, CursorRole, RemoteCursor } from './components/CollabCursors';
import RightSideBar from './components/RightSideBar';
import Generate from './components/Generate'; 
import type { NodeData, SelectionArea, Edge, FileGroup, CloudProvider, CloudSettings } from './types';
import Tutorial from './components/Tutorial';
import { useAuth } from './contexts/AuthContext';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://infragen.p-e.kr/api/v1';
const WS_BASE_URL = BASE_URL.replace(/^http/, 'ws').replace(/\/api\/v1$/, '');

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
  NODE_JS: 'Node.js',
  MYSQL: 'MySQL',
  POSTGRESQL: 'PostgreSQL',
  MONGODB: 'MongoDB',
  REDIS: 'Redis'
};
const NODE_TYPE_TO_COMPONENT_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(COMPONENT_TYPE_TO_NODE_TYPE).map(([componentType, nodeType]) => [nodeType, componentType])
);
const toComponentType = (nodeType: string) => NODE_TYPE_TO_COMPONENT_TYPE[nodeType] || nodeType.toUpperCase().replace(/ /g, '_');

const DEPENDENCY_NODE_TYPES = ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis'];
const NODES_WITHOUT_SERVICE_NAME = ['MongoDB'];
const NODES_WITH_OPTIONAL_CONTAINER = ['PostgreSQL', 'Node.js', 'MongoDB'];
const isDependencyType = (type?: string) => Boolean(type && DEPENDENCY_NODE_TYPES.includes(type));
const APP_NODE_TYPES = ['Spring Boot', 'Node.js'];
const isAppType = (type?: string) => Boolean(type && APP_NODE_TYPES.includes(type));
const NODE_VERSION_REGEX = /^[0-9]+$/;

const ENV_FORBIDDEN_CHARS = /["\\$\r\n\0]/;
const ENV_VALUE_FIELDS: Record<string, { key: string; label: string }[]> = {
  MySQL: [
    { key: 'username', label: '사용자 이름' },
    { key: 'userPassword', label: '사용자 비밀번호' }, { key: 'rootPassword', label: '루트 비밀번호' }
  ],
  PostgreSQL: [
    { key: 'username', label: '사용자 이름' }, { key: 'password', label: '비밀번호' }
  ],
  MongoDB: [
    { key: 'username', label: '사용자 이름' }, { key: 'password', label: '비밀번호' }
  ],
  Redis: [{ key: 'password', label: '비밀번호' }]
};

const ENV_KEYS_BY_COMPONENT: Record<string, string[]> = {
  MYSQL: ['databaseName', 'username', 'userPassword', 'rootPassword'],
  POSTGRESQL: ['databaseName', 'username', 'password'],
  MONGODB: ['databaseName', 'username', 'password']
};

const DB_NAME_REGEX = /^[a-zA-Z0-9_]+$/;

const ENV_CHAR_ERROR_MESSAGE = '사용자 이름이나 비밀번호에 쓸 수 없는 문자가 있습니다. 각 노드의 값을 확인해 주세요.';

const GENERATE_ERROR_MESSAGES: Record<string, string> = {
  PARSING400_23: 'PostgreSQL 노드의 [도커 이미지 버전]이 비어 있습니다.',
  PARSING400_24: 'PostgreSQL 노드의 [사용자 이름]이 비어 있습니다.',
  PARSING400_6: '데이터베이스 이름에는 영문, 숫자, 언더바(_)만 사용할 수 있습니다.',
  PARSING400_7: '데이터베이스 비밀번호는 8자 이상이어야 합니다. (MySQL은 루트 비밀번호, PostgreSQL·MongoDB는 비밀번호)',
  PARSING400_26: 'MongoDB 노드의 [도커 이미지 버전]이 비어 있습니다.',
  PARSING400_27: 'MongoDB 노드의 [사용자 이름]이 비어 있습니다.',
  PARSING400_5: '포트 번호는 1024~65535 사이여야 합니다.',
  PARSING400_4: '여러 노드가 같은 포트 번호를 쓰고 있습니다.',
  PARSING400_25: '하나의 애플리케이션(Spring Boot·Node.js)에 같은 종류의 DB(MySQL·PostgreSQL·MongoDB·Redis)가 2개 이상 연결되어 있습니다. 하나만 남겨 주세요.',
  PARSING400_10: '연결 방향이 잘못되었습니다. Database에서 애플리케이션(Spring Boot·Node.js) 방향으로 연결해 주세요.',
  PARSING400_30: 'Node.js 노드의 [서비스 이름]이 비어 있습니다.',
  PARSING400_31: 'Node.js 노드의 [Node.js 버전]이 비어 있습니다.',
  PARSING400_32: 'Node.js 버전은 숫자로만 입력해야 합니다. (예: 22)',
  GENERATION400_3: '코드 생성 요청을 처리하지 못했습니다. 설정을 확인한 뒤 다시 시도해 주세요.',
  GENERATION400_4: '배포 환경이 선택되지 않았습니다. 왼쪽 패널에서 LOCAL·AWS·OCI 중 하나를 골라 주세요.',
  GENERATION400_5: '클라우드 배포 설정이 비어 있습니다. Settings 탭에서 클라우드 설정을 입력해 주세요.',
  GENERATION400_6: '로컬 환경 설정이 올바르지 않습니다. 배포 환경을 다시 선택한 뒤 시도해 주세요.',
  GENERATION400_7: '선택한 배포 환경과 클라우드 설정이 맞지 않습니다. 배포 환경을 다시 선택해 주세요.',
  GENERATION400_8: '클라우드 필수 설정값이 비어 있거나 올바르지 않습니다. Settings 탭에서 확인해 주세요.',
  GENERATION400_9: '하나의 애플리케이션(Spring Boot·Node.js)에 같은 종류의 DB(MySQL·PostgreSQL·MongoDB·Redis)가 2개 이상 연결되어 있습니다. 하나만 남겨 주세요.',
  GENERATION400_10: '클라우드 배포는 애플리케이션 노드(Spring Boot·Node.js)를 하나만 지원합니다. 하나만 남기거나 배포 환경을 LOCAL로 바꿔 주세요.',
  GENERATION400_13: ENV_CHAR_ERROR_MESSAGE,
  GENERATION400_14: ENV_CHAR_ERROR_MESSAGE,
  PARSING400_33: ENV_CHAR_ERROR_MESSAGE,
  COMMON400_1: '입력값 중 형식이 올바르지 않은 항목이 있습니다. 노드 설정과 클라우드 설정을 다시 확인해 주세요.'
};
const GENERATE_SETTINGS_ERROR_CODES = ['GENERATION400_4', 'GENERATION400_5', 'GENERATION400_6', 'GENERATION400_7', 'GENERATION400_8'];
const GENERATE_VALIDATION_ERROR_CODES = ['GENERATION400_9', 'GENERATION400_10', 'GENERATION400_13', 'GENERATION400_14', 'COMMON400_1'];

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
  return code === '' || code === 'COLLAB409_2';
};

const pickSnapshotVersion = (result: any): number | null => {
  if (typeof result?.serverVersion === 'number') return result.serverVersion;
  const ops = Array.isArray(result?.operations) ? result.operations : [];
  const lastOp = ops[ops.length - 1];
  if (typeof lastOp?.serverVersion === 'number') return lastOp.serverVersion;
  if (typeof result?.graphVersion === 'number') return result.graphVersion;
  return null;
};

type ResyncReason = 'connect' | 'resync' | 'conflict' | 'rebase';
type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';

const toProjectRole = (value: unknown): ProjectRole => {
  const role = String(value || '').toUpperCase();
  return role === 'OWNER' || role === 'EDITOR' ? role : 'VIEWER';
};

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
const CURSOR_NAMES_MIN_GAP_MS = 2000;
const OPERATION_ERROR_WINDOW_MS = 2000;
const OWNER_CURSOR_LABEL = '방장';
const PROJECT_ACCESS_LOST_MESSAGE = '이 프로젝트에 접근할 권한이 없습니다. 홈에서 프로젝트 목록을 확인해 주세요.';
const ROLE_CHECK_GAP_MS = 30000;
const ROLE_CHECK_INTERVAL_MS = 60000;
const ROLE_RECHECK_MIN_GAP_MS = 2000;
const OWN_WRITE_VERSIONS_KEPT = 50;
const ROLE_CHANGED_MESSAGES: Record<ProjectRole, string> = {
  OWNER: '이 프로젝트의 방장(OWNER)이 되었습니다.',
  EDITOR: '내 권한이 EDITOR로 바뀌었습니다. 프로젝트 이름과 설명은 방장만 바꿀 수 있습니다.',
  VIEWER: '내 권한이 VIEWER로 바뀌어 이제 보기만 할 수 있습니다.'
};

const NO_SELECT_STYLE = `
  .app-container, .app-container * {
    -webkit-user-select: none;
    user-select: none;
  }
  .app-container input, .app-container textarea, .app-container .code-viewer-text, .app-container .code-viewer-text * {
    -webkit-user-select: text;
    user-select: text;
  }
  .app-container img {
    -webkit-user-drag: none;
  }
`;

const VIEWER_GENERATE_MESSAGE = 'VIEWER는 코드를 생성할 수 없습니다.';
const VIEWER_SAVE_MESSAGE = 'VIEWER는 프로젝트를 수정하거나 저장할 수 없습니다.';
const PROJECT_NAME_OWNER_ONLY_MESSAGE = '프로젝트 이름은 방장(OWNER)만 수정할 수 있습니다.';
const NO_WRITE_PERMISSION_MESSAGE = '이 프로젝트를 수정할 권한이 없습니다.';
const CONFLICT_SAVE_MESSAGE = '다른 사람이 편집 중이라 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const GENERIC_ERROR_MESSAGE = '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const LIVE_SYNC_FAIL_MESSAGE = '변경 사항을 실시간으로 저장하지 못했습니다. 상단 저장 버튼으로 다시 저장해 주세요.';
const mergeConflictMessage = (names: string[]) => {
  const shown = names.slice(0, 2).map(name => `'${name}'`).join(', ');
  const more = names.length > 2 ? ` 외 ${names.length - 2}개` : '';
  return `${shown}${more} 노드는 다른 사람이 먼저 바꿔서 그 내용으로 맞췄습니다.`;
};
const writeFailMessage = (data: any, fallback: string) => {
  const code = String(data?.code || '');
  if (code === 'COLLAB409_2') return CONFLICT_SAVE_MESSAGE;
  if (code === 'PROJECT403_1') return NO_WRITE_PERMISSION_MESSAGE;
  return data?.message || fallback;
};
const OPERATION_ERROR_MESSAGES: Record<string, string> = {
  PROJECT403_1: NO_WRITE_PERMISSION_MESSAGE,
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

const byFirstItem = (a: unknown[], b: unknown[]) => String(a[0]).localeCompare(String(b[0]));

const buildGraphSignature = (
  graphNodes: NodeData[], graphEdges: Edge[], graphFiles: FileGroup[], graphTargetIds: string[],
  provider: CloudProvider, local: boolean, settings: CloudSettings
) => {
  const typeById = new Map(graphNodes.map(n => [n.id, n.type]));
  return JSON.stringify({
    n: graphNodes.map(n => {
      const s = n.settings || {};
      const keys = Object.keys(s).filter(k => !k.startsWith('file') && !k.startsWith('global')).sort();
      return [n.id, n.type, keys.map(k => [k, s[k]])];
    }).sort(byFirstItem),
    e: graphEdges.map(e => {
      const swap = isAppType(typeById.get(e.sourceId)) && isDependencyType(typeById.get(e.targetId));
      return swap ? `${e.targetId}>${e.sourceId}` : `${e.sourceId}>${e.targetId}`;
    }).sort(),
    f: graphFiles.map(f => [
      f.id, f.name, [...f.nodeIds].sort(), f.isGenerated,
      (f.generatedFiles || []).length,
      (f.generatedFiles || []).reduce((sum, g) => sum + (g.content?.length || 0), 0)
    ]).sort(byFirstItem),
    t: [...graphTargetIds].sort(),
    p: provider,
    l: local,
    c: settings
  });
};

interface GraphGlobals {
  cloudProvider: CloudProvider;
  includeLocal: boolean;
  cloudSettings: CloudSettings;
}

interface GraphState extends GraphGlobals {
  nodes: NodeData[];
  edges: Edge[];
  files: FileGroup[];
  targetFileIds: string[];
}

interface MappedNode {
  nodeId: string;
  nodeName: string;
  componentType: string;
  positionX: number;
  positionY: number;
  properties: Record<string, any>;
}

interface MappedEdge {
  edgeId?: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceNodeName?: string;
  targetNodeName?: string;
}

interface MappedGraph {
  nodes: MappedNode[];
  edges: MappedEdge[];
}

interface ParsedProject {
  nodes: NodeData[];
  edges: Edge[];
  files: FileGroup[];
  targetFileIds: string[];
  globals: GraphGlobals | null;
}

const graphSignature = (g: GraphState) =>
  buildGraphSignature(g.nodes, g.edges, g.files, g.targetFileIds, g.cloudProvider, g.includeLocal, g.cloudSettings);

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

const mapGraphState = (g: GraphState, motions?: Map<string, { toX: number; toY: number }>): MappedGraph => {
  const nodes: MappedNode[] = g.nodes.map(n => {
    const file = g.files.find(f => f.nodeIds.includes(n.id));
    const rawProperties: any = { ...(n.settings || {}) };

    rawProperties.globalCloudProvider = g.cloudProvider;
    rawProperties.globalIncludeLocal = String(g.includeLocal);
    rawProperties.globalCloudSettings = JSON.stringify(g.cloudSettings);

    if (file) {
      rawProperties.fileId = file.id;
      rawProperties.fileName = file.name;
      rawProperties.fileIsGenerated = String(file.isGenerated);
      rawProperties.fileGeneratedCodes = JSON.stringify(file.generatedFiles || []);
      rawProperties.fileIsTarget = String(g.targetFileIds.includes(file.id));
    } else {
      delete rawProperties.fileId; delete rawProperties.fileName; delete rawProperties.fileIsGenerated;
      delete rawProperties.fileGeneratedCodes; delete rawProperties.fileIsTarget;
    }

    const motion = motions?.get(n.id);
    return {
      nodeId: n.id,
      nodeName: String(n.name || '').trim() ? n.name : n.type,
      componentType: toComponentType(n.type),
      positionX: Math.round(motion ? motion.toX : n.x),
      positionY: Math.round(motion ? motion.toY : n.y),
      properties: processProperties(n, rawProperties)
    };
  });

  const edges: MappedEdge[] = g.edges.map(e => {
    let sNode = g.nodes.find(n => n.id === e.sourceId);
    let tNode = g.nodes.find(n => n.id === e.targetId);
    if (isAppType(sNode?.type) && isDependencyType(tNode?.type)) {
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

  return { nodes, edges };
};

const parseProjectGraph = (project: any): ParsedProject => {
  const fetchedNodes: any[] = Array.isArray(project?.nodes) ? project.nodes : [];
  let globals: GraphGlobals | null = null;
  if (fetchedNodes.length > 0) {
    const firstProps = fetchedNodes[0]?.properties || {};
    let cloudSettings: CloudSettings = { ...DEFAULT_CLOUD_SETTINGS };
    if (firstProps.globalCloudSettings) {
      try { cloudSettings = { ...cloudSettings, ...JSON.parse(firstProps.globalCloudSettings) }; } catch (e) {}
    }
    globals = {
      cloudProvider: (firstProps.globalCloudProvider as CloudProvider) || 'LOCAL',
      includeLocal: firstProps.globalIncludeLocal !== undefined ? String(firstProps.globalIncludeLocal) === 'true' : true,
      cloudSettings
    };
  }

  const nodes: NodeData[] = fetchedNodes.map(n => {
    const props: Record<string, any> = { ...(n.properties || {}) };
    const envKeys = ENV_KEYS_BY_COMPONENT[n.componentType];
    if (envKeys && props.env && typeof props.env === 'object') {
      const env = props.env;
      envKeys.forEach(key => { if (env[key] !== undefined) props[key] = env[key]; });
      delete props.env;
    }
    return {
      id: String(n.nodeId ?? n.id),
      type: COMPONENT_TYPE_TO_NODE_TYPE[n.componentType] || n.componentType,
      name: n.nodeName,
      x: n.positionX,
      y: n.positionY,
      settings: props
    };
  });

  const fetchedEdges: any[] = Array.isArray(project?.edges) ? project.edges : [];
  const edges: Edge[] = fetchedEdges.map(e => ({
    id: e.edgeId || `edge-${e.id}`,
    sourceId: e.sourceNodeId?.toString(),
    targetId: e.targetNodeId?.toString()
  }));

  const fileMap = new Map<string, FileGroup>();
  const targetIds = new Set<string>();
  nodes.forEach(n => {
    const props = n.settings || {};
    if (!props.fileId) return;
    const fileId = String(props.fileId);
    if (!fileMap.has(fileId)) {
      let generatedFiles: FileGroup['generatedFiles'] = [];
      try { generatedFiles = props.fileGeneratedCodes ? JSON.parse(props.fileGeneratedCodes) : []; } catch (e) {}
      fileMap.set(fileId, {
        id: fileId,
        name: props.fileName || '생성할 노드 목록',
        isGenerated: String(props.fileIsGenerated) === 'true',
        nodeIds: [],
        isExpanded: true,
        generatedFiles
      });
      if (props.fileIsTarget !== 'false') targetIds.add(fileId);
    }
    fileMap.get(fileId)!.nodeIds.push(n.id);
  });
  const files = Array.from(fileMap.values());

  return { nodes, edges, files, targetFileIds: files.filter(f => targetIds.has(f.id)).map(f => f.id), globals };
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).filter(k => obj[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

const FILE_META_KEYS = ['fileName', 'fileIsGenerated', 'fileGeneratedCodes', 'fileIsTarget'];

interface DescribedNode {
  node: MappedNode;
  own: string;
  fileId: string | null;
}

const describeMappedGraph = (g: MappedGraph) => {
  const nodes = new Map<string, DescribedNode>();
  const files = new Map<string, string>();
  const fileMeta = new Map<string, Record<string, any>>();
  let globals: string | null = null;
  let globalsRaw: Record<string, any> | null = null;
  g.nodes.forEach(n => {
    const props = n.properties || {};
    const own: Record<string, any> = {};
    Object.keys(props).forEach(k => { if (!k.startsWith('file') && !k.startsWith('global')) own[k] = props[k]; });
    const fileId = props.fileId != null && props.fileId !== '' ? String(props.fileId) : null;
    if (fileId && !files.has(fileId)) {
      const meta: Record<string, any> = {};
      FILE_META_KEYS.forEach(k => { if (props[k] !== undefined) meta[k] = props[k]; });
      files.set(fileId, stableStringify(meta));
      fileMeta.set(fileId, meta);
    }
    if (globalsRaw === null) {
      const raw: Record<string, any> = {};
      Object.keys(props).forEach(k => { if (k.startsWith('global')) raw[k] = props[k]; });
      globalsRaw = raw;
      globals = stableStringify(raw);
    }
    nodes.set(n.nodeId, { node: n, own: stableStringify({ t: n.componentType, p: own }), fileId });
  });
  const edges = new Map<string, MappedEdge>();
  g.edges.forEach(e => {
    const key = `${e.sourceNodeId}>${e.targetNodeId}`;
    if (!edges.has(key)) edges.set(key, e);
  });
  return { nodes, files, fileMeta, globals, globalsRaw: globalsRaw as Record<string, any> | null, edges };
};

const pickThreeWay = <T,>(base: T, local: T, server: T) => {
  if (local === base) return { from: 'server' as const, value: server, conflict: false };
  if (server === base || server === local) return { from: 'local' as const, value: local, conflict: false };
  return { from: 'server' as const, value: server, conflict: true };
};

interface MergeResult {
  graph: MappedGraph;
  localNodeIds: Set<string>;
  localFileIds: Set<string>;
  globalsFromLocal: boolean;
  conflictNodeIds: string[];
}

const mergeMappedGraphs = (base: MappedGraph, local: MappedGraph, server: MappedGraph): MergeResult => {
  const B = describeMappedGraph(base);
  const L = describeMappedGraph(local);
  const S = describeMappedGraph(server);

  const conflictNodeIds: string[] = [];
  const localNodeIds = new Set<string>();
  const chosen: { entry: DescribedNode; fileId: string | null; position: MappedNode }[] = [];
  const order = [...Array.from(L.nodes.keys()), ...Array.from(S.nodes.keys()).filter(id => !L.nodes.has(id))];

  order.forEach(id => {
    const b = B.nodes.get(id);
    const l = L.nodes.get(id);
    const s = S.nodes.get(id);
    const own = pickThreeWay(b?.own ?? null, l?.own ?? null, s?.own ?? null);
    if (own.conflict) conflictNodeIds.push(id);
    if (own.value === null) return;
    const entry = own.from === 'local' ? l! : s!;
    const baseFile = b?.fileId ?? null;
    const fileChoice = pickThreeWay(baseFile, l ? l.fileId : baseFile, s ? s.fileId : baseFile);
    if (l && own.value === l.own && fileChoice.value === l.fileId) localNodeIds.add(id);
    chosen.push({ entry, fileId: fileChoice.value, position: (l ?? s)!.node });
  });

  const localFileIds = new Set<string>();
  const usedFiles = new Set(chosen.map(c => c.fileId).filter((f): f is string => Boolean(f)));
  const fileMeta = new Map<string, Record<string, any>>();
  usedFiles.forEach(fileId => {
    const b = B.files.get(fileId) ?? null;
    const l = L.files.has(fileId) ? L.files.get(fileId)! : b;
    const s = S.files.has(fileId) ? S.files.get(fileId)! : b;
    const pick = pickThreeWay(b, l, s);
    const fromLocal = pick.from === 'local' ? L.fileMeta.has(fileId) : !S.fileMeta.has(fileId);
    const meta = fromLocal ? (L.fileMeta.get(fileId) ?? S.fileMeta.get(fileId)) : (S.fileMeta.get(fileId) ?? L.fileMeta.get(fileId));
    if (fromLocal && L.fileMeta.has(fileId)) localFileIds.add(fileId);
    fileMeta.set(fileId, meta ?? {});
  });

  const baseGlobals = B.globals;
  const localGlobals = L.globals ?? baseGlobals;
  const serverGlobals = S.globals ?? baseGlobals;
  const globalsPick = pickThreeWay(baseGlobals, localGlobals, serverGlobals);
  const globalsFromLocal = globalsPick.from === 'local' ? Boolean(L.globalsRaw) : !S.globalsRaw;
  const globalsRaw = (globalsFromLocal ? (L.globalsRaw ?? S.globalsRaw) : (S.globalsRaw ?? L.globalsRaw)) ?? {};

  const nodes: MappedNode[] = chosen.map(({ entry, fileId, position }) => {
    const props: Record<string, any> = {};
    Object.keys(entry.node.properties || {}).forEach(k => {
      if (!k.startsWith('file') && !k.startsWith('global')) props[k] = entry.node.properties[k];
    });
    if (fileId) Object.assign(props, { fileId, ...(fileMeta.get(fileId) || {}) });
    Object.assign(props, globalsRaw);
    return {
      nodeId: entry.node.nodeId,
      nodeName: position.nodeName,
      componentType: entry.node.componentType,
      positionX: position.positionX,
      positionY: position.positionY,
      properties: props
    };
  });

  const nodeIds = new Set(nodes.map(n => n.nodeId));
  const edgeKeys = [...Array.from(L.edges.keys()), ...Array.from(S.edges.keys()).filter(k => !L.edges.has(k))];
  const seenPairs = new Set<string>();
  const edges: MappedEdge[] = [];
  edgeKeys.forEach(key => {
    const pick = pickThreeWay(B.edges.has(key), L.edges.has(key), S.edges.has(key));
    if (!pick.value) return;
    const edge = (L.edges.get(key) ?? S.edges.get(key))!;
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) return;
    const pair = [edge.sourceNodeId, edge.targetNodeId].sort().join('|');
    if (seenPairs.has(pair)) return;
    seenPairs.add(pair);
    edges.push(edge);
  });

  return { graph: { nodes, edges }, localNodeIds, localFileIds, globalsFromLocal, conflictNodeIds };
};

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
  const navState = location.state as { initialProvider?: CloudProvider; justCreated?: boolean } | null;
  const initialProvider = navState?.initialProvider;
  const { fetchWithAuth, isAutoSaveEnabled, accessToken } = useAuth();

  const [showTutorial, setShowTutorial] = useState(false);
  const [showTutorialHint, setShowTutorialHint] = useState(false);

  const dismissTutorialHint = useCallback(() => {
    setShowTutorialHint(false);
    try { if (projectId) sessionStorage.setItem(`infragen-tutorial-hint-${projectId}`, '1'); } catch (e) {}
  }, [projectId]);

  useEffect(() => {
    if (!navState?.justCreated || !projectId) return;
    try { if (sessionStorage.getItem(`infragen-tutorial-hint-${projectId}`)) return; } catch (e) {}
    setShowTutorialHint(true);
    const timer = window.setTimeout(dismissTutorialHint, 10000);
    return () => window.clearTimeout(timer);
  }, [navState?.justCreated, projectId, dismissTutorialHint]);

  const [userInfo, setUserInfo] = useState({ id: 0, nickname: '로딩중...', email: '로딩중...' });

  const [myRole, setMyRole] = useState<ProjectRole>('VIEWER');

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

  const cursorReadyRef = useRef(false);
  const cursorProjectIdRef = useRef<string | undefined>(projectId);
  const lastOperationSentAt = useRef(0);
  const [cursorStore] = useState(() => new RemoteCursorStore());
  const [cursorSender] = useState(() => new CursorSender(payload => {
    const client = stompClient.current;
    const targetProjectId = cursorProjectIdRef.current;
    if (!client?.connected || !cursorReadyRef.current || !targetProjectId) return false;
    try {
      client.publish({ destination: `/app/projects/${targetProjectId}/cursors`, body: JSON.stringify(payload) });
      return true;
    } catch (e) {
      return false;
    }
  }));
  const [cursorNames, setCursorNames] = useState<{ members: Record<string, { nickname?: string; role?: CursorRole }>; fetchedAt: number } | null>(null);
  const cursorNamesRef = useRef(cursorNames);
  const cursorNamesRequestedAt = useRef(0);
  const cursorNamesTimer = useRef<number | null>(null);
  const cursorNamesUnavailable = useRef(false);

  const isDataLoaded = useRef(false);
  const isUndoRedo = useRef(false);
  const hasUnsavedChanges = useRef(false);
  const autoSaveCallback = useRef<(() => void) | null>(null);

  const hasLoadedOnce = useRef(false);
  const baseGraphRef = useRef<MappedGraph | null>(null);
  const ownWriteVersions = useRef<number[]>([]);
  const writesInFlight = useRef(0);
  const deferredResyncs = useRef<(number | null)[]>([]);
  const projectNameRef = useRef(projectName);
  const projectDescriptionRef = useRef(projectDescription);
  projectNameRef.current = projectName;
  projectDescriptionRef.current = projectDescription;
  const roleCheckedAt = useRef(0);
  const roleCheckInFlight = useRef(false);
  const accessLost = useRef(false);
  const refreshMyRoleRef = useRef<(options?: { announce?: boolean; fallbackMessage?: string }) => void>(() => {});

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
  const performSyncRef = useRef<(reason: ResyncReason, hintVersion: number | null) => Promise<GraphState | null>>(async () => null);
  const [isConflictSyncing, setIsConflictSyncing] = useState(false);
  const [unappliedOps, setUnappliedOps] = useState<PendingOp[]>([]);

  const lastTokenRefreshAt = useRef(0);
  const connectedTokenRef = useRef<string | null>(null);

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
  const graphStateRef = useRef<GraphState>({ nodes, edges, files, targetFileIds, cloudProvider, includeLocal, cloudSettings });

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

  const handleAccessLost = useCallback(() => {
    if (accessLost.current) return;
    accessLost.current = true;
    myRoleRef.current = 'VIEWER';
    setMyRole('VIEWER');
    cursorSender.disable();
    showToast(PROJECT_ACCESS_LOST_MESSAGE);
  }, [cursorSender]);

  const fetchSnapshot = useCallback(async (afterVersion: number, notifyError: boolean): Promise<SnapshotResult | null> => {
    if (!projectId) return null;
    try {
      let from = afterVersion;
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetchWithAuth(`${BASE_URL}/projects/${projectId}/collaboration?afterVersion=${from}`, undefined, { silent: true });
        const data = await res.json().catch(() => null);
        if (res.ok && isApiSuccess(data)) {
          const result = data.result || {};
          const operations: any[] = Array.isArray(result.operations)
            ? [...result.operations].sort((a, b) => (Number(a?.serverVersion) || 0) - (Number(b?.serverVersion) || 0))
            : [];
          return { project: result.project ?? null, operations, version: pickSnapshotVersion(result) };
        }
        const code = String(data?.code || '');
        if (code === 'COLLAB409_2' && from > 0) {
          from = 0;
          continue;
        }
        if (code === 'PROJECT403_1') {
          handleAccessLost();
          return null;
        }
        if (notifyError) showToast(data?.message || '프로젝트를 불러오지 못했습니다.');
        return null;
      }
      return null;
    } catch (err) {
      console.error('Collaboration sync failed', err);
      return null;
    }
  }, [projectId, fetchWithAuth, handleAccessLost]);

  const fallbackGlobals = (): GraphGlobals => {
    const current = graphStateRef.current;
    if (!hasLoadedOnce.current && initialProvider) {
      return {
        cloudProvider: initialProvider,
        includeLocal: current.includeLocal,
        cloudSettings: initialProvider === 'OCI'
          ? { ...current.cloudSettings, region: 'ap-seoul-1', instanceType: 'VM.Standard.E2.1.Micro', amiId: '' }
          : current.cloudSettings
      };
    }
    return { cloudProvider: current.cloudProvider, includeLocal: current.includeLocal, cloudSettings: current.cloudSettings };
  };

  const applyServerSnapshot = (snapshot: SnapshotResult, mode: 'replace' | 'merge') => {
    const project = snapshot.project;
    const operations = snapshot.operations;
    operations.forEach(op => {
      if (typeof op?.operationId !== 'string') return;
      inFlightOps.current.delete(op.operationId);
      const key = opKey(op);
      if (latestOwnOpByKey.current.get(key) === op.operationId) latestOwnOpByKey.current.delete(key);
      appliedOperations.current.add(op.operationId);
    });

    const parsed = parseProjectGraph(project);
    const serverState: GraphState = {
      nodes: operations.reduce<NodeData[]>((acc, op) => applyOpToNodes(acc, op), parsed.nodes),
      edges: parsed.edges,
      files: parsed.files,
      targetFileIds: parsed.targetFileIds,
      ...(parsed.globals ?? fallbackGlobals())
    };
    const serverMapped = mapGraphState(serverState);
    const local = graphStateRef.current;
    const conflictNames: string[] = [];
    let next: GraphState;

    if (mode === 'merge' && baseGraphRef.current) {
      const merge = mergeMappedGraphs(baseGraphRef.current, mapGraphState(local, remoteMotions.current), serverMapped);
      const merged = parseProjectGraph(merge.graph);
      const localNodes = new Map(local.nodes.map(n => [n.id, n]));
      const nodesOut = merged.nodes.map(n => {
        const mine = localNodes.get(n.id);
        if (!mine) return n;
        if (merge.localNodeIds.has(n.id)) return mine;
        return { ...n, name: mine.name, x: mine.x, y: mine.y };
      });

      const pairKey = (a: string, b: string) => [a, b].sort().join('|');
      const localEdges = new Map(local.edges.map(e => [pairKey(e.sourceId, e.targetId), e]));
      const edgesOut = merged.edges.map(e => localEdges.get(pairKey(e.sourceId, e.targetId)) ?? e);

      const localFiles = new Map(local.files.map(f => [f.id, f]));
      const mergedFiles = merged.files.map(f => {
        const mine = localFiles.get(f.id);
        if (!mine) return f;
        const nodeIds = [...mine.nodeIds.filter(id => f.nodeIds.includes(id)), ...f.nodeIds.filter(id => !mine.nodeIds.includes(id))];
        if (merge.localFileIds.has(f.id)) return { ...mine, nodeIds };
        return { ...f, nodeIds, isExpanded: mine.isExpanded };
      });
      const keptEmpty = local.files.filter(f => f.nodeIds.length === 0 && !mergedFiles.some(m => m.id === f.id));
      const byId = new Map([...mergedFiles, ...keptEmpty].map(f => [f.id, f]));
      const localOrder = local.files.map(f => f.id);
      const filesOut = [
        ...localOrder.filter(id => byId.has(id)).map(id => byId.get(id)!),
        ...mergedFiles.filter(f => !localOrder.includes(f.id))
      ];
      const targetFileIdsOut = filesOut
        .filter(f => merged.files.some(m => m.id === f.id) ? merged.targetFileIds.includes(f.id) : local.targetFileIds.includes(f.id))
        .map(f => f.id);

      const globals: GraphGlobals = merge.globalsFromLocal || !merged.globals
        ? { cloudProvider: local.cloudProvider, includeLocal: local.includeLocal, cloudSettings: local.cloudSettings }
        : merged.globals;

      merge.conflictNodeIds.forEach(id => {
        const name = localNodes.get(id)?.name ?? serverState.nodes.find(n => n.id === id)?.name;
        if (name) conflictNames.push(name);
      });

      next = { nodes: nodesOut, edges: edgesOut, files: filesOut, targetFileIds: targetFileIdsOut, ...globals };
    } else {
      remoteMotions.current.clear();
      lastRemoteMoveAt.current.clear();
      const localNodes = new Map(local.nodes.map(n => [n.id, n]));
      next = {
        ...serverState,
        nodes: serverState.nodes.map(n => {
          const mine = localNodes.get(n.id);
          return mine && isLocallyDragging(n.id) ? { ...n, x: mine.x, y: mine.y } : n;
        })
      };
    }

    const finalState = next;
    finalState.files = finalState.files.map(f => (f.isGenerated && !f.lastHash)
      ? { ...f, lastHash: computeFileHash(f, finalState.nodes, finalState.edges, finalState.cloudProvider, finalState.includeLocal, finalState.cloudSettings) }
      : f);

    isDataLoaded.current = false;
    if (typeof project?.title === 'string') {
      projectNameRef.current = project.title;
      setProjectName(project.title);
    }
    projectDescriptionRef.current = project?.description || '';
    setProjectDescription(project?.description || '');
    setNodes(finalState.nodes);
    setEdges(finalState.edges);
    setFiles(finalState.files);
    setTargetFileIds(finalState.targetFileIds);
    setCloudProvider(finalState.cloudProvider);
    setIncludeLocal(finalState.includeLocal);
    setCloudSettings(finalState.cloudSettings);
    nodesRef.current = finalState.nodes;
    graphStateRef.current = finalState;
    prevEdges.current = finalState.edges;
    prevFiles.current = finalState.files;
    prevTargetFileIds.current = finalState.targetFileIds;
    baseGraphRef.current = serverMapped;
    lastSyncedGraphSig.current = graphSignature(serverState);
    latestGraphSigRef.current = graphSignature(finalState);
    hasLoadedOnce.current = true;
    if (typeof snapshot.version === 'number') {
      if (snapshot.version < serverVersionRef.current) ownWriteVersions.current = [];
      setServerVersionExact(snapshot.version);
    }

    const pending = latestGraphSigRef.current !== lastSyncedGraphSig.current;
    window.setTimeout(() => {
      isDataLoaded.current = true;
      hasUnsavedChanges.current = pending;
      runLiveSyncRef.current();
    }, 100);

    return { state: finalState, conflictNames };
  };

  const recordOwnWrite = useCallback((version: number) => {
    const list = ownWriteVersions.current;
    list.push(version);
    if (list.length > OWN_WRITE_VERSIONS_KEPT) list.splice(0, list.length - OWN_WRITE_VERSIONS_KEPT);
    bumpServerVersion(version);
  }, [bumpServerVersion]);

  const runSync = useCallback((reason: ResyncReason, hintVersion: number | null = null): Promise<GraphState | null> => {
    const task = syncChain.current.then(() => performSyncRef.current(reason, hintVersion));
    syncChain.current = task.then(() => undefined, err => { console.error('Collaboration sync failed', err); });
    return task.catch(() => null);
  }, []);

  const sendVersionedWrite = useCallback(async (send: (baseVersion: number, rebased: GraphState | null) => Promise<Response>) => {
    writesInFlight.current += 1;
    let rebased: GraphState | null = null;
    try {
      for (let attempt = 0; ; attempt++) {
        const baseVersion = serverVersionRef.current;
        const res = await send(baseVersion, rebased);
        const data: any = await res.json().catch(() => ({}));
        if (res.ok && isApiSuccess(data)) {
          recordOwnWrite(baseVersion + 1);
          return { ok: true, data, rebased };
        }
        if (String(data?.code || '') === 'PROJECT403_1') refreshMyRoleRef.current({ announce: true });
        if (!isVersionConflict(res, data) || attempt >= VERSIONED_WRITE_RETRIES) return { ok: false, data, rebased };
        const next = await runSync('rebase');
        if (!next) return { ok: false, data, rebased };
        rebased = next;
      }
    } finally {
      writesInFlight.current -= 1;
      if (writesInFlight.current === 0 && deferredResyncs.current.length > 0) {
        const versions = deferredResyncs.current;
        deferredResyncs.current = [];
        if (versions.some(v => v === null || !ownWriteVersions.current.includes(v))) runSync('resync');
      }
    }
  }, [recordOwnWrite, runSync]);

  useEffect(() => {
    const handleGlobalToast = (e: any) => {
      setToastMessage(e.detail);
      setTimeout(() => setToastMessage(null), 3000);
    };
    window.addEventListener('global-toast', handleGlobalToast);
    return () => window.removeEventListener('global-toast', handleGlobalToast);
  }, []);

  useEffect(() => {
    const blockImageDrag = (e: DragEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLImageElement || target instanceof HTMLAnchorElement)) return;
      if (target.parentElement?.closest('[draggable="true"]')) return;
      e.preventDefault();
    };
    window.addEventListener('dragstart', blockImageDrag, true);
    return () => window.removeEventListener('dragstart', blockImageDrag, true);
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
  }, [projectId, fetchWithAuth, navigate]);

  const refreshMyRole = useCallback(async (options: { announce?: boolean; fallbackMessage?: string } = {}) => {
    if (!projectId || roleCheckInFlight.current) return;
    if (options.announce && Date.now() - roleCheckedAt.current < ROLE_RECHECK_MIN_GAP_MS) return;
    roleCheckInFlight.current = true;
    roleCheckedAt.current = Date.now();
    try {
      const res = await fetchWithAuth(`${BASE_URL}/projects`, undefined, { silent: true });
      const data = await res.json().catch(() => null);
      if (!res.ok || !isApiSuccess(data)) {
        if (options.fallbackMessage) showToast(options.fallbackMessage);
        return;
      }
      const list = Array.isArray(data.result?.projectList) ? data.result.projectList : [];
      const current = list.find((p: any) => Number(p.projectId) === Number(projectId));
      if (!current) {
        handleAccessLost();
        return;
      }
      accessLost.current = false;
      const role = toProjectRole(current.accessRole ?? current.role);
      if (role === myRoleRef.current) {
        if (options.fallbackMessage) showToast(options.fallbackMessage);
        return;
      }
      myRoleRef.current = role;
      setMyRole(role);
      if (options.announce) showToast(ROLE_CHANGED_MESSAGES[role]);
      if (role === 'VIEWER') {
        heldOps.current = [];
        runSync('resync');
      }
    } catch (e) {
      if (options.fallbackMessage) showToast(options.fallbackMessage);
    } finally {
      roleCheckInFlight.current = false;
    }
  }, [projectId, fetchWithAuth, handleAccessLost, runSync]);

  useEffect(() => { refreshMyRoleRef.current = options => { refreshMyRole(options); }; }, [refreshMyRole]);

  useEffect(() => {
    accessLost.current = false;
    refreshMyRole();
  }, [refreshMyRole]);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - roleCheckedAt.current < ROLE_CHECK_GAP_MS) return;
      refreshMyRoleRef.current({ announce: true });
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, ROLE_CHECK_INTERVAL_MS);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
    };
  }, []);

  const publishOp = useCallback((op: PendingOp) => {
    const client = stompClient.current;
    if (!projectId || !client?.connected || syncPausedRef.current) {
      heldOps.current.push(op);
      return;
    }
    inFlightOps.current.set(op.operationId, op);
    lastOperationSentAt.current = Date.now();
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

    if (reason === 'resync' || reason === 'rebase') {
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

  const hasLocalGraphChanges = () => {
    if (lastSyncedGraphSig.current === null) return false;
    return graphSignature(graphStateRef.current) !== lastSyncedGraphSig.current;
  };

  const performSync = async (reason: ResyncReason, hintVersion: number | null): Promise<GraphState | null> => {
    if (reason === 'resync') {
      if (hintVersion !== null && ownWriteVersions.current.includes(hintVersion)) {
        bumpServerVersion(hintVersion);
        return null;
      }
      if (writesInFlight.current > 0) {
        deferredResyncs.current.push(hintVersion);
        return null;
      }
    }

    syncPausedRef.current = true;
    if (reason === 'conflict') setIsConflictSyncing(true);

    const firstLoad = !hasLoadedOnce.current;
    const canWrite = myRoleRef.current !== 'VIEWER';
    let snapshot: SnapshotResult | null = null;
    let applied: GraphState | null = null;
    let restored = false;
    try {
      const fromVersion = firstLoad || reason === 'resync' || reason === 'rebase' ? 0 : serverVersionRef.current;
      snapshot = await fetchSnapshot(fromVersion, firstLoad);
      if (snapshot?.project) {
        const mode = !firstLoad && canWrite && (reason === 'rebase' || hasLocalGraphChanges()) ? 'merge' : 'replace';
        const result = applyServerSnapshot(snapshot, mode);
        applied = result.state;
        restored = true;
        if (result.conflictNames.length > 0) showToast(mergeConflictMessage(result.conflictNames));
      } else if (snapshot) {
        snapshot.operations.forEach(op => processIncomingOp(op));
        bumpServerVersion(snapshot.version);
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
      if (reason === 'connect' && stompClient.current?.connected) {
        cursorReadyRef.current = true;
        cursorSender.connectionReady();
      }
    }
    return applied;
  };

  const recoverRejectedOps = () => {
    const suspects = Array.from(inFlightOps.current.keys());
    if (suspects.length === 0) return;
    window.setTimeout(async () => {
      const stuck = suspects.map(id => inFlightOps.current.get(id)).filter((op): op is PendingOp => Boolean(op));
      if (stuck.length === 0) return;
      const latest: PendingOp[] = [];
      stuck.forEach(op => {
        inFlightOps.current.delete(op.operationId);
        positionOpSentAt.current.delete(op.operationId);
        const key = opKey(op);
        if (latestOwnOpByKey.current.get(key) === op.operationId) {
          latestOwnOpByKey.current.delete(key);
          latest.push(op);
        }
      });
      if (latest.length === 0) return;
      const snapshot = await fetchSnapshot(0, false);
      const serverNodes = snapshot?.project ? computeServerNodeStates(snapshot.project, snapshot.operations) : null;
      const unapplied = serverNodes ? latest.filter(op => !isOpReflected(op, serverNodes)) : latest;
      if (unapplied.length > 0) setUnappliedOps(prev => coalesceOps([...prev, ...unapplied]));
    }, DRAG_OP_ACK_TIMEOUT_MS);
  };

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
    const snapshot = await fetchSnapshot(0, false);
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
    runSync: (_reason: ResyncReason, _hintVersion?: number | null) => {},
    processIncomingOp: (_op: any) => {},
    requestTokenRefresh: () => {},
    recoverRejectedOps: () => {}
  });
  useEffect(() => {
    performSyncRef.current = performSync;
    collabHandlers.current = {
      runSync: (reason, hintVersion) => { runSync(reason, hintVersion ?? null); },
      processIncomingOp,
      requestTokenRefresh,
      recoverRejectedOps
    };
  });

  const hasAccessToken = Boolean(accessToken);

  useEffect(() => {
    if (!projectId || !userInfo.id || !hasAccessToken) return;
    const myMemberId = userInfo.id;
    cursorProjectIdRef.current = projectId;

    const client: Client = new Client({
      brokerURL: `${WS_BASE_URL}/ws/collaboration`,
      reconnectDelay: 3000,
      beforeConnect: () => {
        const token = accessTokenRef.current ?? '';
        connectedTokenRef.current = token;
        client.connectHeaders = { Authorization: `Bearer ${token}` };
      },
      onConnect: () => {
        console.log('STOMP Collaboration Connected');
        syncPausedRef.current = true;
        bufferedBroadcasts.current = [];
        cursorReadyRef.current = false;
        cursorSender.connectionLost();
        cursorStore.clear();

        client.subscribe(`/topic/projects/${projectId}/operations`, (msg) => {
          let op: any;
          try { op = JSON.parse(msg.body); } catch (e) { return; }
          if (syncPausedRef.current) bufferedBroadcasts.current.push(op);
          else collabHandlers.current.processIncomingOp(op);
        });

        client.subscribe(`/topic/projects/${projectId}/resync`, (msg) => {
          let body: any = null;
          try { body = JSON.parse(msg.body); } catch (e) {}
          const version = typeof body?.serverVersion === 'number' ? body.serverVersion : null;
          collabHandlers.current.runSync('resync', version);
        });

        client.subscribe(`/topic/projects/${projectId}/cursors`, (msg) => {
          let message: any;
          try { message = JSON.parse(msg.body); } catch (e) { return; }
          cursorStore.receive(message, myMemberId);
        });

        client.subscribe(`/user/queue/projects/${projectId}/operation-results`, (msg) => {
          let result: any = {};
          try { result = JSON.parse(msg.body); } catch (e) {}
          const code = String(result?.code || '');
          if (code === 'COLLAB400_3') return;
          if (code === 'PROJECT403_1') {
            const fromOperation = Date.now() - lastOperationSentAt.current <= OPERATION_ERROR_WINDOW_MS;
            if (!fromOperation) cursorSender.disable();
            refreshMyRoleRef.current({ announce: true, fallbackMessage: fromOperation ? NO_WRITE_PERMISSION_MESSAGE : undefined });
            return;
          }
          if (code === 'COLLAB409_2') {
            collabHandlers.current.runSync('conflict');
          } else if (code === 'COLLAB409_1') {
            collabHandlers.current.recoverRejectedOps();
          } else {
            showToast(OPERATION_ERROR_MESSAGES[code] || '변경 내용을 반영하지 못했습니다. 새로고침해 주세요.');
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
        cursorReadyRef.current = false;
        cursorSender.connectionLost();
        cursorStore.clear();
      }
    });

    stompClient.current = client;
    client.activate();

    return () => {
      cursorSender.hide();
      cursorReadyRef.current = false;
      cursorStore.clear();
      connectedTokenRef.current = null;
      client.deactivate();
      if (stompClient.current === client) stompClient.current = null;
    };
  }, [projectId, userInfo.id, hasAccessToken, cursorSender, cursorStore]);

  useEffect(() => {
    const client = stompClient.current;
    const usedToken = connectedTokenRef.current;
    if (!client || !accessToken || !usedToken || usedToken === accessToken) return;
    connectedTokenRef.current = null;
    cursorSender.hide();
    Promise.resolve(client.deactivate()).then(() => {
      if (stompClient.current === client) client.activate();
    });
  }, [accessToken, cursorSender]);

  useEffect(() => {
    const isWindowActive = () => document.visibilityState !== 'hidden' && document.hasFocus();
    const handleFocus = () => cursorSender.setActive(isWindowActive());
    const handleBlur = () => cursorSender.setActive(false);
    cursorSender.setActive(isWindowActive());
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [cursorSender]);

  useEffect(() => () => {
    cursorSender.dispose();
    cursorStore.clear();
  }, [cursorSender, cursorStore]);

  useEffect(() => { cursorNamesRef.current = cursorNames; }, [cursorNames]);

  const fetchCursorNames = useCallback(async () => {
    if (!projectId) return;
    const requestedAt = Date.now();
    cursorNamesRequestedAt.current = requestedAt;
    try {
      const res = await fetchWithAuth(`${BASE_URL}/projects/${projectId}/collaborators`, undefined, { silent: true });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        cursorNamesUnavailable.current = true;
        return;
      }
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (!isApiSuccess(data)) return;
      if (cursorProjectIdRef.current !== projectId) return;
      const members: Record<string, { nickname?: string; role?: CursorRole }> = {};
      const toRole = (value: unknown): CursorRole | undefined => {
        const role = String(value || '').toUpperCase();
        return role === 'OWNER' || role === 'EDITOR' || role === 'VIEWER' ? role : undefined;
      };
      const list = Array.isArray(data.result?.collaborators) ? data.result.collaborators : [];
      list.forEach((c: any) => {
        if (c?.memberId == null) return;
        members[String(c.memberId)] = { nickname: c.nickname ? String(c.nickname) : undefined, role: toRole(c.role) };
      });
      const owner = data.result?.owner;
      if (owner?.memberId != null) {
        members[String(owner.memberId)] = { nickname: owner.nickname ? String(owner.nickname) : undefined, role: 'OWNER' };
      }
      const next = { members, fetchedAt: requestedAt };
      cursorNamesRef.current = next;
      setCursorNames(next);
    } catch (e) {}
  }, [projectId, fetchWithAuth]);

  const requestCursorNames = useCallback(() => {
    if (cursorNamesUnavailable.current || cursorNamesTimer.current !== null) return;
    const wait = Math.max(0, CURSOR_NAMES_MIN_GAP_MS - (Date.now() - cursorNamesRequestedAt.current));
    cursorNamesTimer.current = window.setTimeout(() => {
      cursorNamesTimer.current = null;
      fetchCursorNames();
    }, wait);
  }, [fetchCursorNames]);

  useEffect(() => {
    if (!projectId) return;
    cursorProjectIdRef.current = projectId;
    cursorNamesUnavailable.current = false;
    cursorNamesRequestedAt.current = 0;
    cursorNamesRef.current = null;
    setCursorNames(null);
    cursorStore.reset();
    fetchCursorNames();
    return () => {
      if (cursorNamesTimer.current !== null) {
        window.clearTimeout(cursorNamesTimer.current);
        cursorNamesTimer.current = null;
      }
    };
  }, [projectId, fetchCursorNames, cursorStore]);

  useEffect(() => cursorStore.subscribe(() => {
    const known = cursorNamesRef.current;
    const hasNewStranger = cursorStore.getSnapshot().some(c =>
      !known?.members[String(c.actorMemberId)] && (!known || c.since > known.fetchedAt)
    );
    if (hasNewStranger) requestCursorNames();
  }), [cursorStore, requestCursorNames]);

  const describeCursor = (cursor: RemoteCursor): CursorAppearance => {
    const member = cursorNames?.members[String(cursor.actorMemberId)];
    if (member) {
      return { color: member.role ? CURSOR_ROLE_COLORS[member.role] : CURSOR_UNKNOWN_COLOR, label: member.nickname };
    }
    if (cursorNames && myRole !== 'OWNER' && cursor.since <= cursorNames.fetchedAt) {
      return { color: CURSOR_ROLE_COLORS.OWNER, label: OWNER_CURSOR_LABEL };
    }
    return { color: CURSOR_UNKNOWN_COLOR };
  };

  const handleCursorMove = useCallback((point: CursorPoint | null) => {
    cursorSender.move(point);
  }, [cursorSender]);

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
    if (!previous || myRole === 'VIEWER' || !isDataLoaded.current || isUndoRedo.current) return;

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

    if (!NODES_WITHOUT_SERVICE_NAME.includes(node.type)) {
      if (!settings.name) validationErrors.push({ name: '서비스 이름 누락', desc: `'${node.name}' 노드의 [서비스 이름]을 입력해주세요.`, targetNodeId: node.id, targetField: 'name' });
      else checkNameFormat(settings.name, '서비스 이름', 'name');
    }

    const checkDatabaseName = (val: string) => {
      if (!DB_NAME_REGEX.test(val)) {
        validationErrors.push({ name: '데이터베이스 이름 형식 오류', desc: `'${node.name}' 노드의 [데이터베이스 이름]에는 영문, 숫자, 언더바(_)만 사용할 수 있습니다.`, targetNodeId: node.id, targetField: 'databaseName' });
      }
    };

    if (!settings.containerName) {
      if (!NODES_WITH_OPTIONAL_CONTAINER.includes(node.type)) validationErrors.push({ name: '컨테이너 이름 누락', desc: `'${node.name}' 노드의 [컨테이너 이름]을 입력해주세요.`, targetNodeId: node.id, targetField: 'containerName' });
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

    if (node.type === 'MongoDB') {
      if (!String(settings.imageVersion || '').trim()) validationErrors.push({ name: 'MongoDB 버전 누락', desc: `'${node.name}' 노드의 [도커 이미지 버전]을 선택해주세요.`, targetNodeId: node.id, targetField: 'imageVersion' });
      if (!settings.databaseName) validationErrors.push({ name: 'DB 이름 누락', desc: `'${node.name}' 노드의 [데이터베이스 이름]을 입력해주세요.`, targetNodeId: node.id, targetField: 'databaseName' });
      else checkDatabaseName(String(settings.databaseName));
      if (!String(settings.username || '').trim()) validationErrors.push({ name: 'DB 사용자 누락', desc: `'${node.name}' 노드의 [사용자 이름]을 입력해주세요.`, targetNodeId: node.id, targetField: 'username' });
      if (!settings.password || String(settings.password).length < 8) validationErrors.push({ name: 'DB 비밀번호 오류', desc: `'${node.name}' 노드의 [비밀번호]를 8자리 이상 입력해주세요.`, targetNodeId: node.id, targetField: 'password' });
    }

    if (node.type === 'Spring Boot') {
      if (!settings.javaVersion) validationErrors.push({ name: 'Spring Boot 버전 누락', desc: `'${node.name}' 노드의 [Java 버전]을 선택해주세요.`, targetNodeId: node.id, targetField: 'javaVersion' });
    }

    if (node.type === 'Node.js') {
      const nodeVersion = String(settings.nodeVersion ?? '');
      if (!nodeVersion.trim()) validationErrors.push({ name: 'Node.js 버전 누락', desc: `'${node.name}' 노드의 [Node.js 버전]을 선택해주세요.`, targetNodeId: node.id, targetField: 'nodeVersion' });
      else if (!NODE_VERSION_REGEX.test(nodeVersion)) validationErrors.push({ name: 'Node.js 버전 형식 오류', desc: `'${node.name}' 노드의 [Node.js 버전]은 숫자로만 입력해야 합니다. (예: 22)`, targetNodeId: node.id, targetField: 'nodeVersion' });
    }

    (ENV_VALUE_FIELDS[node.type] || []).forEach(({ key, label }) => {
      const value = settings[key];
      if (typeof value === 'string' && ENV_FORBIDDEN_CHARS.test(value)) {
        validationErrors.push({ name: '사용할 수 없는 문자', desc: `'${node.name}' 노드의 [${label}]에는 큰따옴표("), 백슬래시(\\), 달러 기호($), 줄바꿈을 쓸 수 없습니다.`, targetNodeId: node.id, targetField: key });
      }
    });
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
      const isTargetServer = isAppType(tNode.type);
      if (!isSourceDb || !isTargetServer) {
        validationErrors.push({
          name: '잘못된 노드 연결 방향',
          desc: `'${sNode.name}'(${sNode.type})에서 '${tNode.name}'(${tNode.type})로 연결되었습니다. 연결은 Database에서 애플리케이션(Spring Boot·Node.js) 방향이어야 합니다.`,
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

  const appNodes = activeNodes.filter(n => isAppType(n.type));
  const mongoLinkedAppTypes = activeEdges.flatMap(edge => {
    const s = activeNodes.find(n => n.id === edge.sourceId);
    const t = activeNodes.find(n => n.id === edge.targetId);
    if (s?.type === 'MongoDB' && isAppType(t?.type)) return [t!.type];
    if (t?.type === 'MongoDB' && isAppType(s?.type)) return [s!.type];
    return [];
  });
  if (cloudProvider !== 'LOCAL' && appNodes.length > 1) {
    appNodes.forEach(app => {
      validationErrors.push({
        name: '클라우드 배포 애플리케이션 개수 초과',
        desc: `클라우드 배포는 애플리케이션 노드(Spring Boot·Node.js)를 하나만 지원합니다. 지금 ${appNodes.length}개(${appNodes.map(n => n.name).join(', ')})가 있습니다. 하나만 남기거나 배포 환경을 LOCAL로 바꿔 주세요.`,
        targetNodeId: app.id
      });
    });
  }

  appNodes.forEach(app => {
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

  const putProjectGraph = async (overrideFiles?: FileGroup[]) => {
    const initial: GraphState = { nodes, edges, files: overrideFiles ?? files, targetFileIds, cloudProvider, includeLocal, cloudSettings };
    let sent: GraphState = initial;
    let sentMapped: MappedGraph = { nodes: [], edges: [] };
    const result = await sendVersionedWrite((baseVersion, rebased) => {
      sent = rebased ?? initial;
      sentMapped = mapGraphState(sent, remoteMotions.current);
      return fetchWithAuth(`${BASE_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: projectNameRef.current,
          description: projectDescriptionRef.current,
          nodes: sentMapped.nodes,
          edges: sentMapped.edges,
          baseVersion
        })
      }, { silent: true });
    });
    if (result.ok) {
      const saved = result.data?.result;
      if (Array.isArray(saved?.nodes)) {
        const parsed = parseProjectGraph(saved);
        baseGraphRef.current = mapGraphState({
          nodes: parsed.nodes, edges: parsed.edges, files: parsed.files, targetFileIds: parsed.targetFileIds,
          ...(parsed.globals ?? { cloudProvider: sent.cloudProvider, includeLocal: sent.includeLocal, cloudSettings: sent.cloudSettings })
        });
      } else {
        baseGraphRef.current = sentMapped;
      }
      lastSyncedGraphSig.current = graphSignature(sent);
      liveSyncFailedNotified.current = false;
    }
    return result;
  };

  const runLiveSync = async () => {
    if (myRoleRef.current === 'VIEWER' || appMode !== 'editor' || !projectId || !hasLoadedOnce.current) return;
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
    if (writesInFlight.current > 0) {
      if (liveSyncQuietTimer.current === null) {
        liveSyncQuietTimer.current = window.setTimeout(() => {
          liveSyncQuietTimer.current = null;
          runLiveSyncRef.current();
        }, LIVE_SYNC_DEBOUNCE_MS);
      }
      return;
    }
    const targetSig = latestGraphSigRef.current;
    if (targetSig === null || targetSig === lastSyncedGraphSig.current) return;

    liveSyncInFlight.current = true;
    try {
      const { ok, data } = await putProjectGraph();
      if (ok) {
        if (latestGraphSigRef.current === lastSyncedGraphSig.current) hasUnsavedChanges.current = false;
      } else if (!liveSyncFailedNotified.current && String(data?.code || '') !== 'PROJECT403_1') {
        liveSyncFailedNotified.current = true;
        showToast(LIVE_SYNC_FAIL_MESSAGE);
      }
    } catch (err) {
      if (!liveSyncFailedNotified.current) {
        liveSyncFailedNotified.current = true;
        showToast(LIVE_SYNC_FAIL_MESSAGE);
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
    graphStateRef.current = { nodes, edges, files, targetFileIds, cloudProvider, includeLocal, cloudSettings };
  });

  useEffect(() => {
    const clearLiveSyncTimer = () => {
      if (liveSyncTimer.current) window.clearTimeout(liveSyncTimer.current.timer);
      liveSyncTimer.current = null;
    };
    if (myRole === 'VIEWER' || appMode !== 'editor') {
      clearLiveSyncTimer();
      return;
    }
    const sig = buildGraphSignature(nodes, edges, files, targetFileIds, cloudProvider, includeLocal, cloudSettings);
    latestGraphSigRef.current = sig;

    if (lastSyncedGraphSig.current === null) {
      lastSyncedGraphSig.current = sig;
      return;
    }
    if (!isDataLoaded.current) return;
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
    if (myRole === 'VIEWER') {
      if (!isAutoSave) showToast(VIEWER_SAVE_MESSAGE);
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
      if (appMode === 'editor' && (hasUnsavedChanges.current || activityLog.length > 0) && myRole !== 'VIEWER') {
        handleSaveCanvas(true); 
      }
    }; 
  }); 

  useEffect(() => {
    if (!isAutoSaveEnabled || !projectId || myRole === 'VIEWER') return;
    const tick = () => { if (autoSaveCallback.current) autoSaveCallback.current(); };
    const timerId = setInterval(tick, 10 * 60 * 1000); 
    return () => clearInterval(timerId);
  }, [isAutoSaveEnabled, projectId, myRole]);

  const handleUpdateProjectName = async (newName: string) => {
    if (myRole !== 'OWNER') {
      showToast(PROJECT_NAME_OWNER_ONLY_MESSAGE);
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
          description: projectDescriptionRef.current, 
          baseVersion 
        })
      }));

      if (!ok) {
        showToast(writeFailMessage(data, '프로젝트 이름 저장에 실패했습니다.'));
        setProjectName(previousName);
      } else {
        projectNameRef.current = newName;
        setProjectName(newName);
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
    if (myRole === 'VIEWER') {
      showToast(VIEWER_GENERATE_MESSAGE);
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
        if (isAppType(sourceNode?.type) && isDependencyType(targetNode?.type)) {
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
        } else if (code.startsWith('PARSING400') || GENERATE_VALIDATION_ERROR_CODES.includes(code)) {
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
    if (myRole === 'VIEWER' || history.length === 0) return;
    isUndoRedo.current = true; 
    const previousState = history[history.length - 1];
    setRedoStack((prev) => [...prev, { nodes: [...nodes], edges: [...edges], selectedNodeIds: [...selectedNodeIds], selection: { ...selection }, files: JSON.parse(JSON.stringify(files)), targetFileIds: [...targetFileIds] }]);
    setNodes(previousState.nodes); setEdges(previousState.edges); setSelectedNodeIds(previousState.selectedNodeIds); setSelection(previousState.selection); setFiles(previousState.files); setTargetFileIds(previousState.targetFileIds);
    setHistory((prev) => prev.slice(0, -1));
    setTimeout(() => { isUndoRedo.current = false; }, 100); 
  }, [history, nodes, edges, selectedNodeIds, selection, files, targetFileIds, myRole]);

  const redo = () => {
    if (myRole === 'VIEWER' || redoStack.length === 0) return;
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
    if (myRole === 'VIEWER') return;
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
    } else if (type === 'Node.js') {
      defaultSettings.nodeVersion = '22';
      defaultSettings.port = '3000';
    } else if (type === 'Redis') {
      defaultSettings.imageVersion = 'redis:7.0';
      defaultSettings.port = '6379';
    } else if (type === 'PostgreSQL') {
      defaultSettings.imageVersion = 'postgres:17';
      defaultSettings.port = '5432';
    } else if (type === 'MongoDB') {
      defaultSettings.imageVersion = 'mongo:8.0';
      defaultSettings.port = '27017';
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
    if (selectedNodeIds.length === 0 || myRole === 'VIEWER') return;
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
    if (myRole === 'VIEWER' || (fileIdsToDelete.length === 0 && nodeIdsToDelete.length === 0)) return;
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

  const canWrite = myRole !== 'VIEWER';
  const canMoveNodes = canWrite && !isConflictSyncing;
  const canEditStructure = canWrite && !isConflictSyncing;
  const canRenameNodes = canWrite && !isConflictSyncing;

  return (
    <div className={`app-container ${myRole === 'VIEWER' ? 'viewer-mode' : ''}`}>
      <LocalCursor />
      <style>{NO_SELECT_STYLE}</style>
      <style>
        {unassignedNodeIds.map(id => `
          div[data-id="${id}"], div[id="${id}"] {
            opacity: 0.85 !important;
            filter: saturate(30%) !important;
          }
        `).join('\n')}
        {!canWrite && `
          .react-flow__connection-line { display: none !important; }
          .left-panel [draggable="true"] {
            opacity: 0.5 !important;
            cursor: not-allowed !important;
          }
        `}
      </style>

     <Header 
      onGenerate={canWrite ? handleGenerateClick : () => showToast(VIEWER_GENERATE_MESSAGE)} 
      isGenerateMode={appMode === 'generating'} 
      onResetUI={handleResetUI} 
      onSaveCanvas={canWrite ? () => handleSaveCanvas(false) : () => showToast(VIEWER_SAVE_MESSAGE)}
      onOpenTutorial={() => { dismissTutorialHint(); setShowTutorial(true); }}
      showTutorialHint={showTutorialHint}
      onDismissTutorialHint={dismissTutorialHint}
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
            onUndo={undo} onRedo={redo} canUndo={canWrite && history.length > 0} canRedo={canWrite && redoStack.length > 0}
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
            isSyncing={isConflictSyncing}
            onNodesDragMove={handleNodesDragMove}
            onNodesDragEnd={handleNodesDragEnd}
            focusEdgeId={focusEdgeId}
            setFocusEdgeId={setFocusEdgeId}
            onCursorMove={handleCursorMove}
            overlay={<CollabCursorLayer store={cursorStore} zoom={zoomLevel} describe={describeCursor} />}
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
                                <div className="code-viewer-text" style={{ padding: '16px', overflowY: 'auto', flex: 1, background: 'white', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '12px', fontFamily: "'Consolas', 'Courier New', monospace" }}>
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
        <Generate
          genProgress={genProgress} targetFileIds={targetFileIds} files={files} projectName={projectName} onBack={() => { setAppMode('editor'); }}
          nodeJsGuide={activeNodes.some(n => n.type === 'Node.js') ? { local: cloudProvider === 'LOCAL' || includeLocal, cloud: cloudProvider !== 'LOCAL' } : null}
          mongoGuide={mongoLinkedAppTypes.length > 0 ? { nodeJs: mongoLinkedAppTypes.includes('Node.js'), cloud: cloudProvider !== 'LOCAL' } : null}
          nodes={nodes}
        />
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