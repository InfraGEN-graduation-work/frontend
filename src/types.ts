export interface NodeData {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  settings?: Record<string, any>;
}

export interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface SelectionArea {
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
}

export interface FileGroup {
  id: string;
  name: string;
  isGenerated: boolean;
  nodeIds: string[];
  isExpanded: boolean;
  generatedFiles?: { fileName: string; content: string }[]; 
  _isTarget?: boolean;
  lastHash?: string; // ★ 마지막으로 생성 성공했을 때의 해시(Hash) 기억용
}

export type CloudProvider = 'AWS' | 'OCI';

export interface CloudSettings {
  region: string;
  vpcName: string;
  subnetName: string;
  internetGatewayName: string;
  routeTableName: string;
  securityGroupName: string;
  instanceName: string;
  vpcCidr: string;
  subnetCidr: string;
  amiId: string;
  instanceType: string;
  adminCidr: string;
  appCidr: string;
  hostnameLabel?: string;
  compartmentId?: string;
  availabilityDomain?: string;
  sshAuthorizedKeys?: string;
}