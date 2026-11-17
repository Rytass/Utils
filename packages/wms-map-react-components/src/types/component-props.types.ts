import { ViewMode, WMSNodeClickInfo, Map, EditMode, DrawingMode } from '../typings';
import { FlowNode, FlowEdge } from './react-flow.types';

export interface WMSMapModalProps {
  onClose: () => void;
  open: boolean;
  viewMode?: ViewMode;
  colorPalette?: string[];
  showBreadcrumbEditButton?: (warehouseIds: string[]) => boolean;
  onNodeClick?: (nodeInfo: WMSNodeClickInfo) => void;
  onNodeDoubleClick?: (nodeInfo: WMSNodeClickInfo) => void;
  onSave?: (mapData: Map) => void;
  onBreadcrumbClick?: (warehouseId: string, index: number) => void;
  onNameChange?: (name: string) => Promise<void>;
  initialNodes?: FlowNode[];
  initialEdges?: FlowEdge[];
  debugMode?: boolean;
  title?: string;
  onUpload: (files: File[]) => Promise<string[]>;
  getFilenameFQDN?: (filename: string) => Promise<string> | string;
  maxFileSizeKB?: number;
  warehouseIds?: string[];
  /**
   * 開圖時自動縮放到框住所有節點，預設 true。
   * 只在換到另一張地圖（warehouseIds 改變）或同一張圖第一次拿到非空節點時 fit；
   * 同一張圖的節點增減（編輯後儲存、重新抓資料）不會重新 fit。
   * 換圖時請讓 warehouseIds 不晚於 initialNodes 更新。
   */
  fitViewOnLoad?: boolean;
}

export interface WMSMapContentProps {
  editMode: EditMode;
  drawingMode: DrawingMode;
  selectedColor: string;
  viewMode: ViewMode;
  colorPalette?: string[];
  showBreadcrumbEditButton?: (warehouseIds: string[]) => boolean;
  onEditModeChange: (mode: EditMode) => void;
  onToggleRectangleTool: () => void;
  onTogglePenTool: () => void;
  onColorChange: (color: string) => void;
  onNodeClick?: (nodeInfo: WMSNodeClickInfo) => void;
  onNodeDoubleClick?: (nodeInfo: WMSNodeClickInfo) => void;
  onSave?: (mapData: Map) => void;
  onBreadcrumbClick?: (warehouseId: string, index: number) => void;
  onNameChange?: (name: string) => Promise<void>;
  initialNodes?: FlowNode[];
  initialEdges?: FlowEdge[];
  onUpload: (files: File[]) => Promise<string[]>;
  getFilenameFQDN?: (filename: string) => Promise<string> | string;
  maxFileSizeKB?: number;
  warehouseIds?: string[];
  /**
   * 開圖時自動縮放到框住所有節點，預設 true。
   * 只在換到另一張地圖（warehouseIds 改變）或同一張圖第一次拿到非空節點時 fit；
   * 同一張圖的節點增減（編輯後儲存、重新抓資料）不會重新 fit。
   * 換圖時請讓 warehouseIds 不晚於 initialNodes 更新。
   */
  fitViewOnLoad?: boolean;
}
