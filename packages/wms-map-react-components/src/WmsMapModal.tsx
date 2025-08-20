import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { Modal, ModalHeader } from '@mezzanine-ui/react';
import {
  addEdge,
  Connection,
  Edge,
  Node,
  OnSelectionChangeParams,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  DrawingMode,
  EditMode,
  Map,
  ViewMode,
  WmsNodeClickInfo,
} from '../typings';
import {
  DEFAULT_PATH_LABEL,
  DEFAULT_RECTANGLE_COLOR,
  DEFAULT_RECTANGLE_LABEL,
  MIN_RECTANGLE_SIZE,
  TEXT_MAPPINGS,
} from './constants';
import {
  calculateImageSize,
  calculateStaggeredPosition,
} from './utils/nodeUtils';
import {
  createImageCopy,
  createPathCopy,
  createRectangleCopy,
} from './utils/nodeOperations';
import {
  logMapData,
  logNodeData,
  transformNodesToMapData,
  transformNodeToClickInfo,
} from './utils/mapDataTransform';
import { useDirectStateHistory } from './hooks/useDirectStateHistory';
import { debugLog, debugSuccess, setDebugMode } from './utils/debugLogger';
import Toolbar from './Toolbar';
import Breadcrumb from './components/breadcrumb/Breadcrumb';
import ReactFlowCanvas from './ReactFlowCanvas';
import ViewModeToggle from './components/ViewModeToggle';
import ViewModeToolbar from './components/ViewModeToolbar';
import styles from './wmsMapModal.module.scss';

interface WmsMapModalProps {
  onClose: () => void;
  open: boolean;
  viewMode?: ViewMode;
  colorPalette?: string[];
  onNodeClick?: (nodeInfo: WmsNodeClickInfo) => void;
  onSave?: (mapData: Map) => void;
  onBreadcrumbClick?: (warehouseId: string, index: number) => void; // 新增：breadcrumb 點擊事件
  onWarehouseNameEdit?: (
    warehouseId: string,
    newName: string,
    index: number,
  ) => void; // 新增：修改區域名稱事件
  initialNodes?: Node[];
  initialEdges?: Edge[];
  debugMode?: boolean; // 新增：控制 debug 模式的開關
}

