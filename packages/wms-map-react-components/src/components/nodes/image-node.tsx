import React, { FC, useState, useCallback, useEffect } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals, useReactFlow } from '@xyflow/react';
import { EditMode, ViewMode } from '../../typings';
import { DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT, ACTIVE_OPACITY, INACTIVE_OPACITY } from '../../constants';
import { useContextMenu } from '../../hooks/use-context-menu';
import { createImageCopy } from '../../utils/node-operations';
import ContextMenu from '../ui/context-menu';
import styles from './image-node.module.scss';

interface ImageNodeData {
  imageUrl: string;
  width?: number;
  height?: number;
  fileName?: string;
  originalWidth?: number;
  originalHeight?: number;
}

interface ImageNodeProps extends NodeProps {
  editMode: EditMode;
  viewMode: ViewMode;
  onResizeComplete?: (
    id: string,
    oldSize: { width: number; height: number },
    newSize: { width: number; height: number },
  ) => void;
  showBackground?: boolean;
}

const ImageNode: FC<ImageNodeProps> = ({ data, selected, id, editMode, viewMode, showBackground = true }) => {
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const {
    imageUrl,
    width = DEFAULT_IMAGE_WIDTH,
    height = DEFAULT_IMAGE_HEIGHT,
    fileName,
    originalWidth = width,
    originalHeight = height,
  } = data as unknown as ImageNodeData;

  const [currentSize, setCurrentSize] = useState({ width, height });
  const [isResizing, setIsResizing] = useState(false);

  // Sync currentSize with node data when it changes
  useEffect(() => {
    setCurrentSize({ width, height });
  }, [width, height]);

  // Calculate aspect ratio
  const aspectRatio = originalWidth / originalHeight;
  // Check if this node should be editable based on edit mode and view mode
  const isEditable = viewMode === ViewMode.EDIT && editMode === EditMode.BACKGROUND;

  // Check if this node should be selectable (only in BACKGROUND mode or VIEW mode)
  const isSelectable = editMode === EditMode.BACKGROUND || viewMode === ViewMode.VIEW;

  const opacity = editMode === EditMode.BACKGROUND ? ACTIVE_OPACITY : INACTIVE_OPACITY;

  // Context menu functionality
  const {
    contextMenu,
    handleContextMenu,
    handleCloseContextMenu,
    handleDelete,
    arrangeActions,
    arrangeStates,
    getNodes,
    setNodes: setNodesFromHook,
  } = useContextMenu({ id, editMode, isEditable, nodeType: 'imageNode' });

  const updateNodeData = useCallback(
    (updates: Partial<ImageNodeData>) => {
      setNodes(nodes => nodes.map(node => (node.id === id ? { ...node, data: { ...node.data, ...updates } } : node)));

      updateNodeInternals(id);
    },
    [id, setNodes, updateNodeInternals],
  );

  const handleResize = useCallback(
    (event: any, params: any) => {
      const newWidth = params.width;
      const newHeight = newWidth / aspectRatio;

      // 在 resize 過程中更新本地狀態和節點資料以提供正確的視覺回饋
      const newSize = { width: newWidth, height: newHeight };

      setCurrentSize(newSize);

      // 標記正在調整大小，避免在 WmsMapModal 中記錄歷史
      if (!isResizing) {
        setIsResizing(true);
      }

      // 即時更新節點以提供視覺回饋
      setNodes(nodes =>
        nodes.map(node =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  width: newWidth,
                  height: newHeight,
                  isResizing: true,
                },
                position: { x: params.x, y: params.y },
              }
            : node,
        ),
      );
    },
    [aspectRatio, id, setNodes, isResizing],
  );

  const handleResizeStart = useCallback((event: any, params: any) => {
    // 開始調整大小時可以執行額外的邏輯，例如禁用拖拽
    // 這裡保持空白，但提供了擴展點
  }, []);

  const handleResizeEnd = useCallback(
    (event: any, params: any) => {
      const newWidth = params.width;
      const newHeight = newWidth / aspectRatio;

      // 清除調整大小標記
      setIsResizing(false);

      // 最終更新節點資料，移除 isResizing 標記
      // 這次更新會觸發歷史記錄（因為沒有 isResizing 標記）
      setNodes(nodes =>
        nodes.map(node =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  width: newWidth,
                  height: newHeight,
                  isResizing: undefined,
                },
                position: { x: params.x, y: params.y },
              }
            : node,
        ),
      );

      // 確保內部狀態同步
      updateNodeInternals(id);
    },
    [aspectRatio, id, setNodes, updateNodeInternals],
  );

  // Handle copy and paste
  const handleCopyPaste = useCallback(() => {
    const currentNode = getNodes().find(node => node.id === id);

    if (!currentNode) {
      console.error('Current node not found');

      return;
    }

    setNodesFromHook(nds => {
      // Calculate next zIndex
      const maxZIndex = Math.max(...nds.map(n => n.zIndex || 0), 0);

      const copiedNode = createImageCopy({
        currentNode,
        nodeType: 'imageNode',
        data: {
          imageUrl,
          width: currentSize.width,
          height: currentSize.height,
          fileName,
          originalWidth,
          originalHeight,
        },
      });

      const nodeWithZIndex = { ...copiedNode, zIndex: maxZIndex + 1 };

      return [...nds, nodeWithZIndex];
    });

    handleCloseContextMenu();
  }, [
    id,
    imageUrl,
    currentSize,
    fileName,
    originalWidth,
    originalHeight,
    getNodes,
    setNodesFromHook,
    handleCloseContextMenu,
  ]);

  // 計算節點的顯示狀態 - 在檢視模式下受 showBackground 控制
  const isVisible = viewMode === ViewMode.EDIT || showBackground;

  // console.log('🖼️ ImageNode 顯示計算:', {
  //   id: id.slice(-4),
  //   viewMode,
  //   showBackground,
  //   isVisible
  // });

  return (
    <div
      className={`${styles.imageNode} ${selected ? styles.selected : ''} ${!isSelectable ? styles.nonSelectable : ''}`}
      style={{
        opacity: isVisible ? opacity : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
      }}
    >
      {selected && isEditable && (
        <NodeResizer
          minWidth={50}
          minHeight={50 / aspectRatio}
          keepAspectRatio={true}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
          isVisible={selected && isEditable}
          color="#5570d3"
          handleClassName={styles.customResizeHandle}
        />
      )}
      <div className={styles.imageContainer} onContextMenu={viewMode === ViewMode.EDIT ? handleContextMenu : undefined}>
        <img
          src={imageUrl}
          alt={fileName || 'Uploaded image'}
          className={styles.image}
          style={{
            width: `${currentSize.width}px`,
            height: `${currentSize.height}px`,
            maxWidth: '100%',
            maxHeight: '100%',
            opacity: opacity,
          }}
          draggable={false}
        />
        {fileName && <div className={styles.imageLabel}>{fileName}</div>}
      </div>

      {/* Context Menu - Only show in edit mode */}
      {viewMode === ViewMode.EDIT && (
        <ContextMenu
          visible={contextMenu.visible}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onCopyPaste={handleCopyPaste}
          onDelete={handleDelete}
          arrangeActions={arrangeActions}
          arrangeStates={arrangeStates}
        />
      )}
    </div>
  );
};

export default React.memo(ImageNode);
