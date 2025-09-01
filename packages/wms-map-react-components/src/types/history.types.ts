import { EditMode } from '../typings';
import { FlowNode, FlowEdge } from './react-flow.types';

export interface HistoryState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  editMode: EditMode;
  operation: string;
  timestamp: number;
}

export interface HistoryOperation {
  index: number;
  operation: string;
  nodes: number;
  edges: number;
  isCurrent: boolean;
}

export interface HistorySummary {
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  currentIndex: number;
  currentOperation?: string;
  operations?: HistoryOperation[];
}