// 內部組件 - 包含歷史管理邏輯，必須在 ReactFlowProvider 內部
const WmsMapContent: FC<{
  editMode: EditMode;
  drawingMode: DrawingMode;
  selectedColor: string;
  viewMode: ViewMode;
  colorPalette?: string[];
  onEditModeChange: (mode: EditMode) => void;
  onToggleRectangleTool: () => void;
  onTogglePenTool: () => void;
  onColorChange: (color: string) => void;
  onNodeClick?: (nodeInfo: WmsNodeClickInfo) => void;
  onSave?: (mapData: Map) => void;
  onBreadcrumbClick?: (warehouseId: string, index: number) => void;
  onWarehouseNameEdit?: (
    warehouseId: string,
    newName: string,
    index: number,
  ) => void;
  initialNodes?: Node[];
  initialEdges?: Edge[];
}> = ({
  editMode,
  drawingMode,
  selectedColor,
  viewMode,
  colorPalette,
  onEditModeChange,
  onToggleRectangleTool,
  onTogglePenTool,
  onColorChange,
  onNodeClick,
  onSave,
  onBreadcrumbClick,
  onWarehouseNameEdit,
  initialNodes: propsInitialNodes = [],
  initialEdges: propsInitialEdges = [],
}) => {
  const renderCount = useRef(0);

  renderCount.current += 1;

  // console.log('🔄 WmsMapContent 重新渲染:', {
  //   editMode,
  //   drawingMode,
  //   viewMode,
  //   renderCount: renderCount.current
  // });

  const [nodes, setNodes, onNodesChangeOriginal] =
    useNodesState(propsInitialNodes);

  const [edges, setEdges, onEdgesChange] = useEdgesState(propsInitialEdges);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [isEditingPathPoints, setIsEditingPathPoints] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [showBackground, setShowBackground] = useState<boolean>(true);
  const showBackgroundRef = useRef<boolean>(true);

  // Get React Flow instance for viewport information
  const { getViewport, getNodes, getEdges } = useReactFlow();

  // 用於延遲顏色變更歷史記錄的 ref
  const colorChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // 根據當前模式為節點套用正確的狀態規則
  const applyNodeStateRules = useCallback(
    (nodes: Node[]) => {
      return nodes.map((node) => {
        let shouldBeSelectable = false;
        let shouldBeDraggable = false;
        let shouldBeDeletable = false;

        // 檢視模式下所有節點都不可選取和拖曳
        if (viewMode === ViewMode.VIEW) {
          shouldBeSelectable = false;
          shouldBeDraggable = false;
          shouldBeDeletable = false;
        } else if (node.type === 'imageNode') {
          // 底圖節點只能在底圖模式下選取、拖曳和刪除
          shouldBeSelectable = editMode === EditMode.BACKGROUND;
          shouldBeDraggable = editMode === EditMode.BACKGROUND;
          shouldBeDeletable = editMode === EditMode.BACKGROUND; // 底圖節點在底圖模式下可刪除
        } else if (node.type === 'rectangleNode') {
          // 矩形節點只能在圖層模式下選取和拖曳
          shouldBeSelectable = editMode === EditMode.LAYER;
          shouldBeDraggable = editMode === EditMode.LAYER;
          shouldBeDeletable = false; // 矩形節點不可刪除
        } else if (node.type === 'pathNode') {
          // 路徑節點只能在圖層模式下選取、拖曳和刪除
          shouldBeSelectable = editMode === EditMode.LAYER;
          shouldBeDraggable = editMode === EditMode.LAYER;
          shouldBeDeletable = editMode === EditMode.LAYER;
        }

        return {
          ...node,
          selectable: shouldBeSelectable,
          draggable: shouldBeDraggable,
          deletable: shouldBeDeletable,
        };
      });
    },
    [viewMode, editMode],
  );

  // 根據編輯模式和視圖模式動態更新所有節點的可選取性和可拖曳性
  useEffect(() => {
    setNodes((currentNodes) => applyNodeStateRules(currentNodes));
  }, [editMode, viewMode, setNodes, applyNodeStateRules]);

  // 使用直接狀態 undo/redo 系統
  const {
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    initializeHistory,
    getHistorySummary,
  } = useDirectStateHistory({
    maxHistorySize: 50,
    debugMode: true,
  });

  // 調試：監聽歷史狀態變化
  useEffect(() => {
    const summary = getHistorySummary();

    debugLog('history', '直接狀態歷史:', summary);

    if (summary.operations) {
      const recentOperations = summary.operations
        .slice(-5)
        .map(
          (op) =>
            `[${op.index}]${op.operation}${op.isCurrent ? ' (當前)' : ''}`,
        )
        .join(' → ');

      if (recentOperations) {
        debugLog('history', '操作序列:', recentOperations);
      }
    }
  }, [getHistorySummary, nodes.length, edges.length]);

  // 用於追蹤上一次的 initialNodes 以進行比較
  const prevInitialNodesRef = useRef<Node[]>([]);

  // 監聽 initialNodes 變化，當接收到新資料時清空並載入
  useEffect(() => {
    // 簡單的深度比較：比較節點 ID 和數量
    const currentNodeIds = propsInitialNodes.map((n) => n.id).sort();
    const prevNodeIds = prevInitialNodesRef.current.map((n) => n.id).sort();
    const hasChanged =
      currentNodeIds.length !== prevNodeIds.length ||
      currentNodeIds.some((id, index) => id !== prevNodeIds[index]);

    if (hasChanged) {
      debugLog(
        TEXT_MAPPINGS.DEBUG.DATA_LOADING,
        TEXT_MAPPINGS.MESSAGES.DETECT_INITIAL_NODES_CHANGE,
        {
          [TEXT_MAPPINGS.MESSAGES.NEW_DATA_NODES]: propsInitialNodes.length,
          [TEXT_MAPPINGS.MESSAGES.NEW_DATA_EDGES]: propsInitialEdges.length,
          [TEXT_MAPPINGS.MESSAGES.CURRENT_NODES]: nodes.length,
          [TEXT_MAPPINGS.MESSAGES.CURRENT_EDGES]: edges.length,
          [TEXT_MAPPINGS.MESSAGES.NODE_ID_CHANGE]: {
            [TEXT_MAPPINGS.MESSAGES.NEW_IDS]: currentNodeIds,
            [TEXT_MAPPINGS.MESSAGES.OLD_IDS]: prevNodeIds,
          },
        },
      );

      // 清空當前資料並載入新資料，套用正確的狀態規則
      const nodesWithCorrectStates = applyNodeStateRules(propsInitialNodes);

      setNodes(nodesWithCorrectStates);
      setEdges(propsInitialEdges);

      // 清空相關狀態
      setSelectedNodes([]);
      setIsEditingPathPoints(false);
      setHoveredNodeId(null);

      // 重新初始化歷史記錄系統，確保新資料被正確管理
      setTimeout(() => {
        initializeHistory(nodesWithCorrectStates, propsInitialEdges);
        debugSuccess(
          TEXT_MAPPINGS.DEBUG.HISTORY,
          TEXT_MAPPINGS.MESSAGES.HISTORY_REINITIALIZE,
          {
            [TEXT_MAPPINGS.MESSAGES.NODE_COUNT]: nodesWithCorrectStates.length,
            [TEXT_MAPPINGS.MESSAGES.EDGE_COUNT]: propsInitialEdges.length,
            [TEXT_MAPPINGS.MESSAGES.OPERATION]:
              TEXT_MAPPINGS.OPERATIONS.LOAD_NEW_DATA,
          },
        );
      }, 50); // 延遲確保 React 狀態更新完成

      // 更新 ref
      prevInitialNodesRef.current = [...propsInitialNodes];

      debugSuccess(
        TEXT_MAPPINGS.DEBUG.DATA_LOADING,
        TEXT_MAPPINGS.MESSAGES.DATA_LOADING_COMPLETE,
        {
          [TEXT_MAPPINGS.MESSAGES.LOADED_NODES]: nodesWithCorrectStates.length,
          [TEXT_MAPPINGS.MESSAGES.LOADED_EDGES]: propsInitialEdges.length,
          [TEXT_MAPPINGS.MESSAGES.CURRENT_MODE]: { viewMode, editMode },
          [TEXT_MAPPINGS.MESSAGES.NODE_TYPE_STATS]: {
            [TEXT_MAPPINGS.MESSAGES.IMAGE_NODE]: nodesWithCorrectStates.filter(
              (n) => n.type === 'imageNode',
            ).length,
            [TEXT_MAPPINGS.MESSAGES.RECTANGLE_NODE]:
              nodesWithCorrectStates.filter((n) => n.type === 'rectangleNode')
                .length,
            [TEXT_MAPPINGS.MESSAGES.PATH_NODE]: nodesWithCorrectStates.filter(
              (n) => n.type === 'pathNode',
            ).length,
          },
          [TEXT_MAPPINGS.MESSAGES.NODE_STATE_STATS]: {
            [TEXT_MAPPINGS.MESSAGES.SELECTABLE]: nodesWithCorrectStates.filter(
              (n) => n.selectable,
            ).length,
            [TEXT_MAPPINGS.MESSAGES.DRAGGABLE]: nodesWithCorrectStates.filter(
              (n) => n.draggable,
            ).length,
            [TEXT_MAPPINGS.MESSAGES.DELETABLE]: nodesWithCorrectStates.filter(
              (n) => n.deletable,
            ).length,
          },
        },
      );
    }
  }, [
    propsInitialNodes,
    propsInitialEdges,
    nodes.length,
    edges.length,
    setNodes,
    setEdges,
    applyNodeStateRules,
    viewMode,
    editMode,
    initializeHistory,
  ]);

  // 初始化歷史記錄（只在組件首次載入或節點/邊清空時執行）
  useEffect(() => {
    // 只有在沒有歷史記錄或節點/邊為空時才初始化
    // 避免與動態載入時的明確初始化衝突
    if (nodes.length > 0 || edges.length > 0) {
      const summary = getHistorySummary();

      if (!summary.operations || summary.operations.length === 0) {
        debugLog(
          TEXT_MAPPINGS.DEBUG.HISTORY,
          TEXT_MAPPINGS.MESSAGES.FIRST_HISTORY_INIT,
          {
            [TEXT_MAPPINGS.MESSAGES.NODE_COUNT]: nodes.length,
            [TEXT_MAPPINGS.MESSAGES.EDGE_COUNT]: edges.length,
          },
        );

        initializeHistory(nodes, edges);
      }
    }
  }, [edges, initializeHistory, nodes, getHistorySummary]);

  // 立即觸發顏色變更記錄（當執行其他操作時）
  const flushColorChangeHistory = useCallback(() => {
    if (colorChangeTimeoutRef.current) {
      clearTimeout(colorChangeTimeoutRef.current);
      // 立即記錄當前狀態
      saveState(nodes, edges, 'change-color');
      colorChangeTimeoutRef.current = null;
    }
  }, [saveState, nodes, edges]);

  // 改進的 onNodesChange，記錄各種節點變更操作
  const onNodesChange = useCallback(
    (changes: any[]) => {
      // 調試日誌：記錄所有變更類型
      if (changes.length > 0) {
        debugLog(
          'reactFlow',
          'onNodesChange 觸發:',
          changes.map((c) => ({ type: c.type, id: c.id || c.item?.id })),
        );
      }

      onNodesChangeOriginal(changes);

      // 檢查是否有拖動結束的操作
      const hasDragEnd = changes.some(
        (change) => change.type === 'position' && change.dragging === false,
      );

      // 檢查是否有資料變更（包含文字編輯），但忽略調整大小中的變更
      const hasDataChange = changes.some(
        (change) =>
          change.type === 'replace' &&
          // 忽略正在調整大小的節點的資料變更
          !change.item?.data?.isResizing,
      );

      if (hasDragEnd) {
        // 拖動結束後記錄狀態
        setTimeout(() => {
          saveState(nodes, edges, 'move-shape');
        }, 10);
      } else if (hasDataChange) {
        // 資料變更（包含文字編輯）立即記錄歷史
        const changedNodeIds = changes
          .filter((c) => c.type === 'replace')
          .map((c) => c.id || c.item?.id)
          .filter(Boolean);

        debugLog('nodes', '檢測到資料變更:', { changedNodes: changedNodeIds });

        // 立即記錄資料變更歷史（文字編輯會自動包含在 React Flow 節點資料中）
        setTimeout(() => {
          flushColorChangeHistory(); // 先清理顏色變更記錄
          saveState(nodes, edges, `data-change-${changedNodeIds.join(',')}`);
          debugSuccess('history', '立即記錄資料變更歷史:', {
            changedNodes: changedNodeIds,
            operation: `data-change-${changedNodeIds.join(',')}`,
          });
        }, 10);
      }
    },
    [onNodesChangeOriginal, saveState, flushColorChangeHistory, nodes, edges],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges],
  );

  const handleSave = () => {
    // 轉換 React Flow 節點資料為符合 typings.ts 定義的格式
    const mapData = transformNodesToMapData(nodes);

    // 輸出格式化的資料到 console
    logMapData(mapData);

    if (onSave) {
      onSave(mapData);
    }
  };

  const handleUpload = () => {
    const input = document.createElement('input');

    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/jpg';
    input.multiple = true; // 啟用多檔案選擇
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);

      if (files.length > 0) {
        // 處理每個檔案
        files.forEach((file: File, index: number) => {
          // 檢查檔案類型
          if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
            alert(
              `檔案 ${file.name} 不是有效的圖片格式，請選擇 PNG 或 JPG 格式`,
            );

            return;
          }

          // 建立檔案 URL
          const imageUrl = URL.createObjectURL(file);

          // 建立圖片元素以取得尺寸
          const img = new Image();

          img.onload = () => {
            // 使用工具函數計算適當尺寸
            const { width, height } = calculateImageSize(img.width, img.height);

            // 使用工具函數計算錯開位置，優先使用當前 viewport 位置
            const viewport = getViewport();
            const position = calculateStaggeredPosition(
              index,
              100,
              100,
              viewport.x,
              viewport.y,
              viewport.zoom,
            );

            // 建立新的圖片節點
            const newNode = {
              id: `image-${Date.now()}-${index}`,
              type: 'imageNode',
              position,
              selectable: editMode === EditMode.BACKGROUND, // 根據當前編輯模式設置可選取性
              draggable: editMode === EditMode.BACKGROUND, // 根據當前編輯模式設置可拖曳性
              data: {
                imageUrl,
                width,
                height,
                originalWidth: img.width,
                originalHeight: img.height,
                fileName: file.name,
              },
            };

            // 在畫布上添加節點，稍微延遲以確保正確堆疊
            setTimeout(() => {
              setNodes((nds) => {
                // 計算下一個 zIndex
                const maxZIndex = Math.max(...nds.map((n) => n.zIndex || 0), 0);
                const nodeWithZIndex = { ...newNode, zIndex: maxZIndex + 1 };
                const newNodes = [...nds, nodeWithZIndex];

                // 每張圖片上傳後都記錄狀態
                setTimeout(() => {
                  saveState(newNodes, edges, `upload-image-${file.name}`);
                }, 50);

                return newNodes;
              });
            }, index * 100); // 每張圖片間隔 100ms 延遲
          };

          img.src = imageUrl;
        });
      }
    };

    input.click();
  };

  const handleDeleteAll = useCallback(() => {
    if (editMode === EditMode.BACKGROUND) {
      // 刪除所有圖片節點（背景圖片）
      setNodes((nds) => {
        const newNodes = nds.filter((node) => node.type !== 'imageNode');

        // 刪除圖片後記錄狀態
        setTimeout(() => {
          saveState(newNodes, edges, 'delete-images');
        }, 10);

        return newNodes;
      });
    } else if (editMode === EditMode.LAYER) {
      // 刪除所有圖層節點（矩形和路徑）
      setNodes((nds) => {
        const newNodes = nds.filter(
          (node) => node.type !== 'rectangleNode' && node.type !== 'pathNode',
        );

        // 刪除圖層後記錄狀態
        setTimeout(() => {
          saveState(newNodes, [], 'delete-layers'); // edges 也被清空
        }, 10);

        return newNodes;
      });

      // 刪除圖層元素時也清除邊線
      setEdges([]);
    }
  }, [editMode, setNodes, saveState, edges, setEdges]);

  const handleCreateRectangle = useCallback(
    (startX: number, startY: number, endX: number, endY: number) => {
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);

      if (width < MIN_RECTANGLE_SIZE || height < MIN_RECTANGLE_SIZE) return; // 最小尺寸檢查

      flushColorChangeHistory(); // 先清理顏色變更記錄

      setNodes((nds) => {
        // Calculate next zIndex
        const maxZIndex = Math.max(...nds.map((n) => n.zIndex || 0), 0);

        const newRectangle = {
          id: `rectangle-${Date.now()}`,
          type: 'rectangleNode',
          position: {
            x: Math.min(startX, endX),
            y: Math.min(startY, endY),
          },
          zIndex: maxZIndex + 1,
          selectable: editMode === EditMode.LAYER, // 根據當前編輯模式設置可選取性
          draggable: editMode === EditMode.LAYER, // 根據當前編輯模式設置可拖曳性
          data: {
            width,
            height,
            color: selectedColor,
            label: DEFAULT_RECTANGLE_LABEL,
          },
        };

        const newNodes = [...nds, newRectangle];

        // 創建矩形後記錄狀態
        setTimeout(() => {
          saveState(newNodes, edges, 'draw-rectangle');
        }, 10);

        return newNodes;
      });

      // 保持繪圖模式以進行連續繪圖
    },
    [
      flushColorChangeHistory,
      setNodes,
      editMode,
      selectedColor,
      saveState,
      edges,
    ],
  );

  const handleCreatePath = useCallback(
    (points: { x: number; y: number }[]) => {
      if (points.length < 2) return; // 路徑至少需要 2 個點

      flushColorChangeHistory(); // 先清理顏色變更記錄

      setNodes((nds) => {
        // Calculate next zIndex
        const maxZIndex = Math.max(...nds.map((n) => n.zIndex || 0), 0);

        const newPath = {
          id: `path-${Date.now()}`,
          type: 'pathNode',
          position: {
            x: Math.min(...points.map((p) => p.x)),
            y: Math.min(...points.map((p) => p.y)),
          },
          zIndex: maxZIndex + 1,
          selectable: editMode === EditMode.LAYER, // 根據當前編輯模式設置可選取性
          draggable: editMode === EditMode.LAYER, // 根據當前編輯模式設置可拖曳性
          data: {
            points,
            color: selectedColor,
            strokeWidth: 2,
            label: DEFAULT_PATH_LABEL,
          },
        };

        const newNodes = [...nds, newPath];

        // 創建路徑後記錄狀態
        setTimeout(() => {
          saveState(newNodes, edges, 'draw-path');
        }, 10);

        return newNodes;
      });

      // 保持繪圖模式以進行連續繪圖
    },
    [
      flushColorChangeHistory,
      setNodes,
      editMode,
      selectedColor,
      saveState,
      edges,
    ],
  );

  // 復原/重做功能實作 - 直接設置狀態
  const handleUndo = useCallback(() => {
    debugLog('history', '執行 Undo - 按鈕點擊');
    const result = undo();

    if (result) {
      setNodes(result.nodes);
      setEdges(result.edges);
      debugSuccess('history', 'Undo 成功:', {
        nodes: result.nodes.length,
        edges: result.edges.length,
      });
    }
  }, [undo, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    debugLog('history', '執行 Redo - 按鈕點擊');
    const result = redo();

    if (result) {
      setNodes(result.nodes);
      setEdges(result.edges);
      debugSuccess('history', 'Redo 成功:', {
        nodes: result.nodes.length,
        edges: result.edges.length,
      });
    }
  }, [redo, setNodes, setEdges]);

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      setSelectedNodes(params.nodes);

      // 如果選擇了單一可著色節點，更新顏色選擇器以顯示其顏色
      if (
        params.nodes.length === 1 &&
        (params.nodes[0].type === 'rectangleNode' ||
          params.nodes[0].type === 'pathNode')
      ) {
        const selectedNode = params.nodes[0];
        const nodeColor = selectedNode.data?.color;

        if (nodeColor && typeof nodeColor === 'string') {
          onColorChange(nodeColor);
        }
      }
    },
    [onColorChange],
  );

  const handleColorChangeInternal = useCallback(
    (color: string) => {
      onColorChange(color);

      // 更新選中可著色節點（矩形和路徑）的顏色
      const selectedColorableNodes = selectedNodes.filter(
        (node) => node.type === 'rectangleNode' || node.type === 'pathNode',
      );

      if (selectedColorableNodes.length > 0) {
        setNodes((nds) => {
          const newNodes = nds.map((node) => {
            if (
              selectedColorableNodes.some((selected) => selected.id === node.id)
            ) {
              return { ...node, data: { ...node.data, color } };
            }

            return node;
          });

          // 清除之前的延遲記錄
          if (colorChangeTimeoutRef.current) {
            clearTimeout(colorChangeTimeoutRef.current);
          }

          // 延遲記錄顏色變更歷史 (800ms 後記錄，避免頻繁切換時產生過多記錄)
          colorChangeTimeoutRef.current = setTimeout(() => {
            saveState(newNodes, edges, 'change-color');
            colorChangeTimeoutRef.current = null;
          }, 800);

          return newNodes;
        });
      }
    },
    [selectedNodes, setNodes, onColorChange, saveState, edges],
  );

  // 處理文字編輯完成（手動觸發歷史記錄）
  const handleTextEditComplete = useCallback(
    (id: string, oldText: string, newText: string) => {
      debugLog('nodes', '文字編輯完成，手動記錄歷史:', {
        id,
        oldText,
        newText,
      });

      flushColorChangeHistory(); // 先清理顏色變更記錄

      // 使用 setTimeout 確保能獲取到更新後的 nodes 狀態
      setTimeout(() => {
        // 通過 React Flow hooks 獲取最新的節點和邊狀態
        const currentNodes = getNodes();
        const currentEdges = getEdges();

        debugLog('history', '保存文字編輯後的狀態:', {
          id,
          nodesCount: currentNodes.length,
          edgesCount: currentEdges.length,
          updatedNode: currentNodes.find((n: any) => n.id === id)?.data?.label,
        });

        saveState(currentNodes, currentEdges, `text-edit-${id}`);
      }, 20); // 增加延遲時間確保狀態更新完成
    },
    [saveState, flushColorChangeHistory, getNodes, getEdges],
  );

  // 處理路徑節點點位變更（記錄到歷史中）
  const handlePathPointsChange = useCallback(
    (
      id: string,
      oldPoints: { x: number; y: number }[],
      newPoints: { x: number; y: number }[],
    ) => {
      debugLog('nodes', '路徑節點點位變更，記錄歷史:', {
        id,
        oldPoints,
        newPoints,
      });

      flushColorChangeHistory(); // 先清理顏色變更記錄

      // 使用 setTimeout 確保能獲取到更新後的 nodes 狀態
      setTimeout(() => {
        // 通過 React Flow hooks 獲取最新的節點和邊狀態
        const currentNodes = getNodes();
        const currentEdges = getEdges();

        debugLog('history', '保存路徑點位編輯後的狀態:', {
          id,
          nodesCount: currentNodes.length,
          edgesCount: currentEdges.length,
          updatedPointsCount:
            (currentNodes.find((n: any) => n.id === id)?.data?.points as any[])
              ?.length || 0,
        });

        saveState(currentNodes, currentEdges, `path-edit-${id}`);
      }, 20);
    },
    [saveState, flushColorChangeHistory, getNodes, getEdges],
  );

  // 處理路徑點拖曳狀態變更
  const handlePathPointDragStateChange = useCallback((isDragging: boolean) => {
    debugLog('events', '路徑點拖曳狀態變更:', isDragging);
    setIsEditingPathPoints(isDragging);
  }, []);

  // 處理節點 hover 事件 (React Flow 內建事件)
  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // 只在檢視模式下啟用 hover 效果
      if (
        viewMode === ViewMode.VIEW &&
        (node.type === 'rectangleNode' || node.type === 'pathNode')
      ) {
        debugLog('events', 'Node hover enter (React Flow)', {
          id: node.id.slice(-4),
          type: node.type,
          viewMode,
          originalColor: node.data?.color,
        });

        setHoveredNodeId(node.id);
      }
    },
    [viewMode],
  );

  const handleNodeMouseLeave = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // 只在檢視模式下處理 hover 效果
      if (
        viewMode === ViewMode.VIEW &&
        (node.type === 'rectangleNode' || node.type === 'pathNode')
      ) {
        debugLog('events', 'Node hover leave (React Flow)', {
          id: node.id.slice(-4),
          type: node.type,
          viewMode,
        });

        setHoveredNodeId(null);
      }
    },
    [viewMode],
  );

  // 處理節點點擊事件 (React Flow 內建事件)
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      debugLog('events', 'Node clicked (React Flow)', {
        id: node.id.slice(-4),
        type: node.type,
        viewMode,
        editMode,
      });

      // 輸出詳細的圖形資訊（和儲存時相同的格式）
      logNodeData(node);

      // 如果父組件提供了 callBack，將點擊資訊傳遞給父組件
      if (onNodeClick) {
        const nodeClickInfo = transformNodeToClickInfo(node);

        if (nodeClickInfo) {
          debugLog('events', '將點擊資訊傳遞給父組件:', nodeClickInfo);
          onNodeClick(nodeClickInfo);
        }
      }
    },
    [viewMode, editMode, onNodeClick],
  );

  const handleToggleBackground = useCallback((show: boolean) => {
    debugLog('ui', '切換底圖顯示:', { showBackground: show });
    showBackgroundRef.current = show;
    setShowBackground(show);
  }, []);

  // 追蹤 showBackground 狀態變化
  useEffect(() => {
    debugLog('ui', 'showBackground 狀態變化:', showBackground);
  }, [showBackground]);

  // 集中式複製貼上功能
  const handleCopyPasteSelectedNodes = useCallback(() => {
    if (selectedNodes.length === 0) {
      debugLog('keyboard', 'Command+D 複製貼上：沒有選中的節點');

      return;
    }

    // 只複製可複製的節點類型（圖片、矩形和路徑節點）
    const copyableNodes = selectedNodes.filter(
      (node) =>
        node.type === 'imageNode' ||
        node.type === 'rectangleNode' ||
        node.type === 'pathNode',
    );

    if (copyableNodes.length === 0) {
      debugLog('keyboard', 'Command+D 複製貼上：選中的節點中沒有可複製的類型');

      return;
    }

    setNodes((currentNodes) => {
      const maxZIndex = Math.max(...currentNodes.map((n) => n.zIndex || 0), 0);
      const newNodes = [...currentNodes];

      copyableNodes.forEach((nodeToClone, index) => {
        let copiedNode;

        if (nodeToClone.type === 'imageNode') {
          copiedNode = createImageCopy({
            currentNode: nodeToClone,
            nodeType: 'imageNode',
            data: nodeToClone.data,
          });
        } else if (nodeToClone.type === 'rectangleNode') {
          copiedNode = createRectangleCopy({
            currentNode: nodeToClone,
            nodeType: 'rectangleNode',
            data: nodeToClone.data,
          });
        } else if (nodeToClone.type === 'pathNode') {
          copiedNode = createPathCopy({
            currentNode: nodeToClone,
            nodeType: 'pathNode',
            data: nodeToClone.data,
          });
        }

        if (copiedNode) {
          // 為每個複製的節點設定遞增的 zIndex，確保新節點在最上層
          const nodeWithZIndex = {
            ...copiedNode,
            zIndex: maxZIndex + 1 + index,
          };

          newNodes.push(nodeWithZIndex);
        }
      });

      return newNodes;
    });

    // 記錄歷史狀態
    setTimeout(() => {
      saveState(nodes, edges, 'copy-paste-nodes');
    }, 10);

    debugLog(
      'keyboard',
      `執行 Command+D 複製貼上成功，複製節點數: ${copyableNodes.length}`,
      {
        copiedNodeIds: copyableNodes.map((n) => n.id),
        copiedNodeTypes: copyableNodes.map((n) => n.type),
      },
    );
  }, [selectedNodes, setNodes, nodes, edges, saveState]);

  // 全域鍵盤快捷鍵處理 (Command+D 複製貼上)
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // 檢查是否正在編輯文字 (避免在文字輸入時觸發)
      const activeElement = document.activeElement;
      const isEditingText =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA') &&
        activeElement.getAttribute('type') !== 'color';

      if (isEditingText) {
        return; // 如果正在編輯文字，不處理快捷鍵
      }

      // Command+D (⌘+D) - 複製並貼上選中的節點
      if (event.metaKey && event.key.toLowerCase() === 'd') {
        event.preventDefault(); // 防止瀏覽器的預設書籤行為
        event.stopPropagation();

        handleCopyPasteSelectedNodes();
      }
    };

    // 添加全域鍵盤事件監聽器
    document.addEventListener('keydown', handleGlobalKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [handleCopyPasteSelectedNodes]); // 依賴 handleCopyPasteSelectedNodes 函數

  return (
    <>
      <Breadcrumb
        warehouseIds={[
          '10001',
          '10001A',
          '10002',
          '100002B',
          '100003',
          '100003B',
        ]}
        onWarehouseClick={onBreadcrumbClick}
        onWarehouseNameEdit={onWarehouseNameEdit}
      />
      {viewMode === ViewMode.EDIT && (
        <Toolbar
          onUpload={handleUpload}
          onDeleteAll={handleDeleteAll}
          onSave={handleSave}
          editMode={editMode}
          drawingMode={drawingMode}
          onEditModeChange={onEditModeChange}
          onToggleRectangleTool={onToggleRectangleTool}
          onTogglePenTool={onTogglePenTool}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onColorChange={handleColorChangeInternal}
          selectedColor={selectedColor}
          colorPalette={colorPalette}
        />
      )}

      <ReactFlowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        editMode={editMode}
        drawingMode={drawingMode}
        viewMode={viewMode}
        selectedColor={selectedColor}
        onCreateRectangle={handleCreateRectangle}
        onCreatePath={handleCreatePath}
        onSelectionChange={handleSelectionChange}
        onTextEditComplete={handleTextEditComplete}
        onPathPointsChange={handlePathPointsChange}
        onPathPointDragStateChange={handlePathPointDragStateChange}
        isEditingPathPoints={isEditingPathPoints}
        hoveredNodeId={hoveredNodeId}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onNodeClick={handleNodeClick}
        showBackground={showBackground}
      />

      {/* ViewModeToolbar - 只在檢視模式下顯示 */}
      <ViewModeToolbar
        viewMode={viewMode}
        showBackground={showBackground}
        onToggleBackground={handleToggleBackground}
      />
    </>
  );
};

