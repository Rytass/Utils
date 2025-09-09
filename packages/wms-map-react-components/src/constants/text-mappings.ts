/**
 * 文字對應表
 * 用於管理所有中文文字，避免 Non-ASCII 字符問題
 */

export const TEXT_MAPPINGS = {
  // Debug 相關
  DEBUG: {
    DATA_LOADING: 'data-loading',
    HISTORY: 'history',
    REACT_FLOW: 'reactFlow',
    NODES: 'nodes',
    EVENTS: 'events',
    UI: 'ui',
    TESTING: 'testing',
  },

  // 操作描述
  OPERATIONS: {
    LOAD_NEW_DATA: 'load-new-data',
    CHANGE_COLOR: 'change-color',
    MOVE_SHAPE: 'move-shape',
    DRAW_RECTANGLE: 'draw-rectangle',
    DRAW_PATH: 'draw-path',
    TEXT_EDIT: 'text-edit',
    PATH_EDIT: 'path-edit',
    DATA_CHANGE: 'data-change',
    DELETE_IMAGES: 'delete-images',
    DELETE_LAYERS: 'delete-layers',
    UPLOAD_IMAGE: 'upload-image',
  },

  // 中文文字對應
  MESSAGES: {
    // 節點類型
    IMAGE_NODE: '圖片節點',
    RECTANGLE_NODE: '矩形節點',
    PATH_NODE: '路徑節點',

    // 狀態描述
    SELECTABLE: '可選取',
    DRAGGABLE: '可拖曳',
    DELETABLE: '可刪除',

    // 數據統計
    NODE_COUNT: '節點數',
    EDGE_COUNT: '邊數',
    CURRENT_NODES: '目前節點數',
    CURRENT_EDGES: '目前邊數',
    NEW_DATA_NODES: '新資料節點數',
    NEW_DATA_EDGES: '新資料邊數',
    LOADED_NODES: '載入節點數',
    LOADED_EDGES: '載入邊數',

    // 操作消息
    DETECT_INITIAL_NODES_CHANGE: '檢測到 initialNodes 變化，更新畫布資料:',
    NODE_ID_CHANGE: '節點ID變化',
    NEW_IDS: '新的',
    OLD_IDS: '舊的',
    DATA_LOADING_COMPLETE: '新資料載入完成:',
    CURRENT_MODE: '當前模式',
    NODE_TYPE_STATS: '節點類型統計',
    NODE_STATE_STATS: '節點狀態統計',
    HISTORY_REINITIALIZE: '歷史記錄已重新初始化:',
    OPERATION: '操作',
    FIRST_HISTORY_INIT: '首次初始化歷史記錄:',

    // 模式相關
    VIEW_MODE_ALL_NODES_DISABLED: '檢視模式下所有節點都不可選取和拖曳',
    BACKGROUND_NODE_RULE: '底圖節點只能在底圖模式下選取和拖曳',
    BACKGROUND_NODE_NO_DELETE: '底圖節點不可刪除',
    RECTANGLE_NODE_RULE: '矩形節點只能在圖層模式下選取和拖曳',
    RECTANGLE_NODE_NO_DELETE: '矩形節點不可刪除',
    PATH_NODE_RULE: '路徑節點只能在圖層模式下選取、拖曳和刪除',

    // 歷史記錄相關
    ENSURE_NEW_DATA_MANAGED: '重新初始化歷史記錄系統，確保新資料被正確管理',
    DELAY_ENSURE_STATE_UPDATE: '延遲確保 React 狀態更新完成',
    AVOID_DYNAMIC_LOADING_CONFLICT: '避免與動態載入時的明確初始化衝突',
    ONLY_INIT_WHEN_NO_HISTORY: '只有在沒有歷史記錄或節點/邊為空時才初始化',

    // React Flow 相關
    ON_NODES_CHANGE_TRIGGER: 'onNodesChange 觸發:',
    DETECT_DATA_CHANGE: '檢測到資料變更:',
    CHANGED_NODES: '檢測到資料變更:',
    IMMEDIATE_RECORD_DATA_CHANGE: '立即記錄資料變更歷史:',
    DELAY_RECORD_COLOR_CHANGE: '延遲記錄顏色變更歷史 (800ms 後記錄，避免頻繁切換時產生過多記錄)',

    // 錯誤處理
    DELAY_TO_GET_UPDATED_STATE: '使用 setTimeout 確保能獲取到更新後的 nodes 狀態',
    RECORD_TEXT_EDIT_STATE: '保存文字編輯後的狀態:',
    RECORD_PATH_EDIT_STATE: '保存路徑點位編輯後的狀態:',
    UPDATED_POINTS_COUNT: '轉換後節點數:',
  },

  // 測試相關文字
  TEST_MESSAGES: {
    SIMPLE_TEST_DATA: '簡單測試資料',
    COMPLEX_WAREHOUSE_DATA: '完整倉庫資料',
    LARGE_TEST_DATA: '大量測試資料',
    DEFAULT_TEST_DATA: '預設測試資料',
    LOAD_SUCCESS: '載入成功',
    LOAD_FAILED: '載入失敗',
    SAVE_SUCCESS: '儲存成功',
    OPEN_MODAL: '開啟 Modal',
    CLOSE_MODAL: '關閉 Modal',
    CLEAR_TEST_RECORD: '清空測試記錄',
    BREADCRUMB_OPEN_MODAL: '透過 breadcrumb 開啟 Modal',
    NODE_CLICK_EVENT: '節點點擊事件:',
    SAVE_EVENT_TRIGGER: '儲存事件觸發，接收到的資料:',
    BREADCRUMB_CLICK_EVENT: 'Breadcrumb 點擊事件:',
    BREADCRUMB_LOAD_TRIGGER: 'breadcrumb 觸發載入:',
    BREADCRUMB_LOAD_FAILED: 'breadcrumb 載入失敗:',
    DATA_TYPE: '資料類型',
    CONVERTED_NODE_COUNT: '轉換後節點數',
    WAREHOUSE_ID: 'warehouseId',
    INDEX: 'index',

    // UI 文字
    WMS_MAP_MODAL_COMPREHENSIVE_TEST: 'WMS Map Modal - 綜合功能測試',
    TEST_DATA_LOADING_DYNAMIC_SWITCH: '測試資料載入與動態切換',
    LOAD_DIFFERENT_TEST_DATA: '點擊下方按鈕載入不同的測試資料到 WmsMapModal 中，也可以在 Modal 開啟狀態下動態切換：',
    SIMPLE_TEST_DATA_BUTTON: '簡單測試資料',
    SIMPLE_TEST_DATA_DESC: '(1個背景 + 2個區域)',
    COMPLEX_WAREHOUSE_BUTTON: '完整倉庫資料',
    COMPLEX_WAREHOUSE_DESC: '(2個背景 + 8個區域)',
    LARGE_TEST_DATA_BUTTON: '大量測試資料',
    LARGE_TEST_DATA_DESC: '(5個背景 + 30個區域)',
    CLEAR_TEST_RECORD_BUTTON: '清空測試記錄',
    CLEAR_TEST_RECORD_DESC: '(重置記錄)',

    // 當前數據統計
    CURRENT_LOADED_DATA: '目前載入的資料',
    DATA_TYPE_LABEL: '資料類型:',
    TOTAL_NODES: '節點總數:',
    BACKGROUND_IMAGES: '背景圖片:',
    RECTANGLE_AREAS: '矩形區域:',
    POLYGON_AREAS: '多邊形區域:',

    // 測試說明
    TEST_INSTRUCTIONS: '測試說明',
    BUTTON_LOADING: '按鈕載入:',
    BUTTON_LOADING_DESC: '使用上方按鈕可手動載入不同的測試資料',
    DYNAMIC_LOADING: '動態載入:',
    DYNAMIC_LOADING_DESC: 'Modal 開啟狀態下點擊不同按鈕，測試資料動態切換功能',
    HISTORY_RECORD_TEST: '歷史記錄測試:',
    HISTORY_RECORD_TEST_DESC: '載入資料後進行編輯操作，測試 Undo/Redo 功能是否正常',
    BREADCRUMB_LOADING: 'Breadcrumb 載入:',
    BREADCRUMB_LOADING_DESC: '點擊 Modal 內的 breadcrumb 路徑可自動載入對應資料：',
    MODE_TEST: '模式測試:',
    MODE_TEST_DESC: '切換檢視模式/編輯模式，測試節點狀態規則',
    LAYER_TEST: '圖層測試:',
    LAYER_TEST_DESC: '在編輯模式下切換底圖/圖層模式，驗證節點互動限制',
    INTERACTION_TEST: '互動測試:',
    NODE_CLICK_OUTPUT: '點擊節點會在 console 輸出詳細資訊',
    SAVE_TRIGGER_ALERT: '儲存功能會觸發 alert 和 console 輸出',
    BREADCRUMB_AUTO_LOAD: 'Breadcrumb 點擊會自動載入對應測試資料',

    // 狀態規則驗證
    STATE_RULE_VERIFICATION: '狀態規則驗證清單',
    VIEW_MODE_RULE: '檢視模式:',
    VIEW_MODE_RULE_DESC: '所有節點都不可選取、不可拖曳、不可刪除',
    EDIT_BACKGROUND_MODE_RULE: '編輯模式 - 底圖:',
    EDIT_BACKGROUND_MODE_DESC: '只有底圖節點(圖片)可選取拖曳，圖層節點不可互動',
    EDIT_LAYER_MODE_RULE: '編輯模式 - 圖層:',
    EDIT_LAYER_MODE_DESC: '只有圖層節點(矩形/路徑)可選取拖曳，底圖節點不可互動',
    DELETE_PERMISSION_RULE: '刪除權限:',
    DELETE_PERMISSION_DESC: '只有路徑節點在圖層模式下可刪除',

    // 預期行為
    EXPECTED_BEHAVIOR: '預期行為',
    NODE_STATE_APPLY_ON_LOAD: '每次載入新資料時，節點狀態會立即套用當前模式的規則',
    NODE_STATE_RECALC_ON_MODE_CHANGE: '模式切換時，所有節點狀態會重新計算',
    CONSOLE_DETAILED_STATS: 'Console 會顯示詳細的節點狀態統計資訊',
    NO_DATA_MIXING: '動態載入不會出現新舊資料混合或狀態錯誤的情況',
    HISTORY_REINIT_ON_LOAD: '載入新資料後，歷史記錄系統會重新初始化並正常工作',
    EDIT_OPERATIONS_RECORDED: '編輯操作會被正確記錄，Undo/Redo 按鈕狀態正確更新',

    // 歷史記錄測試步驟
    HISTORY_TEST_STEPS: '歷史記錄測試步驟',
    LOAD_DATA_STEP: '載入資料:',
    LOAD_DATA_STEP_DESC: '點擊載入按鈕開啟 Modal',
    PERFORM_EDIT_STEP: '進行編輯:',
    PERFORM_EDIT_STEP_DESC: '移動節點、編輯文字、繪製圖形等',
    TEST_UNDO_STEP: '測試 Undo:',
    TEST_UNDO_STEP_DESC: '使用 Cmd+Z 或工具列 Undo 按鈕',
    TEST_REDO_STEP: '測試 Redo:',
    TEST_REDO_STEP_DESC: '使用 Cmd+Shift+Z 或工具列 Redo 按鈕',
    DYNAMIC_SWITCH_STEP: '動態切換:',
    DYNAMIC_SWITCH_STEP_DESC: '在有編輯歷史時載入其他資料',
    REPEAT_TEST_STEP: '重複測試:',
    REPEAT_TEST_STEP_DESC: '確認新資料也有正確的歷史記錄功能',

    // 測試記錄
    TEST_RECORD_HISTORY_TRACKING: '測試記錄與歷史追蹤',
    NO_TEST_RECORD: '尚無測試記錄 - 開始進行測試操作',
    TEST_RECORD_DESCRIPTION:
      '此記錄會自動追蹤您的測試操作，包括資料載入、Modal 開關、breadcrumb 點擊等，便於驗證歷史記錄功能是否正常。',
  },

  // Alert 和通知消息
  ALERTS: {
    LOAD_SUCCESS_WITH_NODES: (typeName: string, nodeCount: number) => `已載入 ${typeName}！包含 ${nodeCount} 個節點`,
    SAVE_SUCCESS_WITH_DATA: (backgroundCount: number, rangeCount: number) =>
      `儲存成功！接收到 ${backgroundCount} 個背景圖片和 ${rangeCount} 個範圍資料`,
    LOAD_FAILED: (error: unknown) => `載入失敗: ${error}`,
    INVALID_IMAGE_FORMAT: (fileName: string) => `檔案 ${fileName} 不是有效的圖片格式，請選擇 PNG 或 JPG 格式`,
  },

  // 時間和計數格式化
  FORMATTERS: {
    NODES_UNIT: '個節點',
    BACKGROUND_COUNT: (count: number) => `背景: ${count}`,
    RANGE_COUNT: (count: number) => `範圍: ${count}`,
    WAREHOUSE_ID_FORMAT: (id: string) => `Warehouse ${id}`,
    INDEX_FORMAT: (index: number) => `索引: ${index}`,
    CURRENT_INDICATOR: '(當前)',
  },
} as const;

export type TextMappingKey = keyof typeof TEXT_MAPPINGS;
export type DebugKey = keyof typeof TEXT_MAPPINGS.DEBUG;
export type OperationKey = keyof typeof TEXT_MAPPINGS.OPERATIONS;
export type MessageKey = keyof typeof TEXT_MAPPINGS.MESSAGES;
export type TestMessageKey = keyof typeof TEXT_MAPPINGS.TEST_MESSAGES;
