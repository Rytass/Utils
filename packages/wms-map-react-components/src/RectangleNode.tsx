import React, { FC, useState, useCallback, useRef, useEffect } from 'react';
import { NodeProps, NodeResizeControl, useReactFlow } from '@xyflow/react';
import { EditMode } from '../typings';
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
  const { setNodes } = useReactFlow();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    width = 150,
    height = 100,
    color = '#3b82f6',
    label = '矩形區域',
  } = data as unknown as RectangleNodeData;

  const [currentSize, setCurrentSize] = useState({ width, height });
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState(label);

  // Sync state with node data changes
  useEffect(() => {
    setCurrentSize({ width, height });
    if (!isEditing) {
      setEditingText(label);
    }
  }, [width, height, label, isEditing]);

  // Only editable in LAYER mode
  const isEditable = editMode === EditMode.LAYER;
  const opacity = editMode === EditMode.LAYER ? 1 : 0.6;

  const handleResize = useCallback((event: any, params: any) => {
    const newSize = { width: params.width, height: params.height };
    setCurrentSize(newSize);
    
    // Update the node data to persist the changes
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                width: params.width,
                height: params.height,
              },
            }
          : node
      )
    );
  }, [id, setNodes]);

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
    
    // Update the node data with new label
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                label: editingText,
              },
            }
          : node
      )
    );
  }, [id, editingText, setNodes]);

  // Handle input key events
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSaveText();
    } else if (event.key === 'Escape') {
      setIsEditing(false);
      setEditingText(label);
    }
  }, [handleSaveText, label]);

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
              border: '2px solid #3b82f6',
              width: 16,
              height: 16,
              borderRadius: 2,
            }}
            minWidth={50}
            minHeight={30}
            onResize={handleResize}
            position="top-left"
          />
          <NodeResizeControl
            style={{
              background: 'white',
              border: '2px solid #3b82f6',
              width: 16,
              height: 16,
              borderRadius: 2,
            }}
            minWidth={50}
            minHeight={30}
            onResize={handleResize}
            position="top-right"
          />
          <NodeResizeControl
            style={{
              background: 'white',
              border: '2px solid #3b82f6',
              width: 16,
              height: 16,
              borderRadius: 2,
            }}
            minWidth={50}
            minHeight={30}
            onResize={handleResize}
            position="bottom-left"
          />
          <NodeResizeControl
            style={{
              background: 'white',
              border: '2px solid #3b82f6',
              width: 16,
              height: 16,
              borderRadius: 2,
            }}
            minWidth={50}
            minHeight={30}
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
    </div>
  );
};

export default RectangleNode;