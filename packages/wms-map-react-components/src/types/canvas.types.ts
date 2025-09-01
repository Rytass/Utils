import { FlowNode } from './react-flow.types';

export interface ImageNodeData {
  imageUrl: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  fileName: string;
}

export interface RectangleNodeData {
  width: number;
  height: number;
  color: string;
  label: string;
  isResizing?: boolean;
}

export interface PathNodeData {
  points: Array<{ x: number; y: number }>;
  color: string;
  strokeWidth: number;
  label: string;
}

export interface NodeCreationData {
  currentNode: FlowNode;
  nodeType: string;
  data: ImageNodeData | RectangleNodeData | PathNodeData;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}
