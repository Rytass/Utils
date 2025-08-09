import React, { FC, useCallback, useEffect, useState } from 'react';
import { NodeProps, NodeResizeControl } from '@xyflow/react';
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
  RESIZE_CONTROL_SIZE,
} from './constants';
import { useContextMenu } from './hooks/useContextMenu';
import { useTextEditing } from './hooks/useTextEditing';
import { createRectangleCopy } from './utils/nodeOperations';
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
}

const RectangleNode: FC<RectangleNodeProps> = ({
  data,
  selected,
  id,
  editMode,
  viewMode,
  onTextEditComplete,
}) => {
  const {
    width = DEFAULT_RECTANGLE_WIDTH,
    height = DEFAULT_RECTANGLE_HEIGHT,
    color = DEFAULT_RECTANGLE_COLOR,
    label = DEFAULT_RECTANGLE_LABEL,
  } = data as unknown as RectangleNodeData;

  const [currentSize, setCurrentSize] = useState({ width, height });

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

  // Context menu functionality
  const {
    contextMenu,
    handleContextMenu,
    handleCloseContextMenu,
    handleDelete,
    arrangeActions,
    arrangeStates,
    getNodes,
    setNodes,
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
    updateNodeData,
  } = useTextEditing({ id, label, editMode, isEditable, onTextEditComplete });

  // Handle resize with size sync
  const handleResize = useCallback(
    (event: any, params: any) => {
      const newSize = { width: params.width, height: params.height };

      setCurrentSize(newSize);
      updateNodeData({ width: params.width, height: params.height });
    },
    [updateNodeData],
  );

  // Handle copy and paste
  const handleCopyPaste = useCallback(() => {
    const currentNode = getNodes().find((node) => node.id === id);

    if (!currentNode) {
      console.error('Current node not found');

      return;
    }

    setNodes((nds) => {
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
    setNodes,
    handleCloseContextMenu,
  ]);

  return (
    <div
      className={`${styles.rectangleNode} ${selected ? styles.selected : ''} ${!isSelectable ? styles.nonSelectable : ''}`}
    >
      {selected && isEditable && (
        <>
          <NodeResizeControl
            style={{
              background: 'white',
              border: `2px solid ${DEFAULT_RECTANGLE_COLOR}`,
              width: RESIZE_CONTROL_SIZE,
              height: RESIZE_CONTROL_SIZE,
              borderRadius: 2,
            }}
            minWidth={MIN_RESIZE_WIDTH}
            minHeight={MIN_RESIZE_HEIGHT}
            onResize={handleResize}
            position="top-left"
          />
          <NodeResizeControl
            style={{
              background: 'white',
              border: `2px solid ${DEFAULT_RECTANGLE_COLOR}`,
              width: RESIZE_CONTROL_SIZE,
              height: RESIZE_CONTROL_SIZE,
              borderRadius: 2,
            }}
            minWidth={MIN_RESIZE_WIDTH}
            minHeight={MIN_RESIZE_HEIGHT}
            onResize={handleResize}
            position="top-right"
          />
          <NodeResizeControl
            style={{
              background: 'white',
              border: `2px solid ${DEFAULT_RECTANGLE_COLOR}`,
              width: RESIZE_CONTROL_SIZE,
              height: RESIZE_CONTROL_SIZE,
              borderRadius: 2,
            }}
            minWidth={MIN_RESIZE_WIDTH}
            minHeight={MIN_RESIZE_HEIGHT}
            onResize={handleResize}
            position="bottom-left"
          />
          <NodeResizeControl
            style={{
              background: 'white',
              border: `2px solid ${DEFAULT_RECTANGLE_COLOR}`,
              width: RESIZE_CONTROL_SIZE,
              height: RESIZE_CONTROL_SIZE,
              borderRadius: 2,
            }}
            minWidth={MIN_RESIZE_WIDTH}
            minHeight={MIN_RESIZE_HEIGHT}
            onResize={handleResize}
            position="bottom-right"
          />
        </>
      )}

      <div
        className={styles.rectangleContainer}
        style={{
          width: `${currentSize.width}px`,
          height: `${currentSize.height}px`,
          backgroundColor: `${color}33`, // 20% opacity (33 in hex = 20% * 255)
          opacity: opacity,
          border: selected && isEditable
            ? '2px solid #3b82f6'
            : `2px solid ${color}`, // 100% opacity border
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold',
          textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
          position: 'relative',
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
