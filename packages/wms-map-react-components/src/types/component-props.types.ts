import type { CSSProperties } from 'react';
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

export interface WMSMapPreviewProps {
  /** 要顯示的節點（與 WMSMapModal 的 initialNodes 同格式）。 */
  initialNodes: FlowNode[];
  /** 要高亮的範圍節點 id；有值時 fit 只框住這些節點。 */
  highlightIds?: string[];
  /** 有 highlightIds 時是否淡化其餘範圍，預設 true。 */
  dimOthers?: boolean;
  /** fit 時的比例 padding，預設 0.15。 */
  fitPadding?: number;
  /** 是否允許平移與縮放，預設 false（完全靜態）。任何情況下都不可選取或編輯。 */
  interactive?: boolean;
  /** 提供時，背景圖改用 `getFilenameFQDN(data.fileName)` 的結果作為圖片網址。 */
  getFilenameFQDN?: (filename: string) => Promise<string> | string;
  className?: string;
  style?: CSSProperties;
}
