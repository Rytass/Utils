import React, { FC, useState, useCallback, useEffect, useRef } from 'react';
import { NodeProps, useReactFlow, useUpdateNodeInternals } from '@xyflow/react';
import { EditMode } from '../typings';
import { DEFAULT_RECTANGLE_COLOR, DEFAULT_PATH_LABEL, ACTIVE_OPACITY, RECTANGLE_INACTIVE_OPACITY } from './constants';
import styles from './pathNode.module.scss';

interface PathNodeData {
  points: { x: number; y: number }[];
  color?: string;
  strokeWidth?: number;
  label?: string;
}

interface PathNodeProps extends NodeProps {
  editMode: EditMode;
}

const PathNode: FC<PathNodeProps> = ({ data, selected, id, editMode }) => {
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    points = [],
    color = DEFAULT_RECTANGLE_COLOR,
    strokeWidth = 2,
    label = DEFAULT_PATH_LABEL,
  } = data as unknown as PathNodeData;

  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState(label);

  // Sync state with node data changes
  useEffect(() => {
    if (!isEditing) {
      setEditingText(label);
    }
  }, [label, isEditing]);

  // Only editable in LAYER mode
  const isEditable = editMode === EditMode.LAYER;
  const opacity = editMode === EditMode.LAYER ? ACTIVE_OPACITY : RECTANGLE_INACTIVE_OPACITY;

  const updateNodeData = useCallback((updates: Partial<PathNodeData>) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
    updateNodeInternals(id);
  }, [id, setNodes, updateNodeInternals]);

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

  // Calculate path dimensions
  const getBounds = useCallback(() => {
    if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }, [points]);

  const bounds = getBounds();
  const width = Math.max(bounds.maxX - bounds.minX, 10);
  const height = Math.max(bounds.maxY - bounds.minY, 10);

  // Check if path is closed
  const isClosedPath = points.length > 2 && 
    points[0].x === points[points.length - 1].x && 
    points[0].y === points[points.length - 1].y;

  // Create SVG path string
  const pathString = points.length > 0 
    ? (() => {
        const pathPoints = points.map(p => `${p.x - bounds.minX} ${p.y - bounds.minY}`);
        
        if (isClosedPath) {
          // For closed paths, remove the last point (duplicate of first) and add Z to close
          return `M ${pathPoints.slice(0, -1).join(' L ')} Z`;
        } else {
          // For open paths, just connect all points
          return `M ${pathPoints.join(' L ')}`;
        }
      })()
    : '';

  // Calculate center position for text
  const centerX = width / 2;
  const centerY = height / 2;

  return (
    <div className={`${styles.pathNode} ${selected ? styles.selected : ''}`}>
      <div 
        className={styles.pathContainer}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          opacity: opacity,
          border: selected && isEditable ? '2px solid #3b82f6' : 'none',
          borderRadius: '4px',
          position: 'relative',
        }}
        onDoubleClick={handleDoubleClick}
      >
        <svg
          width={width}
          height={height}
          style={{ overflow: 'visible' }}
        >
          <path
            d={pathString}
            stroke={color}
            strokeWidth={strokeWidth}
            fill={isClosedPath ? color : "none"}
            fillOpacity={isClosedPath ? 0.1 : 0}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        
        {/* Text overlay */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            pointerEvents: isEditing ? 'auto' : 'none',
            width: '90%',
            textAlign: 'center',
          }}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid white',
                borderRadius: '4px',
                outline: 'none',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                textAlign: 'center',
                width: '100%',
                padding: '2px 4px',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span 
              style={{ 
                cursor: isEditable ? 'text' : 'default',
                background: isClosedPath ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.6)',
                padding: '2px 6px',
                borderRadius: '4px',
                backdropFilter: 'blur(2px)',
              }}
            >
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PathNode;