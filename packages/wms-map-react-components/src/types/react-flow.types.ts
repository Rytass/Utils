import { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react';

export interface NodeDataBase {
  [key: string]: unknown;
}

export interface FlowNode extends Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  zIndex?: number;
  selectable?: boolean;
  draggable?: boolean;
  deletable?: boolean;
  data: NodeDataBase;
}

export interface FlowEdge extends Edge {
  id: string;
  source: string;
  target: string;
}

export interface FlowNodesChangeHandler {
  (changes: NodeChange<FlowNode>[]): void;
}

export interface FlowEdgesChangeHandler {
  (changes: EdgeChange[]): void;
}

// 使用 ReactFlow 提供的類型
export type FlowNodeChange = NodeChange<FlowNode>;
export type FlowEdgeChange = EdgeChange;
