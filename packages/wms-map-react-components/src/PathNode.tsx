import React, { FC, useCallback } from 'react';
import { NodeProps } from '@xyflow/react';
import { EditMode } from '../typings';
import { DEFAULT_RECTANGLE_COLOR, DEFAULT_PATH_LABEL, ACTIVE_OPACITY, RECTANGLE_INACTIVE_OPACITY } from './constants';
import { useContextMenu } from './hooks/useContextMenu';
import { useTextEditing } from './hooks/useTextEditing';
import { createPathCopy } from './utils/nodeOperations';
import ContextMenu from './ContextMenu';
import styles from './pathNode.module.scss';

interface PathNodeData {
  points: { x: number; y: number }[];
  color?: string;
  strokeWidth?: number;
  label?: string;
}

interface PathNodeProps extends NodeProps {
  editMode: EditMode;
  onTextEditComplete?: (id: string, oldText: string, newText: string) => void;
}

const PathNode: FC<PathNodeProps> = ({ data, selected, id, editMode, onTextEditComplete }) => {
  const {
    points = [],
    color = DEFAULT_RECTANGLE_COLOR,
    strokeWidth = 2,
    label = DEFAULT_PATH_LABEL,
  } = data as unknown as PathNodeData;

  // Only editable in LAYER mode
  const isEditable = editMode === EditMode.LAYER;
  const opacity = editMode === EditMode.LAYER ? ACTIVE_OPACITY : RECTANGLE_INACTIVE_OPACITY;

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
  } = useContextMenu({ id, editMode, isEditable, nodeType: 'pathNode' });

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

  // Handle copy and paste
  const handleCopyPaste = useCallback(() => {
    const currentNode = getNodes().find(node => node.id === id);
    if (!currentNode) {
      console.error('Current node not found');
      return;
    }
    
    setNodes((nds) => {
      // Calculate next zIndex
      const maxZIndex = Math.max(...nds.map(n => n.zIndex || 0), 0);
      
      const copiedNode = createPathCopy({
        currentNode,
        nodeType: 'pathNode',
        data: { points, color, strokeWidth, label },
      });
      
      const nodeWithZIndex = { ...copiedNode, zIndex: maxZIndex + 1 };
      return [...nds, nodeWithZIndex];
    });
    handleCloseContextMenu();
  }, [id, points, color, strokeWidth, label, getNodes, setNodes, handleCloseContextMenu]);

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
        onContextMenu={handleContextMenu}
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
              onBlur={handleBlur}
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
      
      {/* Context Menu */}
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
    </div>
  );
};

export default PathNode;