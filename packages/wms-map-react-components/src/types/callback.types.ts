import { FlowNode, FlowEdge } from './react-flow.types';

export interface NodesStateSetterCallback {
  (updater: (currentNodes: FlowNode[]) => FlowNode[]): void;
}

export interface EdgesStateSetterCallback {
  (updater: (currentEdges: FlowEdge[]) => FlowEdge[]): void;
}
