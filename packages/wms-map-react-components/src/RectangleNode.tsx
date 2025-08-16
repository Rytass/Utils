import React, { FC, useCallback, useEffect, useState } from 'react';
import { NodeProps, NodeResizer, useReactFlow, useUpdateNodeInternals } from '@xyflow/react';
import { EditMode, ViewMode } from '../typings';
import {
  ACTIVE_OPACITY,
  DEFAULT_RECTANGLE_COLOR,
  DEFAULT_RECTANGLE_HEIGHT,
  DEFAULT_RECTANGLE_LABEL,
  DEFAULT_RECTANGLE_WIDTH,
  MIN_RESIZE_HEIGHT,
  MIN_RESIZE_WIDTH,
  RECTANGLE_INACTIVE_OPACITY,
} from './constants';
import { useContextMenu } from './hooks/useContextMenu';
import { useTextEditing } from './hooks/useTextEditing';
import { createRectangleCopy } from './utils/nodeOperations';
import { createHoverColor } from './utils/colorUtils';
import ContextMenu from './ContextMenu';
import styles from './rectangleNode.module.scss';

interface RectangleNodeData {
  width?: number;
  height?: number;
  color?: string;
  label?: string;
}

interface RectangleNodeProps extends NodeProps {
  editMode: EditMode;
  viewMode: ViewMode;
  onTextEditComplete?: (id: string, oldText: string, newText: string) => void;
  isHovered?: boolean;
}

const RectangleNode: FC<RectangleNodeProps> = ({
  data,
  selected,
  id,
  editMode,
  viewMode,
  onTextEditComplete,
  isHovered = false,
}) => {
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const {
    width = DEFAULT_RECTANGLE_WIDTH,
    height = DEFAULT_RECTANGLE_HEIGHT,
    color = DEFAULT_RECTANGLE_COLOR,
    label = DEFAULT_RECTANGLE_LABEL,
  } = data as unknown as RectangleNodeData;

  const [currentSize, setCurrentSize] = useState({ width, height });
  const [isResizing, setIsResizing] = useState(false);

  // Sync state with node data changes
  useEffect(() => {
    setCurrentSize({ width, height });
  }, [width, height]);

  // Only editable in LAYER mode
  const isEditable = viewMode === ViewMode.EDIT && editMode === EditMode.LAYER;
  // Check if this node should be selectable (only in LAYER mode)
  const isSelectable = editMode === EditMode.LAYER;
  const opacity =
    editMode === EditMode.LAYER ? ACTIVE_OPACITY : RECTANGLE_INACTIVE_OPACITY;

  // Update node data function (similar to ImageNode implementation)
  const updateNodeData = useCallback(
    (updates: Partial<RectangleNodeData>) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, ...updates } }
            : node,
        ),
      );

      updateNodeInternals(id);
    },
    [id, setNodes, updateNodeInternals],
  );

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
  } = useContextMenu({ id, editMode, isEditable, nodeType: 'rectangleNode' });

  // Text editing functionality
  const {
    isEditing,
    editingText,
    inputRef,
    setEditingText,
    handleDoubleClick,
    handleKeyDown,
    handleBlur,
  } = useTextEditing({ id, label, editMode, isEditable, onTextEditComplete });

  // Handle resize start
  const handleResizeStart = useCallback((event: any, params: any) => {
    // 開始調整大小時可以執行額外的邏輯，例如禁用拖拽
    // 這裡保持空白，但提供了擴展點
  }, []);

  // Handle resize with size sync and position update (diagonal anchor)
  const handleResize = useCallback(
    (event: any, params: any) => {
      const newSize = { width: params.width, height: params.height };

      setCurrentSize(newSize);

      // 標記正在調整大小，避免在 WmsMapModal 中記錄歷史
      if (!isResizing) {
        setIsResizing(true);
      }

      // 即時更新節點以提供視覺回饋，同時更新位置以保持對角錨點
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: { ...node.data, width: params.width, height: params.height, isResizing: true },
                position: { x: params.x, y: params.y },
              }
            : node,
        ),
      );
    },
    [id, setNodes, isResizing],
  );

  // Handle resize end to ensure final state is saved
  const handleResizeEnd = useCallback(
    (event: any, params: any) => {
      const newSize = { width: params.width, height: params.height };

      setCurrentSize(newSize);

      // 清除調整大小標記
      setIsResizing(false);

      // 最終更新節點資料，移除 isResizing 標記，同時更新位置
      // 這次更新會觸發歷史記錄（因為沒有 isResizing 標記）
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: { ...node.data, width: params.width, height: params.height, isResizing: undefined },
                position: { x: params.x, y: params.y },
              }
            : node,
        ),
      );

      // 確保內部狀態同步
      updateNodeInternals(id);
    },
    [id, setNodes, updateNodeInternals],
  );

  // Handle copy and paste
  const handleCopyPaste = useCallback(() => {
    const currentNode = getNodes().find((node) => node.id === id);

    if (!currentNode) {
      console.error('Current node not found');

      return;
    }

    setNodesFromHook((nds) => {
      // Calculate next zIndex
      const maxZIndex = Math.max(...nds.map((n) => n.zIndex || 0), 0);

      const copiedNode = createRectangleCopy({
        currentNode,
        nodeType: 'rectangleNode',
        data: {
          width: currentSize.width,
          height: currentSize.height,
          color,
          label,
        },
      });

      const nodeWithZIndex = { ...copiedNode, zIndex: maxZIndex + 1 };

      return [...nds, nodeWithZIndex];
    });

    handleCloseContextMenu();
  }, [
    id,
    currentSize,
    color,
    label,
    getNodes,
    setNodesFromHook,
    handleCloseContextMenu,
  ]);

  // 在檢視模式下計算 hover 顏色
  const displayColor = viewMode === ViewMode.VIEW && isHovered ? createHoverColor(color) : color;

  return (
    <div
      className={`${styles.rectangleNode} ${selected && isEditable ? styles.selected : ''} ${!isSelectable ? styles.nonSelectable : ''}`}
    >
      {selected && isEditable && (
        <NodeResizer
          minWidth={MIN_RESIZE_WIDTH}
          minHeight={MIN_RESIZE_HEIGHT}
          keepAspectRatio={false}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
          isVisible={selected && isEditable}
          color="#5570d3"
          handleClassName={styles.customResizeHandle}
        />
      )}

      <div
        className={styles.rectangleContainer}
        style={{
          width: `${currentSize.width}px`,
          height: `${currentSize.height}px`,
          backgroundColor: `${displayColor}33`, // 20% opacity (33 in hex = 20% * 255)
          opacity: opacity,
          border: selected && isEditable
            ? '2px solid #3b82f6'
            : `2px solid ${displayColor}`, // 100% opacity border
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold',
          textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
          position: 'relative',
          cursor: viewMode === ViewMode.VIEW ? 'pointer' : 'default',
          transition: viewMode === ViewMode.VIEW ? 'all 0.2s ease' : 'none',
        }}
        onDoubleClick={viewMode === ViewMode.EDIT ? handleDoubleClick : undefined}
        onContextMenu={viewMode === ViewMode.EDIT ? handleContextMenu : undefined}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
              textAlign: 'center',
              width: '90%',
              textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span style={{ cursor: 'default' }}>
            {label}
          </span>
        )}
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

export default RectangleNode;
