import React, { FC, useCallback, useEffect, useState, useRef } from 'react';
import {
  addEdge,
  Connection,
  Node as ReactFlowNode,
  OnSelectionChangeParams,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { EditMode, ViewMode } from '../../typings';
import { FlowNode, FlowEdge, FlowNodeChange, WMSMapContentProps } from '../../types/index';
import {
  DEFAULT_RECTANGLE_LABEL,
  DEFAULT_PATH_LABEL,
  MIN_RECTANGLE_SIZE,
  TEXT_MAPPINGS,
  UI_CONFIG,
  DEFAULT_WAREHOUSE_IDS,
} from '../../constants';
import { calculateImageSize, calculateStaggeredPosition } from '../../utils/node-utils';
import { createRectangleCopy, createPathCopy, createImageCopy } from '../../utils/node-operations';
import {
  logMapData,
  transformNodesToMapData,
  logNodeData,
  transformNodeToClickInfo,
} from '../../utils/map-data-transform';
import { useDirectStateHistory } from '../../hooks/use-direct-state-history';
import { debugLog, debugSuccess } from '../../utils/debug-logger';
import Toolbar from '../ui/toolbar';
import Breadcrumb from '../breadcrumb/breadcrumb';
import ReactFlowCanvas from '../canvas/react-flow-canvas';
import ViewModeToolbar from '../ui/view-mode-toolbar';

const WMSMapContent: FC<WMSMapContentProps> = ({
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
  onNameChange,
  initialNodes: propsInitialNodes = [],
  initialEdges: propsInitialEdges = [],
  onUpload,
  getFilenameFQDN,
  maxFileSizeKB = 30720, // 預設 30MB
  warehouseIds = [...DEFAULT_WAREHOUSE_IDS],
}) => {
  const renderCount = useRef(0);

  renderCount.current += 1;

  const [nodes, setNodes, onNodesChangeOriginal] = useNodesState(propsInitialNodes);

  const [edges, setEdges, onEdgesChange] = useEdgesState(propsInitialEdges);
  const [selectedNodes, setSelectedNodes] = useState<FlowNode[]>([]);
  const [isEditingPathPoints, setIsEditingPathPoints] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [showBackground, setShowBackground] = useState<boolean>(true);
  const showBackgroundRef = useRef<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const { getViewport, getNodes, getEdges } = useReactFlow();

  const colorChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 根據當前模式為節點套用正確的狀態規則
  const applyNodeStateRules = useCallback(
    (nodes: FlowNode[]): FlowNode[] => {
      const getNodePermissions = (node: FlowNode): { selectable: boolean; draggable: boolean; deletable: boolean } => {
        const isViewMode = viewMode === ViewMode.VIEW;
        const isImageNode = node.type === 'imageNode';
        const isRectangleNode = node.type === 'rectangleNode';
        const isPathNode = node.type === 'pathNode';
        const isBackgroundMode = editMode === EditMode.BACKGROUND;
        const isLayerMode = editMode === EditMode.LAYER;

        return {
          selectable:
            !isViewMode && ((isImageNode && isBackgroundMode) || ((isRectangleNode || isPathNode) && isLayerMode)),
          draggable:
            !isViewMode && ((isImageNode && isBackgroundMode) || ((isRectangleNode || isPathNode) && isLayerMode)),
          deletable: !isViewMode && ((isImageNode && isBackgroundMode) || (isPathNode && isLayerMode)),
        };
      };

      return nodes.map(node => ({
        ...node,
        ...getNodePermissions(node),
      }));
    },
    [viewMode, editMode],
  );

  // 根據編輯模式和視圖模式動態更新所有節點的可選取性和可拖曳性
  useEffect(() => {
    setNodes((currentNodes: FlowNode[]) => applyNodeStateRules(currentNodes));
  }, [editMode, viewMode, setNodes, applyNodeStateRules]);

  // 使用直接狀態 undo/redo 系統
  const { saveState, undo, redo, canUndo, canRedo, initializeHistory, getHistorySummary } = useDirectStateHistory({
    maxHistorySize: UI_CONFIG.HISTORY_SIZE,
    debugMode: true,
  });

  // 調試：監聽歷史狀態變化
  useEffect(() => {
    const summary = getHistorySummary();

    debugLog('history', '直接狀態歷史:', summary);

    if (summary.operations) {
      const recentOperations = summary.operations
        .slice(-5)
        .map(op => `[${op.index}]${op.operation}${op.isCurrent ? ' (當前)' : ''}`)
        .join(' → ');

      if (recentOperations) {
        debugLog('history', '操作序列:', recentOperations);
      }
    }
  }, [getHistorySummary, nodes.length, edges.length]);

  // 用於追蹤上一次的 initialNodes 以進行比較
  const prevInitialNodesRef = useRef<FlowNode[]>([]);

  // 監聽 initialNodes 變化，當接收到新資料時清空並載入
  useEffect(() => {
    const currentNodeIds = propsInitialNodes.map((n: FlowNode) => n.id).sort();
    const prevNodeIds = prevInitialNodesRef.current.map((n: FlowNode) => n.id).sort();

    const hasChanged =
      currentNodeIds.length !== prevNodeIds.length ||
      currentNodeIds.some((id: string, index: number) => id !== prevNodeIds[index]);

    if (hasChanged) {
      debugLog(TEXT_MAPPINGS.DEBUG.DATA_LOADING, TEXT_MAPPINGS.MESSAGES.DETECT_INITIAL_NODES_CHANGE, {
        [TEXT_MAPPINGS.MESSAGES.NEW_DATA_NODES]: propsInitialNodes.length,
        [TEXT_MAPPINGS.MESSAGES.NEW_DATA_EDGES]: propsInitialEdges.length,
        [TEXT_MAPPINGS.MESSAGES.CURRENT_NODES]: nodes.length,
        [TEXT_MAPPINGS.MESSAGES.CURRENT_EDGES]: edges.length,
        [TEXT_MAPPINGS.MESSAGES.NODE_ID_CHANGE]: {
          [TEXT_MAPPINGS.MESSAGES.NEW_IDS]: currentNodeIds,
          [TEXT_MAPPINGS.MESSAGES.OLD_IDS]: prevNodeIds,
        },
      });

      const nodesWithCorrectStates = applyNodeStateRules(propsInitialNodes);

      setNodes(nodesWithCorrectStates);
      setEdges(propsInitialEdges);

      setSelectedNodes([]);
      setIsEditingPathPoints(false);
      setHoveredNodeId(null);

      setTimeout(() => {
        initializeHistory(nodesWithCorrectStates, propsInitialEdges, editMode);
        debugSuccess(TEXT_MAPPINGS.DEBUG.HISTORY, TEXT_MAPPINGS.MESSAGES.HISTORY_REINITIALIZE, {
          [TEXT_MAPPINGS.MESSAGES.NODE_COUNT]: nodesWithCorrectStates.length,
          [TEXT_MAPPINGS.MESSAGES.EDGE_COUNT]: propsInitialEdges.length,
          [TEXT_MAPPINGS.MESSAGES.OPERATION]: TEXT_MAPPINGS.OPERATIONS.LOAD_NEW_DATA,
        });
      }, UI_CONFIG.NODE_SAVE_DELAY);

      prevInitialNodesRef.current = [...propsInitialNodes];

      debugSuccess(TEXT_MAPPINGS.DEBUG.DATA_LOADING, TEXT_MAPPINGS.MESSAGES.DATA_LOADING_COMPLETE, {
        [TEXT_MAPPINGS.MESSAGES.LOADED_NODES]: nodesWithCorrectStates.length,
        [TEXT_MAPPINGS.MESSAGES.LOADED_EDGES]: propsInitialEdges.length,
        [TEXT_MAPPINGS.MESSAGES.CURRENT_MODE]: { viewMode, editMode },
        [TEXT_MAPPINGS.MESSAGES.NODE_TYPE_STATS]: {
          [TEXT_MAPPINGS.MESSAGES.IMAGE_NODE]: nodesWithCorrectStates.filter(n => n.type === 'imageNode').length,
          [TEXT_MAPPINGS.MESSAGES.RECTANGLE_NODE]: nodesWithCorrectStates.filter(n => n.type === 'rectangleNode')
            .length,
          [TEXT_MAPPINGS.MESSAGES.PATH_NODE]: nodesWithCorrectStates.filter(n => n.type === 'pathNode').length,
        },
        [TEXT_MAPPINGS.MESSAGES.NODE_STATE_STATS]: {
          [TEXT_MAPPINGS.MESSAGES.SELECTABLE]: nodesWithCorrectStates.filter(n => n.selectable).length,
          [TEXT_MAPPINGS.MESSAGES.DRAGGABLE]: nodesWithCorrectStates.filter(n => n.draggable).length,
          [TEXT_MAPPINGS.MESSAGES.DELETABLE]: nodesWithCorrectStates.filter(n => n.deletable).length,
        },
      });
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
    if (nodes.length > 0 || edges.length > 0) {
      const summary = getHistorySummary();

      if (!summary.operations || summary.operations.length === 0) {
        debugLog(TEXT_MAPPINGS.DEBUG.HISTORY, TEXT_MAPPINGS.MESSAGES.FIRST_HISTORY_INIT, {
          [TEXT_MAPPINGS.MESSAGES.NODE_COUNT]: nodes.length,
          [TEXT_MAPPINGS.MESSAGES.EDGE_COUNT]: edges.length,
        });

        initializeHistory(nodes, edges, editMode);
      }
    }
  }, [edges, initializeHistory, nodes, getHistorySummary, editMode]);

  // 立即觸發顏色變更記錄（當執行其他操作時）
  const flushColorChangeHistory = useCallback((): void => {
    if (colorChangeTimeoutRef.current) {
      clearTimeout(colorChangeTimeoutRef.current);
      saveState(nodes, edges, 'change-color', editMode);
      colorChangeTimeoutRef.current = null;
    }
  }, [saveState, nodes, edges, editMode]);

  // 其他方法保持不變，但移除 console.log
  const onNodesChange = useCallback(
    (changes: FlowNodeChange[]): void => {
      if (changes.length > 0) {
        debugLog(
          'reactFlow',
          'onNodesChange 觸發:',
          changes.map(c => ({
            type: c.type,
            id: 'id' in c ? c.id : 'Unknown',
          })),
        );
      }

      onNodesChangeOriginal(changes);

      const hasDragEnd = changes.some(change => change.type === 'position' && change.dragging === false);

      const hasDataChange = changes.some(change => change.type === 'replace' && !change.item?.data?.isResizing);

      if (hasDragEnd) {
        setTimeout(() => {
          saveState(nodes, edges, 'move-shape', editMode);
        }, 10);
      } else if (hasDataChange) {
        const changedNodeIds = changes
          .filter(c => c.type === 'replace')
          .map(c => c.id || c.item?.id)
          .filter(Boolean);

        debugLog('nodes', '檢測到資料變更:', { changedNodes: changedNodeIds });

        setTimeout(() => {
          flushColorChangeHistory();
          saveState(nodes, edges, `data-change-${changedNodeIds.join(',')}`, editMode);

          debugSuccess('history', '立即記錄資料變更歷史:', {
            changedNodes: changedNodeIds,
            operation: `data-change-${changedNodeIds.join(',')}`,
          });
        }, 10);
      }
    },
    [onNodesChangeOriginal, saveState, flushColorChangeHistory, nodes, edges, editMode],
  );

  const onConnect = useCallback(
    (params: Connection): void => {
      setEdges((eds: FlowEdge[]) => addEdge(params, eds));
    },
    [setEdges],
  );

  const handleSave = () => {
    const mapData = transformNodesToMapData(nodes);

    logMapData(mapData);

    if (onSave) {
      onSave(mapData);
    }
  };

  const handleUpload = async (files: File[]): Promise<void> => {
    if (!onUpload) {
      console.error('上傳功能未配置：缺少 onUpload');

      return;
    }

    setIsUploading(true);

    try {
      // 步驟 1: 上傳檔案，取得檔名或 URL 陣列
      const uploadedResults = await onUpload(files);

      if (uploadedResults.length !== files.length) {
        console.warn('部分檔案上傳失敗');
      }

      // 步驟 2: 處理每個上傳成功的檔案
      const processPromises = uploadedResults.map(async (result, index) => {
        try {
          // 步驟 3: 取得完整 URL（如果有 getFilenameFQDN 則使用，否則假設 result 就是 URL）
          const imageUrl = getFilenameFQDN ? await Promise.resolve(getFilenameFQDN(result)) : result;

          // 步驟 4: 載入圖片取得尺寸
          return new Promise<void>((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
              const { width, height } = calculateImageSize(img.width, img.height);
              const viewport = getViewport();
              const position = calculateStaggeredPosition(index, 100, 100, viewport.x, viewport.y, viewport.zoom);

              const newNode: FlowNode = {
                id: `image-${Date.now()}-${index}`,
                type: 'imageNode',
                position,
                selectable: editMode === EditMode.BACKGROUND,
                draggable: editMode === EditMode.BACKGROUND,
                data: {
                  imageUrl,
                  width,
                  height,
                  originalWidth: img.width,
                  originalHeight: img.height,
                  fileName: result, // 儲存 onUpload 返回的字串
                  uploadedUrl: imageUrl,
                },
              };

              setTimeout(() => {
                setNodes((nds: FlowNode[]) => {
                  const maxZIndex = Math.max(...nds.map((n: FlowNode) => n.zIndex || 0), 0);

                  const nodeWithZIndex = { ...newNode, zIndex: maxZIndex + 1 };
                  const newNodes = [...nds, nodeWithZIndex];

                  setTimeout(() => {
                    saveState(newNodes, edges, `upload-image-${result}`, editMode);
                  }, UI_CONFIG.NODE_SAVE_DELAY);

                  return newNodes;
                });
              }, index * UI_CONFIG.STAGGER_DELAY);

              resolve();
            };

            img.onerror = () => {
              console.error(`圖片載入失敗: ${result} (${imageUrl})`);
              reject(new Error(`圖片載入失敗: ${result}`));
            };

            img.src = imageUrl;
          });
        } catch (error) {
          console.error(`處理檔案失敗: ${result}`, error);
          throw error;
        }
      });

      await Promise.allSettled(processPromises);
    } catch (error) {
      console.error('上傳過程發生錯誤:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAll = useCallback((): void => {
    if (editMode === EditMode.BACKGROUND) {
      setNodes((nds: FlowNode[]) => {
        const newNodes = nds.filter((node: FlowNode) => node.type !== 'imageNode');

        setTimeout(() => {
          saveState(newNodes, edges, 'delete-images', editMode);
        }, 10);

        return newNodes;
      });
    } else if (editMode === EditMode.LAYER) {
      setNodes((nds: FlowNode[]) => {
        const newNodes = nds.filter((node: FlowNode) => node.type !== 'rectangleNode' && node.type !== 'pathNode');

        setTimeout(() => {
          saveState(newNodes, [], 'delete-layers', editMode);
        }, 10);

        return newNodes;
      });

      setEdges([]);
    }
  }, [editMode, setNodes, saveState, edges, setEdges]);

  const handleCreateRectangle = useCallback(
    (startX: number, startY: number, endX: number, endY: number) => {
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);

      if (width < MIN_RECTANGLE_SIZE || height < MIN_RECTANGLE_SIZE) return;

      flushColorChangeHistory();

      setNodes((nds: FlowNode[]) => {
        const maxZIndex = Math.max(...nds.map((n: FlowNode) => n.zIndex || 0), 0);

        const newRectangle: FlowNode = {
          id: `rectangle-${Date.now()}`,
          type: 'rectangleNode',
          position: {
            x: Math.min(startX, endX),
            y: Math.min(startY, endY),
          },
          zIndex: maxZIndex + 1,
          selectable: editMode === EditMode.LAYER,
          draggable: editMode === EditMode.LAYER,
          data: {
            width,
            height,
            color: selectedColor,
            label: DEFAULT_RECTANGLE_LABEL,
          },
        };

        const newNodes = [...nds, newRectangle];

        setTimeout(() => {
          saveState(newNodes, edges, 'draw-rectangle', editMode);
        }, 10);

        return newNodes;
      });
    },
    [flushColorChangeHistory, setNodes, editMode, selectedColor, saveState, edges],
  );

  const handleCreatePath = useCallback(
    (points: { x: number; y: number }[]) => {
      if (points.length < 2) return;

      flushColorChangeHistory();

      setNodes((nds: FlowNode[]) => {
        const maxZIndex = Math.max(...nds.map((n: FlowNode) => n.zIndex || 0), 0);

        const newPath: FlowNode = {
          id: `path-${Date.now()}`,
          type: 'pathNode',
          position: {
            x: Math.min(...points.map(p => p.x)),
            y: Math.min(...points.map(p => p.y)),
          },
          zIndex: maxZIndex + 1,
          selectable: editMode === EditMode.LAYER,
          draggable: editMode === EditMode.LAYER,
          data: {
            points,
            color: selectedColor,
            strokeWidth: 2,
            label: DEFAULT_PATH_LABEL,
          },
        };

        const newNodes = [...nds, newPath];

        setTimeout(() => {
          saveState(newNodes, edges, 'draw-path', editMode);
        }, 10);

        return newNodes;
      });
    },
    [flushColorChangeHistory, setNodes, editMode, selectedColor, saveState, edges],
  );

  // 復原/重做功能實作
  const handleUndo = useCallback(() => {
    debugLog('history', '執行 Undo - 按鈕點擊');
    const result = undo();

    if (result) {
      setNodes(result.nodes);
      setEdges(result.edges);
      onEditModeChange(result.editMode);
      debugSuccess('history', 'Undo 成功:', {
        nodes: result.nodes.length,
        edges: result.edges.length,
        editMode: result.editMode,
      });
    }
  }, [undo, setNodes, setEdges, onEditModeChange]);

  const handleRedo = useCallback(() => {
    debugLog('history', '執行 Redo - 按鈕點擊');
    const result = redo();

    if (result) {
      setNodes(result.nodes);
      setEdges(result.edges);
      onEditModeChange(result.editMode);
      debugSuccess('history', 'Redo 成功:', {
        nodes: result.nodes.length,
        edges: result.edges.length,
        editMode: result.editMode,
      });
    }
  }, [redo, setNodes, setEdges, onEditModeChange]);

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      setSelectedNodes(params.nodes as FlowNode[]);

      if (
        params.nodes.length === 1 &&
        (params.nodes[0].type === 'rectangleNode' || params.nodes[0].type === 'pathNode')
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

      const selectedColorableNodes = selectedNodes.filter(
        node => node.type === 'rectangleNode' || node.type === 'pathNode',
      );

      if (selectedColorableNodes.length > 0) {
        setNodes((nds: FlowNode[]) => {
          const newNodes = nds.map((node: FlowNode) => {
            if (selectedColorableNodes.some((selected: FlowNode) => selected.id === node.id)) {
              return { ...node, data: { ...node.data, color } };
            }

            return node;
          });

          if (colorChangeTimeoutRef.current) {
            clearTimeout(colorChangeTimeoutRef.current);
          }

          colorChangeTimeoutRef.current = setTimeout(() => {
            saveState(newNodes, edges, 'change-color', editMode);
            colorChangeTimeoutRef.current = null;
          }, UI_CONFIG.COLOR_CHANGE_DELAY);

          return newNodes;
        });
      }
    },
    [selectedNodes, setNodes, onColorChange, saveState, edges, editMode],
  );

  // 其他回調函數也移除 console.log 並使用 debugLog
  const handleTextEditComplete = useCallback(
    (id: string, oldText: string, newText: string) => {
      debugLog('nodes', '文字編輯完成，手動記錄歷史:', {
        id,
        oldText,
        newText,
      });

      flushColorChangeHistory();

      setTimeout(() => {
        const currentNodes = getNodes();
        const currentEdges = getEdges();

        debugLog('history', '保存文字編輯後的狀態:', {
          id,
          nodesCount: currentNodes.length,
          edgesCount: currentEdges.length,
          updatedNode: (currentNodes as FlowNode[]).find((n: FlowNode) => n.id === id)?.data?.label,
        });

        saveState(currentNodes as FlowNode[], currentEdges as FlowEdge[], `text-edit-${id}`, editMode);
      }, 20);
    },
    [saveState, flushColorChangeHistory, getNodes, getEdges, editMode],
  );

  const handlePathPointsChange = useCallback(
    (id: string, oldPoints: { x: number; y: number }[], newPoints: { x: number; y: number }[]) => {
      debugLog('nodes', '路徑節點點位變更，記錄歷史:', {
        id,
        oldPoints,
        newPoints,
      });

      flushColorChangeHistory();

      setTimeout(() => {
        const currentNodes = getNodes();
        const currentEdges = getEdges();

        debugLog('history', '保存路徑點位編輯後的狀態:', {
          id,
          nodesCount: currentNodes.length,
          edgesCount: currentEdges.length,
          updatedPointsCount:
            (
              (currentNodes as FlowNode[]).find((n: FlowNode) => n.id === id)?.data?.points as Array<{
                x: number;
                y: number;
              }>
            )?.length || 0,
        });

        saveState(currentNodes as FlowNode[], currentEdges as FlowEdge[], `path-edit-${id}`, editMode);
      }, 20);
    },
    [saveState, flushColorChangeHistory, getNodes, getEdges, editMode],
  );

  const handlePathPointDragStateChange = useCallback((isDragging: boolean) => {
    debugLog('events', '路徑點拖曳狀態變更:', isDragging);
    setIsEditingPathPoints(isDragging);
  }, []);

  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: ReactFlowNode) => {
      const flowNode = node as unknown as FlowNode;

      if (viewMode === ViewMode.VIEW && (flowNode.type === 'rectangleNode' || flowNode.type === 'pathNode')) {
        debugLog('events', 'Node hover enter (React Flow)', {
          id: flowNode.id.slice(-4),
          type: flowNode.type,
          viewMode,
          originalColor: flowNode.data?.color,
        });

        setHoveredNodeId(flowNode.id);
      }
    },
    [viewMode],
  );

  const handleNodeMouseLeave = useCallback(
    (_event: React.MouseEvent, node: ReactFlowNode) => {
      const flowNode = node as unknown as FlowNode;

      if (viewMode === ViewMode.VIEW && (flowNode.type === 'rectangleNode' || flowNode.type === 'pathNode')) {
        debugLog('events', 'Node hover leave (React Flow)', {
          id: flowNode.id.slice(-4),
          type: flowNode.type,
          viewMode,
        });

        setHoveredNodeId(null);
      }
    },
    [viewMode],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: ReactFlowNode) => {
      const flowNode = node as unknown as FlowNode;

      debugLog('events', 'Node clicked (React Flow)', {
        id: flowNode.id.slice(-4),
        type: flowNode.type,
        viewMode,
        editMode,
      });

      logNodeData(flowNode);

      if (onNodeClick) {
        const nodeClickInfo = transformNodeToClickInfo(flowNode);

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

  useEffect(() => {
    debugLog('ui', 'showBackground 狀態變化:', showBackground);
  }, [showBackground]);

  const handleCopyPasteSelectedNodes = useCallback(() => {
    if (selectedNodes.length === 0) {
      debugLog('keyboard', 'Command+D 複製貼上：沒有選中的節點');

      return;
    }

    const copyableNodes = selectedNodes.filter(
      node => node.type === 'imageNode' || node.type === 'rectangleNode' || node.type === 'pathNode',
    );

    if (copyableNodes.length === 0) {
      debugLog('keyboard', 'Command+D 複製貼上：選中的節點中沒有可複製的類型');

      return;
    }

    setNodes((currentNodes: FlowNode[]): FlowNode[] => {
      const maxZIndex = Math.max(...currentNodes.map((n: FlowNode) => n.zIndex || 0), 0);

      const newNodes = [...currentNodes];

      const createCopiedNode = (nodeToClone: FlowNode): FlowNode | null => {
        const nodeCreationMap: Record<string, () => FlowNode> = {
          imageNode: () =>
            createImageCopy({
              currentNode: nodeToClone,
              nodeType: 'imageNode',
              data: nodeToClone.data,
            }) as FlowNode,
          rectangleNode: () =>
            createRectangleCopy({
              currentNode: nodeToClone,
              nodeType: 'rectangleNode',
              data: nodeToClone.data,
            }) as FlowNode,
          pathNode: () =>
            createPathCopy({
              currentNode: nodeToClone,
              nodeType: 'pathNode',
              data: nodeToClone.data,
            }) as FlowNode,
        };

        return nodeCreationMap[nodeToClone.type]?.() || null;
      };

      const copiedNodes = copyableNodes
        .map((nodeToClone, index) => {
          const copiedNode = createCopiedNode(nodeToClone);

          return copiedNode
            ? {
                ...copiedNode,
                zIndex: maxZIndex + 1 + index,
              }
            : null;
        })
        .filter((node): node is NonNullable<typeof node> => node !== null);

      return [...newNodes, ...copiedNodes];
    });

    setTimeout(() => {
      saveState(nodes, edges, 'copy-paste-nodes', editMode);
    }, 10);

    debugLog('keyboard', `執行 Command+D 複製貼上成功，複製節點數: ${copyableNodes.length}`, {
      copiedNodeIds: copyableNodes.map(n => n.id),
      copiedNodeTypes: copyableNodes.map(n => n.type),
    });
  }, [selectedNodes, setNodes, nodes, edges, saveState, editMode]);

  // 全域鍵盤快捷鍵處理
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isEditingText =
        activeElement &&
        (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') &&
        activeElement.getAttribute('type') !== 'color';

      if (isEditingText) {
        return;
      }

      if (event.metaKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        event.stopPropagation();
        handleCopyPasteSelectedNodes();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [handleCopyPasteSelectedNodes]);

  return (
    <>
      <Breadcrumb warehouseIds={warehouseIds} onWarehouseClick={onBreadcrumbClick} onNameChange={onNameChange} />
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
          isUploading={isUploading}
          maxFileSizeKB={maxFileSizeKB}
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

      <ViewModeToolbar
        viewMode={viewMode}
        showBackground={showBackground}
        onToggleBackground={handleToggleBackground}
      />
    </>
  );
};

export default WMSMapContent;
