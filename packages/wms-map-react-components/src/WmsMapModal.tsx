import React, { FC, useCallback, useEffect, useState, useRef } from 'react';
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
import { DrawingMode, EditMode } from '../typings';
import {
  DEFAULT_PATH_LABEL,
  DEFAULT_RECTANGLE_COLOR,
  DEFAULT_RECTANGLE_LABEL,
  MIN_RECTANGLE_SIZE,
} from './constants';
import {
  calculateImageSize,
  calculateStaggeredPosition,
} from './utils/nodeUtils';
import { logMapData, transformNodesToMapData } from './utils/mapDataTransform';
import { useDirectStateHistory } from './hooks/useDirectStateHistory';
import Toolbar from './Toolbar';
import Breadcrumb from './components/breadcrumb/Breadcrumb';
import ReactFlowCanvas from './ReactFlowCanvas';
import styles from './wmsMapModal.module.scss';

interface WmsMapModalProps {
  onClose: () => void;
  open: boolean;
}

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

// 內部組件 - 包含歷史管理邏輯，必須在 ReactFlowProvider 內部
const WmsMapContent: FC<{
  editMode: EditMode;
  drawingMode: DrawingMode;
  selectedColor: string;
  onEditModeChange: (mode: EditMode) => void;
  onToggleRectangleTool: () => void;
  onTogglePenTool: () => void;
  onColorChange: (color: string) => void;
}> = ({
  editMode,
  drawingMode,
  selectedColor,
  onEditModeChange,
  onToggleRectangleTool,
  onTogglePenTool,
  onColorChange,
}) => {
  const [nodes, setNodes, onNodesChangeOriginal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [lastCopiedNode, setLastCopiedNode] = useState<Node | null>(null);
  
  // Get React Flow instance for viewport information
  const { getViewport } = useReactFlow();
  
  // 用於延遲顏色變更歷史記錄的 ref
  const colorChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  

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
    debugMode: true 
  });

  // 調試：監聽歷史狀態變化
  useEffect(() => {
    const summary = getHistorySummary();
    console.log('📊 直接狀態歷史:', summary);
    
    if (summary.operations) {
      const recentOperations = summary.operations
        .slice(-5)
        .map((op) => `[${op.index}]${op.operation}${op.isCurrent ? ' (當前)' : ''}`)
        .join(' → ');
      
      if (recentOperations) {
        console.log('🔄 操作序列:', recentOperations);
      }
    }
  }, [getHistorySummary, nodes.length, edges.length]);

  // 初始化歷史記錄
  useEffect(() => {
    initializeHistory(nodes, edges);
  }, [initializeHistory]);

  // 用於追蹤拖拽操作的 ref
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const onNodesChange = useCallback((changes: any[]) => {
    // 調試日誌：記錄所有變更類型
    if (changes.length > 0) {
      console.log('🔄 onNodesChange 觸發:', changes.map(c => ({ type: c.type, id: c.id || c.item?.id })));
    }
    
    onNodesChangeOriginal(changes);
    
    // 檢查是否有拖動結束的操作
    const hasDragEnd = changes.some(change => 
      change.type === 'position' && change.dragging === false
    );
    
    // 檢查是否有資料變更（包含文字編輯）
    const hasDataChange = changes.some(change => 
      change.type === 'replace'
    );
    
    if (hasDragEnd) {
      // 拖動結束後記錄狀態
      setTimeout(() => {
        saveState(nodes, edges, 'move-shape');
      }, 10);
    } else if (hasDataChange) {
      // 資料變更（包含文字編輯）立即記錄歷史
      const changedNodeIds = changes
        .filter(c => c.type === 'replace')
        .map(c => c.id || c.item?.id)
        .filter(Boolean);
      
      console.log('📝 檢測到資料變更:', { changedNodes: changedNodeIds });
      
      // 立即記錄資料變更歷史（文字編輯會自動包含在 React Flow 節點資料中）
      setTimeout(() => {
        flushColorChangeHistory(); // 先清理顏色變更記錄
        saveState(nodes, edges, `data-change-${changedNodeIds.join(',')}`);
        console.log('💾 立即記錄資料變更歷史:', { 
          changedNodes: changedNodeIds,
          operation: `data-change-${changedNodeIds.join(',')}` 
        });
      }, 10);
    }
  }, [onNodesChangeOriginal, saveState, flushColorChangeHistory, nodes, edges]);

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

    // TODO: 之後這裡會呼叫 API 來儲存資料
    // await saveMapData(mapData);
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
              viewport.zoom
            );

            // 建立新的圖片節點
            const newNode = {
              id: `image-${Date.now()}-${index}`,
              type: 'imageNode',
              position,
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
  }, [editMode, setNodes, setEdges, saveState]);

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
    [setNodes, selectedColor, saveState, edges, flushColorChangeHistory],
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
    [setNodes, selectedColor, saveState, edges, flushColorChangeHistory],
  );

  // 復原/重做功能實作 - 直接設置狀態
  const handleUndo = useCallback(() => {
    console.log('🔧 執行 Undo - 按鈕點擊');
    const result = undo();
    if (result) {
      setNodes(result.nodes);
      setEdges(result.edges);
      console.log('🔧 Undo 成功:', { nodes: result.nodes.length, edges: result.edges.length });
    }
  }, [undo, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    console.log('🔧 執行 Redo - 按鈕點擊');
    const result = redo();
    if (result) {
      setNodes(result.nodes);
      setEdges(result.edges);
      console.log('🔧 Redo 成功:', { nodes: result.nodes.length, edges: result.edges.length });
    }
  }, [redo, setNodes, setEdges]);

  // 測試快照函數（用於調試）
  const handleTestSnapshot = useCallback(() => {
    console.log('🧪 手動測試快照');
    saveState(nodes, edges, 'manual-test');
    const summary = getHistorySummary();
    console.log('🧪 快照後狀態:', summary);
  }, [saveState, getHistorySummary, nodes, edges]);

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      setSelectedNodes(params.nodes);

      // 當用戶選擇不同節點時，重置 lastCopiedNode 以避免連續複製混亂
      if (params.nodes.length > 0) {
        setLastCopiedNode(null);
      }

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
  const handleTextEditComplete = useCallback((id: string, oldText: string, newText: string) => {
    console.log('📝 文字編輯完成，手動記錄歷史:', { id, oldText, newText });
    flushColorChangeHistory(); // 先清理顏色變更記錄
    saveState(nodes, edges, `text-edit-${id}`);
  }, [saveState, flushColorChangeHistory, nodes, edges]);

  // 處理 Command+D 快捷鍵複製並貼上功能
  const handleCopyPaste = useCallback(() => {
    // 決定要複製的節點：優先使用最後複製的節點，否則使用選中的節點
    let nodeToCopy: Node | null = null;

    if (lastCopiedNode) {
      // 如果有最後複製的節點，使用它
      nodeToCopy = lastCopiedNode;
    } else if (selectedNodes.length === 1) {
      // 否則使用選中的節點
      nodeToCopy = selectedNodes[0];
    }

    if (!nodeToCopy) return;

    // 只處理可複製的節點類型
    if (
      !['rectangleNode', 'pathNode', 'imageNode'].includes(
        nodeToCopy.type || '',
      )
    ) {
      return;
    }


    // 動態導入 nodeOperations 工具函數
    import('./utils/nodeOperations').then(
      ({ createRectangleCopy, createPathCopy, createImageCopy }) => {
        let newNode: Node;

        switch (nodeToCopy.type) {
          case 'rectangleNode':
            newNode = createRectangleCopy({
              currentNode: nodeToCopy,
              offsetPercentage: 0.25,
              nodeType: 'rectangleNode',
              data: nodeToCopy.data,
            });

            break;
          case 'pathNode':
            newNode = createPathCopy({
              currentNode: nodeToCopy,
              offsetPercentage: 0.25,
              nodeType: 'pathNode',
              data: nodeToCopy.data,
            });

            break;
          case 'imageNode':
            newNode = createImageCopy({
              currentNode: nodeToCopy,
              offsetPercentage: 0.25,
              nodeType: 'imageNode',
              data: nodeToCopy.data,
            });

            break;
          default:
            return;
        }

        setNodes((nds) => {
          // 計算下一個 zIndex
          const maxZIndex = Math.max(...nds.map((n) => n.zIndex || 0), 0);
          const nodeWithZIndex = { ...newNode, zIndex: maxZIndex + 1 };
          const newNodes = [...nds, nodeWithZIndex];

          // 操作完成後記錄狀態
          setTimeout(() => {
            saveState(newNodes, edges, 'copy-paste');
          }, 10);

          return newNodes;
        });

        // 更新最後複製的節點為新創建的節點，放在 setNodes 外面以確保狀態正確更新
        setLastCopiedNode(newNode);
      },
    );
  }, [selectedNodes, lastCopiedNode, setNodes, saveState, edges]);

  // 處理 Delete 鍵刪除選中節點功能
  const handleDeleteSelected = useCallback(() => {
    if (selectedNodes.length === 0) return;


    const selectedNodeIds = selectedNodes.map((node) => node.id);

    setNodes((nds) => {
      const newNodes = nds.filter((node) => !selectedNodeIds.includes(node.id));
      
      // 操作完成後記錄狀態
      setTimeout(() => {
        saveState(newNodes, edges, 'delete-selected');
      }, 10);
      
      return newNodes;
    });

    // 重置相關狀態
    setLastCopiedNode(null);
  }, [selectedNodes, setNodes, saveState, edges]);

  // 鍵盤事件監聽器
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Z (Windows/Linux) 或 Cmd+Z (Mac) - 撤消
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        const result = undo();
        if (result) {
          setNodes(result.nodes);
          setEdges(result.edges);
          console.log('⌨️ 鍵盤快捷鍵 Undo 執行成功');
        }
        return;
      }

      // Ctrl+Shift+Z (Windows/Linux) 或 Cmd+Shift+Z (Mac) - 重做
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) {
        event.preventDefault();
        const result = redo();
        if (result) {
          setNodes(result.nodes);
          setEdges(result.edges);
          console.log('⌨️ 鍵盤快捷鍵 Redo 執行成功');
        }
        return;
      }

      // Ctrl+Y (Windows/Linux 替代重做快捷鍵)
      if (event.ctrlKey && event.key === 'y' && !event.metaKey) {
        event.preventDefault();
        const result = redo();
        if (result) {
          setNodes(result.nodes);
          setEdges(result.edges);
          console.log('⌨️ 鍵盤快捷鍵 Redo (Ctrl+Y) 執行成功');
        }
        return;
      }

      // Command+D (Mac) 或 Ctrl+D (Windows/Linux) - 複製並貼上
      if ((event.metaKey || event.ctrlKey) && event.key === 'd') {
        event.preventDefault();
        handleCopyPaste();
        return;
      }

      // Delete 鍵 - 刪除選中節點
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        handleDeleteSelected();
        return;
      }
    };

    // 添加事件監聽器
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, setNodes, setEdges, handleCopyPaste, handleDeleteSelected]);

  // 清理顏色變更延遲記錄的 timeout
  useEffect(() => {
    return () => {
      if (colorChangeTimeoutRef.current) {
        clearTimeout(colorChangeTimeoutRef.current);
      }
    };
  }, []);

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
      />
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
      />

      <ReactFlowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        editMode={editMode}
        drawingMode={drawingMode}
        selectedColor={selectedColor}
        onCreateRectangle={handleCreateRectangle}
        onCreatePath={handleCreatePath}
        onSelectionChange={handleSelectionChange}
        onTextEditComplete={handleTextEditComplete}
      />
    </>
  );
};

const WmsMapModal: FC<WmsMapModalProps> = ({ onClose, open }) => {
  const [editMode, setEditMode] = useState<EditMode>(EditMode.BACKGROUND);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(DrawingMode.NONE);
  const [selectedColor, setSelectedColor] = useState<string>(
    DEFAULT_RECTANGLE_COLOR,
  );

  const handleEditModeChange = useCallback(
    (mode: EditMode) => {
      setEditMode(mode);
      setDrawingMode(DrawingMode.NONE); // 切換編輯模式時重設繪圖模式
    },
    [],
  );

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

  const handleColorChange = useCallback(
    (color: string) => {
      setSelectedColor(color);
    },
    [],
  );

  return (
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
            onEditModeChange={handleEditModeChange}
            onToggleRectangleTool={handleToggleRectangleTool}
            onTogglePenTool={handleTogglePenTool}
            onColorChange={handleColorChange}
          />
        </ReactFlowProvider>
      </div>
    </Modal>
  );
};

export default WmsMapModal;