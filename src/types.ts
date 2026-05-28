export interface NodeData {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
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
}