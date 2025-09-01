import {
  ViewMode,
  WMSNodeClickInfo,
  Map,
  EditMode,
  DrawingMode,
} from '../typings';
import { FlowNode, FlowEdge } from './react-flow.types';

export interface WMSMapModalProps {
  onClose: () => void;
  open: boolean;
  viewMode?: ViewMode;
  colorPalette?: string[];
  onNodeClick?: (nodeInfo: WMSNodeClickInfo) => void;
  onSave?: (mapData: Map) => void;
  onBreadcrumbClick?: (warehouseId: string, index: number) => void;
  onWarehouseNameEdit?: (
    warehouseId: string,
    newName: string,
    index: number,
  ) => void;
  initialNodes?: FlowNode[];
  initialEdges?: FlowEdge[];
  debugMode?: boolean;
  title?: string;
}

export interface WMSMapContentProps {
  editMode: EditMode;
  drawingMode: DrawingMode;
  selectedColor: string;
  viewMode: ViewMode;
  colorPalette?: string[];
  onEditModeChange: (mode: EditMode) => void;
  onToggleRectangleTool: () => void;
  onTogglePenTool: () => void;
  onColorChange: (color: string) => void;
  onNodeClick?: (nodeInfo: WMSNodeClickInfo) => void;
  onSave?: (mapData: Map) => void;
  onBreadcrumbClick?: (warehouseId: string, index: number) => void;
  onWarehouseNameEdit?: (
    warehouseId: string,
    newName: string,
    index: number,
  ) => void;
  initialNodes?: FlowNode[];
  initialEdges?: FlowEdge[];
}
