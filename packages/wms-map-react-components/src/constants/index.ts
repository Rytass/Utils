// 預設尺寸
export const DEFAULT_IMAGE_WIDTH = 300;
export const DEFAULT_IMAGE_HEIGHT = 200;
export const DEFAULT_RECTANGLE_WIDTH = 150;
export const DEFAULT_RECTANGLE_HEIGHT = 100;

// 顏色
export const DEFAULT_RECTANGLE_COLOR = '#3b82f6';
export const SELECTION_BORDER_COLOR = '#3b82f6';
export const DEFAULT_BACKGROUND_TOOL_COLOR = '#3b82f6';

// 最小尺寸
export const MIN_RECTANGLE_SIZE = 10;
export const MIN_RESIZE_WIDTH = 50;
export const MIN_RESIZE_HEIGHT = 30;

// 文字和標籤
export const DEFAULT_RECTANGLE_LABEL = '矩形區域';
export const DEFAULT_PATH_LABEL = '路徑區域';

// 透明度數值
export const ACTIVE_OPACITY = 1;
export const INACTIVE_OPACITY = 0.4;
export const RECTANGLE_INACTIVE_OPACITY = 0.6;

// 調整大小控制項樣式
export const RESIZE_CONTROL_SIZE = 16;
export const IMAGE_RESIZE_CONTROL_SIZE = 20;

// UI 配置
export const UI_CONFIG = {
  HISTORY_SIZE: 50,
  COLOR_CHANGE_DELAY: 800, // ms
  STAGGER_DELAY: 100, // ms for image upload
  NODE_SAVE_DELAY: 50, // ms
} as const;

// Canvas 配置
export const CANVAS_CONFIG = {
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 4,
  DEFAULT_VIEWPORT: { x: 0, y: 0, zoom: 1 },
  BACKGROUND_COLOR: '#F5F5F5',
} as const;

// 預設倉庫 ID (應該從外部傳入)
export const DEFAULT_WAREHOUSE_IDS = [
  '10001',
  '10001A',
  '10002',
  '100002B',
  '100003',
  '100003B',
] as const;

// 檔案類型
export const SUPPORTED_IMAGE_TYPES = {
  ACCEPT: 'image/png,image/jpeg,image/jpg',
  PATTERN: /^image\/(png|jpeg|jpg)$/,
  EXTENSIONS: ['png', 'jpg', 'jpeg'] as const,
} as const;

// Export text mappings
export { TEXT_MAPPINGS } from './text-mappings';
export type {
  TextMappingKey,
  DebugKey,
  OperationKey,
  MessageKey,
  TestMessageKey,
} from './text-mappings';