const WmsMapModal: FC<WmsMapModalProps> = ({
  onClose,
  open,
  viewMode: initialViewMode = ViewMode.EDIT,
  colorPalette,
  onNodeClick,
  onSave,
  onBreadcrumbClick,
  onWarehouseNameEdit,
  initialNodes,
  initialEdges,
  debugMode = false, // 預設為關閉
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [editMode, setEditMode] = useState<EditMode>(EditMode.BACKGROUND);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(DrawingMode.NONE);
  const [selectedColor, setSelectedColor] = useState<string>(() => {
    // 如果有提供 colorPalette，使用第一個顏色作為默認值
    if (colorPalette && colorPalette.length > 0) {
      return colorPalette[0];
    }

    return DEFAULT_RECTANGLE_COLOR;
  });

  // 設定 debug 模式
  useEffect(() => {
    setDebugMode(debugMode);
  }, [debugMode]);

  // 同步外部 viewMode 變化
  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  // 當 colorPalette 變化時，確保選中的顏色仍然有效
  useEffect(() => {
    if (colorPalette && colorPalette.length > 0) {
      // 如果當前選中的顏色不在新的 palette 中，切換到第一個顏色
      if (!colorPalette.includes(selectedColor)) {
        setSelectedColor(colorPalette[0]);
      }
    }
  }, [colorPalette, selectedColor]);

  const handleViewModeToggle = useCallback(() => {
    setViewMode((prev) =>
      prev === ViewMode.EDIT ? ViewMode.VIEW : ViewMode.EDIT,
    );
  }, []);

  const handleEditModeChange = useCallback((mode: EditMode) => {
    setEditMode(mode);
    setDrawingMode(DrawingMode.NONE); // 切換編輯模式時重設繪圖模式
  }, []);

  const handleToggleRectangleTool = useCallback(() => {
    if (editMode !== EditMode.LAYER) return;

    setDrawingMode((prev) =>
      prev === DrawingMode.RECTANGLE ? DrawingMode.NONE : DrawingMode.RECTANGLE,
    );
  }, [editMode]);

  const handleTogglePenTool = useCallback(() => {
    if (editMode !== EditMode.LAYER) return;

    setDrawingMode((prev) =>
      prev === DrawingMode.PEN ? DrawingMode.NONE : DrawingMode.PEN,
    );
  }, [editMode]);

  const handleColorChange = useCallback((color: string) => {
    setSelectedColor(color);
  }, []);

  return (
    <>
      {/* 浮動在遮罩層上的測試按鈕 */}
      <ViewModeToggle
        viewMode={viewMode}
        onToggle={handleViewModeToggle}
        isVisible={open} // 只有當 Modal 開啟時才顯示
      />

      <Modal open={open} onClose={onClose} className={styles.modal}>
        <ModalHeader className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>編輯倉儲空間</span>
          </div>
        </ModalHeader>

        <div className={styles.content}>
          <ReactFlowProvider>
            <WmsMapContent
              editMode={editMode}
              drawingMode={drawingMode}
              selectedColor={selectedColor}
              viewMode={viewMode}
              colorPalette={colorPalette}
              onEditModeChange={handleEditModeChange}
              onToggleRectangleTool={handleToggleRectangleTool}
              onTogglePenTool={handleTogglePenTool}
              onColorChange={handleColorChange}
              onNodeClick={onNodeClick}
              onSave={onSave}
              onBreadcrumbClick={onBreadcrumbClick}
              onWarehouseNameEdit={onWarehouseNameEdit}
              initialNodes={initialNodes}
              initialEdges={initialEdges}
            />
          </ReactFlowProvider>
        </div>
      </Modal>
    </>
  );
};

export default WmsMapModal;
