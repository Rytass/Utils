import React, { FC, useState, useCallback, useEffect } from 'react';
import { NodeProps, useReactFlow, useUpdateNodeInternals } from '@xyflow/react';
import { EditMode } from '../typings';
import { DEFAULT_RECTANGLE_COLOR, ACTIVE_OPACITY, RECTANGLE_INACTIVE_OPACITY } from './constants';
import styles from './pathNode.module.scss';

interface PathNodeData {
  points: { x: number; y: number }[];
  color?: string;
  strokeWidth?: number;
}

interface PathNodeProps extends NodeProps {
  editMode: EditMode;
}

const PathNode: FC<PathNodeProps> = ({ data, selected, id, editMode }) => {
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  
  const {
    points = [],
    color = DEFAULT_RECTANGLE_COLOR,
    strokeWidth = 2,
  } = data as unknown as PathNodeData;

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
        }}
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
      </div>
    </div>
  );
};

export default PathNode;