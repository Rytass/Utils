import React, { FC, useState, useCallback, useRef, useEffect } from 'react';
import { NodeProps, NodeResizeControl, useReactFlow, useUpdateNodeInternals } from '@xyflow/react';
import { EditMode } from '../typings';
import { DEFAULT_RECTANGLE_WIDTH, DEFAULT_RECTANGLE_HEIGHT, DEFAULT_RECTANGLE_COLOR, DEFAULT_RECTANGLE_LABEL, ACTIVE_OPACITY, RECTANGLE_INACTIVE_OPACITY, RESIZE_CONTROL_SIZE, MIN_RESIZE_WIDTH, MIN_RESIZE_HEIGHT } from './constants';
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
  const { setNodes, getNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    width = DEFAULT_RECTANGLE_WIDTH,
    height = DEFAULT_RECTANGLE_HEIGHT,
    color = DEFAULT_RECTANGLE_COLOR,
    label = DEFAULT_RECTANGLE_LABEL,
  } = data as unknown as RectangleNodeData;

  const [currentSize, setCurrentSize] = useState({ width, height });
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState(label);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });

  // Sync state with node data changes
  useEffect(() => {
    setCurrentSize({ width, height });
    if (!isEditing) {
      setEditingText(label);
    }
  }, [width, height, label, isEditing]);

  // Only editable in LAYER mode
  const isEditable = editMode === EditMode.LAYER;
  const opacity = editMode === EditMode.LAYER ? ACTIVE_OPACITY : RECTANGLE_INACTIVE_OPACITY;

  const updateNodeData = useCallback((updates: Partial<RectangleNodeData>) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
    updateNodeInternals(id);
  }, [id, setNodes, updateNodeInternals]);

  const handleResize = useCallback((event: any, params: any) => {
    const newSize = { width: params.width, height: params.height };
    setCurrentSize(newSize);
    updateNodeData({ width: params.width, height: params.height });
  }, [updateNodeData]);

  // Handle double click to start editing
  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (isEditable) {
      setIsEditing(true);
      setEditingText(label);
    }
  }, [isEditable, label]);

  // Handle saving the edited text
  const handleSaveText = useCallback(() => {
    setIsEditing(false);
    updateNodeData({ label: editingText });
  }, [editingText, updateNodeData]);

  // Handle input key events
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSaveText();
    } else if (event.key === 'Escape') {
      setIsEditing(false);
      setEditingText(label);
    }
  }, [handleSaveText, label]);

  // Handle right click for context menu
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    if (!isEditable) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
    });
  }, [isEditable]);

  // Handle context menu actions
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  const handleCopyPaste = useCallback(() => {
    console.log('Copying and pasting rectangle');
    
    // Get current node to access its position
    const currentNode = getNodes().find(node => node.id === id);
    if (!currentNode) {
      console.error('Current node not found');
      return;
    }
    
    // Calculate new position (offset by 25% of current size to bottom-right)
    const offsetX = currentSize.width * 0.25;
    const offsetY = currentSize.height * 0.25;
    
    // Create a copy of the current node with new ID and position
    const copiedNode = {
      id: `rectangle-${Date.now()}`,
      type: 'rectangleNode',
      position: {
        x: currentNode.position.x + offsetX,
        y: currentNode.position.y + offsetY,
      },
      data: {
        width: currentSize.width,
        height: currentSize.height,
        color,
        label,
      },
    };
    
    console.log('Creating copied node:', copiedNode);
    
    // Add the copied node to the canvas
    setNodes((nds) => [...nds, copiedNode]);
    handleCloseContextMenu();
  }, [id, currentSize, color, label, getNodes, setNodes, handleCloseContextMenu]);

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
    handleCloseContextMenu();
  }, [id, setNodes, handleCloseContextMenu]);

  const handleArrange = useCallback(() => {
    // TODO: Implement arrange functionality
    console.log('Arrange not implemented yet');
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle clicking outside to save
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditing && inputRef.current && !inputRef.current.contains(event.target as Node)) {
        handleSaveText();
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isEditing, handleSaveText]);

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