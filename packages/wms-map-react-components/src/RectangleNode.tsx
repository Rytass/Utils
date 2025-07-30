import React, { FC, useState, useCallback, useEffect } from 'react';
import { NodeProps, NodeResizeControl } from '@xyflow/react';
import { EditMode } from '../typings';
import { DEFAULT_RECTANGLE_WIDTH, DEFAULT_RECTANGLE_HEIGHT, DEFAULT_RECTANGLE_COLOR, DEFAULT_RECTANGLE_LABEL, ACTIVE_OPACITY, RECTANGLE_INACTIVE_OPACITY, RESIZE_CONTROL_SIZE, MIN_RESIZE_WIDTH, MIN_RESIZE_HEIGHT } from './constants';
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
}

const RectangleNode: FC<RectangleNodeProps> = ({ data, selected, id, editMode }) => {
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
  const isEditable = editMode === EditMode.LAYER;
  const opacity = editMode === EditMode.LAYER ? ACTIVE_OPACITY : RECTANGLE_INACTIVE_OPACITY;

  // Context menu functionality
  const {
    contextMenu,
    handleContextMenu,
    handleCloseContextMenu,
    handleDelete,
    handleArrange,
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
    updateNodeData,
  } = useTextEditing({ id, label, editMode, isEditable });

  // Handle resize with size sync
  const handleResize = useCallback((event: any, params: any) => {
    const newSize = { width: params.width, height: params.height };
    setCurrentSize(newSize);
    updateNodeData({ width: params.width, height: params.height });
  }, [updateNodeData]);

  // Handle copy and paste
  const handleCopyPaste = useCallback(() => {
    const currentNode = getNodes().find(node => node.id === id);
    if (!currentNode) {
      console.error('Current node not found');
      return;
    }
    
    const copiedNode = createRectangleCopy({
      currentNode,
      nodeType: 'rectangleNode',
      data: { width: currentSize.width, height: currentSize.height, color, label },
    });
    
    setNodes((nds) => [...nds, copiedNode]);
    handleCloseContextMenu();
  }, [id, currentSize, color, label, getNodes, setNodes, handleCloseContextMenu]);

  return (
    <div className={`${styles.rectangleNode} ${selected ? styles.selected : ''}`}>
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
          backgroundColor: color,
          opacity: opacity,
          border: selected && isEditable ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.2)',
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
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={handleKeyDown}
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
          <span style={{ cursor: isEditable ? 'text' : 'default' }}>
            {label}
          </span>
        )}
      </div>
      
      {/* Context Menu */}
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={handleCloseContextMenu}
        onCopyPaste={handleCopyPaste}
        onDelete={handleDelete}
        onArrange={handleArrange}
      />
    </div>
  );
};

export default RectangleNode;