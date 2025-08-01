import React, { FC, useCallback, useState } from 'react';
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

const WmsMapModal: FC<WmsMapModalProps> = ({ onClose, open }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [editMode, setEditMode] = useState<EditMode>(EditMode.BACKGROUND);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(DrawingMode.NONE);
  const [selectedColor, setSelectedColor] = useState<string>(
    DEFAULT_RECTANGLE_COLOR,
  );

  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);

  const handleEditModeChange = useCallback(
    (mode: EditMode) => {
      setEditMode(mode);
      setDrawingMode(DrawingMode.NONE); // 切換編輯模式時重設繪圖模式

      // 切換模式時取消選擇所有節點
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          selected: false,
        })),
      );
    },
    [setNodes],
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

            // 使用工具函數計算錯開位置
            const position = calculateStaggeredPosition(index);

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

                return [...nds, nodeWithZIndex];
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
      setNodes((nds) => nds.filter((node) => node.type !== 'imageNode'));
    } else if (editMode === EditMode.LAYER) {
      // 刪除所有圖層節點（矩形和路徑）
      setNodes((nds) =>
        nds.filter(
          (node) => node.type !== 'rectangleNode' && node.type !== 'pathNode',
        ),
      );

      // 刪除圖層元素時也清除邊線
      setEdges([]);
    }
  }, [editMode, setNodes, setEdges]);

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

  const handleCreateRectangle = useCallback(
    (startX: number, startY: number, endX: number, endY: number) => {
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);

      if (width < MIN_RECTANGLE_SIZE || height < MIN_RECTANGLE_SIZE) return; // 最小尺寸檢查

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

        return [...nds, newRectangle];
      });
      // 保持繪圖模式以進行連續繪圖
    },
    [setNodes, selectedColor],
  );

  const handleCreatePath = useCallback(
    (points: { x: number; y: number }[]) => {
      if (points.length < 2) return; // 路徑至少需要 2 個點

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

        return [...nds, newPath];
      });
      // 保持繪圖模式以進行連續繪圖
    },
    [setNodes, selectedColor],
  );

  // 預留位置的復原/重做功能 - 可以在後續使用適當的狀態管理實作
  const handleUndo = useCallback(() => {
    console.log('Undo action');
    // TODO: 實作復原功能
  }, []);

  const handleRedo = useCallback(() => {
    console.log('Redo action');
    // TODO: 實作重做功能
  }, []);

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
          setSelectedColor(nodeColor);
        }
      }
    },
    [],
  );

  const handleColorChange = useCallback(
    (color: string) => {
      setSelectedColor(color);

      // 更新選中可著色節點（矩形和路徑）的顏色
      const selectedColorableNodes = selectedNodes.filter(
        (node) => node.type === 'rectangleNode' || node.type === 'pathNode',
      );

      if (selectedColorableNodes.length > 0) {
        setNodes((nds) =>
          nds.map((node) => {
            if (
              selectedColorableNodes.some((selected) => selected.id === node.id)
            ) {
              return { ...node, data: { ...node.data, color } };
            }

            return node;
          }),
        );
      }
    },
    [selectedNodes, setNodes],
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
            onEditModeChange={handleEditModeChange}
            onToggleRectangleTool={handleToggleRectangleTool}
            onTogglePenTool={handleTogglePenTool}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={false}
            canRedo={false}
            onColorChange={handleColorChange}
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
            onCreateRectangle={handleCreateRectangle}
            onCreatePath={handleCreatePath}
            onSelectionChange={handleSelectionChange}
          />
        </ReactFlowProvider>
      </div>
    </Modal>
  );
};

export default WmsMapModal;
