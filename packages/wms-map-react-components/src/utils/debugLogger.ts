/**
 * 簡化的 Debug Console 管理系統
 * 只有開啟/關閉功能，可透過 WmsMapModal props 控制
 * 使用命名空間避免污染全域範圍
 */

// WmsMapModal 專用的 debug 命名空間
const WMS_DEBUG_NAMESPACE = '__WMS_MAP_DEBUG__';

// 取得 WmsMapModal 專用的 debug 狀態
const getWmsDebugState = (): boolean => {
  return (globalThis as any)[WMS_DEBUG_NAMESPACE] || false;
};

// 設定 WmsMapModal 專用的 debug 狀態
const setWmsDebugState = (enabled: boolean): void => {
  (globalThis as any)[WMS_DEBUG_NAMESPACE] = enabled;
};

/**
 * 設定 debug 模式 (僅限 WmsMapModal 範圍)
 */
export const setDebugMode = (enabled: boolean): void => {
  setWmsDebugState(enabled);
};

/**
 * 取得 debug 模式狀態 (僅限 WmsMapModal 範圍)
 */
export const getDebugMode = (): boolean => {
  return getWmsDebugState();
};

/**
 * 主要的 debug logger 函數
 */
export const debugLog = (message: string, ...args: any[]): void => {
  if (!getWmsDebugState()) {
    return;
  }

  const timestamp = new Date().toLocaleTimeString();
  const prefix = `🔧 ${timestamp} [WMS]`;

  console.log(prefix, message, ...args);
};

/**
 * 成功 debug log
 */
export const debugSuccess = (message: string, ...args: any[]): void => {
  if (!getWmsDebugState()) {
    return;
  }

  const timestamp = new Date().toLocaleTimeString();
  const prefix = `✅ ${timestamp} [WMS]`;

  console.log(prefix, message, ...args);
};

/**
 * 錯誤 debug log
 */
export const debugError = (message: string, error?: any): void => {
  if (!getWmsDebugState()) {
    return;
  }

  const timestamp = new Date().toLocaleTimeString();
  const prefix = `❌ ${timestamp} [WMS]`;

  console.error(prefix, message, error);
};

/**
 * 警告 debug log
 */
export const debugWarn = (message: string, ...args: any[]): void => {
  if (!getWmsDebugState()) {
    return;
  }

  const timestamp = new Date().toLocaleTimeString();
  const prefix = `⚠️ ${timestamp} [WMS]`;

  console.warn(prefix, message, ...args);
};

/**
 * 群組化的 debug log
 */
export const debugGroup = (groupName: string, callback: () => void): void => {
  if (!getWmsDebugState()) {
    callback();

    return;
  }

  const timestamp = new Date().toLocaleTimeString();
  const prefix = `🔧 ${timestamp} [WMS]`;

  console.group(`${prefix} ${groupName}`);
  try {
    callback();
  } finally {
    console.groupEnd();
  }
};
