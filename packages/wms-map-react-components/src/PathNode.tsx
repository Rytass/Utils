import React, { FC, useCallback, useState, useRef } from 'react';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { EditMode, ViewMode } from '../typings';
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
  viewMode: ViewMode;
  onTextEditComplete?: (id: string, oldText: string, newText: string) => void;
  onPathPointsChange?: (id: string, oldPoints: { x: number; y: number }[], newPoints: { x: number; y: number }[]) => void;
}

const PathNode: FC<PathNodeProps> = ({ data, selected, id, editMode, viewMode, onTextEditComplete, onPathPointsChange }) => {
  const {
    points = [],
    color = DEFAULT_RECTANGLE_COLOR,
    strokeWidth = 2,
    label = DEFAULT_PATH_LABEL,
  } = data as unknown as PathNodeData;

  // Get React Flow instance for viewport and node operations
  const { setNodes, getNodes, getViewport } = useReactFlow();
  
  // Dragging state - optimized for performance
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [dragPointIndex, setDragPointIndex] = useState<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const originalPointsRef = useRef<{ x: number; y: number }[]>([]);
  
  // Use refs for immediate access to current drag values
  const currentDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentSyncOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Visual-only state for smooth dragging (doesn't trigger React Flow updates)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragSyncOffset, setDragSyncOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Only editable in LAYER mode and EDIT view mode
  const isEditable = viewMode === ViewMode.EDIT && editMode === EditMode.LAYER;
  // Check if this node should be selectable (only in LAYER mode)
  const isSelectable = editMode === EditMode.LAYER;
  const opacity = editMode === EditMode.LAYER ? ACTIVE_OPACITY : RECTANGLE_INACTIVE_OPACITY;

  // Context menu functionality
  const {
    contextMenu,
    handleContextMenu,
    handleCloseContextMenu,
    handleDelete,
    arrangeActions,
    arrangeStates,
    getNodes: getNodesFromHook,
    setNodes: setNodesFromHook,
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

  // Calculate path dimensions - use fixed bounds during dragging to prevent unwanted shifts
  const getBounds = useCallback((pointsToUse: { x: number; y: number }[] = points) => {
    if (pointsToUse.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    
    const xs = pointsToUse.map(p => p.x);
    const ys = pointsToUse.map(p => p.y);
    
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }, [points]);

  // Always use current bounds for rendering
  const bounds = getBounds();
    
  const width = Math.max(bounds.maxX - bounds.minX, 10);
  const height = Math.max(bounds.maxY - bounds.minY, 10);

  // Check if path is closed (first and last points are the same)
  const isClosedPath = points.length > 2 && 
    Math.abs(points[0].x - points[points.length - 1].x) < 0.1 && 
    Math.abs(points[0].y - points[points.length - 1].y) < 0.1;

  // Simple approach: show ALL points, including duplicate first/last in closed paths
  const displayPoints = points;
  
  // Debug logging for path editing
  console.log('🔍 PathNode render', {
    id: id.slice(-4),
    isClosedPath,
    pointsCount: points.length,
    points: points.map((p, i) => `${i}:(${p.x.toFixed(1)},${p.y.toFixed(1)})`).join(' ')
  });

  // Performance-optimized drag handling - separate visual updates from data updates
  const handlePointMouseDown = useCallback((pointIndex: number, event: React.MouseEvent) => {
    if (!isEditable) return;
    
    const isFirstPoint = pointIndex === 0;
    const isLastPoint = pointIndex === points.length - 1;
    
    console.log('🚀 Point drag start (performance mode)', { 
      id: id.slice(-4), 
      pointIndex, 
      isClosedPath, 
      isFirstPoint,
      isLastPoint,
      totalPoints: points.length
    });
    
    // Store original state
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    originalPointsRef.current = [...points];
    setDragPointIndex(pointIndex);
    setIsDraggingPoint(true);
    
    // Reset visual offsets
    setDragOffset({ x: 0, y: 0 });
    setDragSyncOffset({ x: 0, y: 0 });
    currentDragOffsetRef.current = { x: 0, y: 0 };
    currentSyncOffsetRef.current = { x: 0, y: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      
      const viewport = getViewport();
      const deltaX = (e.clientX - dragStartRef.current.x) / viewport.zoom;
      const deltaY = (e.clientY - dragStartRef.current.y) / viewport.zoom;
      
      // Store current values in refs for immediate access
      currentDragOffsetRef.current = { x: deltaX, y: deltaY };
      
      // Update visual state - triggers re-render for smooth dragging
      setDragOffset({ x: deltaX, y: deltaY });
      
      // For closed paths, also update sync point visual offset
      if (isClosedPath && points.length > 2) {
        if (isFirstPoint || isLastPoint) {
          currentSyncOffsetRef.current = { x: deltaX, y: deltaY };
          setDragSyncOffset({ x: deltaX, y: deltaY });
        }
      }
    };

    const handleMouseUp = () => {
      console.log('🏁 Point drag end (performance mode)', { 
        id: id.slice(-4), 
        pointIndex,
        finalOffset: currentDragOffsetRef.current
      });
      
      if (!dragStartRef.current) return;
      
      // Use ref values for immediate access to final position
      const deltaX = currentDragOffsetRef.current.x;
      const deltaY = currentDragOffsetRef.current.y;
      
      console.log('📍 Final position calculation', {
        originalPoint: originalPointsRef.current[pointIndex],
        deltaX,
        deltaY,
        finalPoint: {
          x: originalPointsRef.current[pointIndex].x + deltaX,
          y: originalPointsRef.current[pointIndex].y + deltaY
        }
      });
      
      // Now update the actual data (only once at the end)
      const newPoints = [...originalPointsRef.current];
      const targetPoint = {
        x: originalPointsRef.current[pointIndex].x + deltaX,
        y: originalPointsRef.current[pointIndex].y + deltaY,
      };
      
      // Update the dragged point
      newPoints[pointIndex] = targetPoint;
      
      // For closed paths, sync first and last points
      if (isClosedPath && newPoints.length > 2) {
        if (isFirstPoint) {
          newPoints[newPoints.length - 1] = targetPoint;
          console.log('🔄 Final sync: last point with first point', targetPoint);
        } else if (isLastPoint) {
          newPoints[0] = targetPoint;
          console.log('🔄 Final sync: first point with last point', targetPoint);
        }
      }

      // Calculate new bounds and position like rectangle resize
      const newBounds = getBounds(newPoints);
      const currentNode = getNodes().find((n: any) => n.id === id);
      
      if (currentNode) {
        // Calculate position adjustment based on bounds change (like rectangle anchor)
        const oldBounds = getBounds(originalPointsRef.current);
        const positionDelta = {
          x: newBounds.minX - oldBounds.minX,
          y: newBounds.minY - oldBounds.minY
        };
        
        const newPosition = {
          x: currentNode.position.x + positionDelta.x,
          y: currentNode.position.y + positionDelta.y
        };
        
        console.log('📍 Position adjustment for anchor behavior', {
          oldBounds: `(${oldBounds.minX}, ${oldBounds.minY})`,
          newBounds: `(${newBounds.minX}, ${newBounds.minY})`,
          positionDelta,
          oldPosition: currentNode.position,
          newPosition
        });
        
        // Update both data and position simultaneously (like rectangle resize)
        setNodes((nodes) =>
          nodes.map((node) =>
            node.id === id
              ? { 
                  ...node, 
                  data: { ...node.data, points: newPoints },
                  position: newPosition
                }
              : node
          )
        );
      } else {
        // Fallback: just update data if node not found
        setNodes((nodes) =>
          nodes.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, points: newPoints } }
              : node
          )
        );
      }
      
      // Record history for undo/redo
      if (onPathPointsChange && originalPointsRef.current) {
        setTimeout(() => {
          console.log('💾 Recording history', {
            originalPoints: originalPointsRef.current,
            newPoints
          });
          onPathPointsChange(id, originalPointsRef.current, newPoints);
        }, 10);
      }
      
      // Reset states
      setIsDraggingPoint(false);
      setDragPointIndex(null);
      setDragOffset({ x: 0, y: 0 });
      setDragSyncOffset({ x: 0, y: 0 });
      currentDragOffsetRef.current = { x: 0, y: 0 };
      currentSyncOffsetRef.current = { x: 0, y: 0 };
      
      // Cleanup
      dragStartRef.current = null;
      originalPointsRef.current = [];
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [id, isEditable, points, isClosedPath, onPathPointsChange, setNodes, getViewport, dragOffset]);

  // Create SVG path string using fixed bounds during drag to prevent React Flow repositioning
  const pathString = displayPoints.length > 0 
    ? (() => {
        // Use fixed bounds during drag to maintain stable React Flow node positioning
        const pathPoints = displayPoints.map((p, index) => {
          let x = p.x - bounds.minX;
          let y = p.y - bounds.minY;
          
          // Apply drag offsets for visual feedback during dragging
          if (isDraggingPoint && dragPointIndex === index) {
            x += dragOffset.x;
            y += dragOffset.y;
          } else if (isDraggingPoint && isClosedPath && points.length > 2) {
            // Apply sync offset to opposite point in closed paths
            const isFirstPoint = index === 0;
            const isLastPoint = index === points.length - 1;
            const draggedIsFirst = dragPointIndex === 0;
            const draggedIsLast = dragPointIndex === points.length - 1;
            
            if ((draggedIsFirst && isLastPoint) || (draggedIsLast && isFirstPoint)) {
              x += dragSyncOffset.x;
              y += dragSyncOffset.y;
            }
          }
          
          return `${x} ${y}`;
        });
        
        if (isClosedPath) {
          // For closed paths, remove the duplicate last point and add Z to close
          return `M ${pathPoints.slice(0, -1).join(' L ')} Z`;
        } else {
          // For open paths, connect all points
          return `M ${pathPoints.join(' L ')}`;
        }
      })()
    : '';
    
  console.log('🎨 SVG path generation (fixed bounds during drag)', {
    id: id.slice(-4),
    isClosedPath,
    isDragging: isDraggingPoint,
    draggedIndex: isDraggingPoint ? dragPointIndex : null,
    pointsCount: displayPoints.length,
    bounds: `(${bounds.minX}, ${bounds.minY}) to (${bounds.maxX}, ${bounds.maxY})`,
    boundsSource: isDraggingPoint && originalPointsRef.current.length > 0 ? 'original (fixed)' : 'current',
    pathPreview: pathString.substring(0, 50) + (pathString.length > 50 ? '...' : '')
  });

  // Handle copy and paste
  const handleCopyPaste = useCallback(() => {
    const currentNode = getNodesFromHook().find(node => node.id === id);
    if (!currentNode) {
      console.error('Current node not found');
      return;
    }
    
    setNodesFromHook((nds) => {
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
  }, [id, points, color, strokeWidth, label, getNodesFromHook, setNodesFromHook, handleCloseContextMenu]);

  return (
    <div className={`${styles.pathNode} ${selected ? styles.selected : ''} ${!isSelectable ? styles.nonSelectable : ''}`}>
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
        onDoubleClick={viewMode === ViewMode.EDIT ? handleDoubleClick : undefined}
        onContextMenu={viewMode === ViewMode.EDIT ? handleContextMenu : undefined}
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
            fillOpacity={isClosedPath ? 0.2 : 0}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Path editing points with React Flow best practices */}
        {selected && isEditable && (
          <div 
            className="nodrag" // Prevent node dragging when interacting with points
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${width}px`,
              height: `${height}px`,
              pointerEvents: 'none', // Container doesn't capture events
              zIndex: 1000,
            }}
          >
            {displayPoints.map((point, index) => {
              // Use fixed bounds during dragging to maintain stable positioning
              const relativeX = point.x - bounds.minX;
              const relativeY = point.y - bounds.minY;
              const isBeingDragged = dragPointIndex === index && isDraggingPoint;
              
              // Apply visual offset during drag for smooth feedback
              let visualX = relativeX;
              let visualY = relativeY;
              
              if (isBeingDragged) {
                // Apply drag offset to the dragged point
                visualX += dragOffset.x;
                visualY += dragOffset.y;
              } else if (isDraggingPoint && isClosedPath && points.length > 2) {
                // Apply sync offset to the opposite point in closed paths
                const isFirstPoint = index === 0;
                const isLastPoint = index === points.length - 1;
                const draggedIsFirst = dragPointIndex === 0;
                const draggedIsLast = dragPointIndex === points.length - 1;
                
                if ((draggedIsFirst && isLastPoint) || (draggedIsLast && isFirstPoint)) {
                  visualX += dragSyncOffset.x;
                  visualY += dragSyncOffset.y;
                }
              }
              
              return (
                <div
                  key={`point-${index}`}
                  className="nodrag nopan" // React Flow utility classes
                  style={{
                    position: 'absolute',
                    left: `${visualX - 6}px`,
                    top: `${visualY - 6}px`,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: color, // Use path color for all points
                    border: '2px solid white',
                    cursor: isDraggingPoint ? 'grabbing' : 'grab',
                    zIndex: 1001,
                    pointerEvents: 'auto', // Only points capture events
                    boxShadow: isBeingDragged 
                      ? '0 4px 8px rgba(0,0,0,0.4)' 
                      : '0 2px 4px rgba(0,0,0,0.3)',
                    transform: isBeingDragged ? 'scale(1.3)' : 'scale(1)',
                    transition: isDraggingPoint ? 'none' : 'all 0.2s ease', // Disable transition during any drag
                    opacity: isBeingDragged ? 0.8 : 1,
                  }}
                  onMouseDown={(e) => {
                    // React Flow best practice: use nodrag class and proper event handling
                    e.stopPropagation();
                    handlePointMouseDown(index, e);
                  }}
                  title={`Point ${index + 1}`}
                />
              );
            })}
          </div>
        )}
        
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
              className="nodrag" // Prevent dragging when editing text
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
                cursor: 'default',
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

export default PathNode;