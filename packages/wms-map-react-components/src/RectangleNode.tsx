import React, { FC, useState } from 'react';
import { NodeProps, NodeResizeControl } from '@xyflow/react';
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
  const {
    width = 150,
    height = 100,
    color = '#3b82f6',
    label = '矩形區域',
  } = data as unknown as RectangleNodeData;

  const [currentSize, setCurrentSize] = useState({ width, height });

  // Only editable in LAYER mode
  const isEditable = editMode === EditMode.LAYER;
  const opacity = editMode === EditMode.LAYER ? 1 : 0.6;

  const handleResize = (event: any, params: any) => {
    setCurrentSize({ width: params.width, height: params.height });
  };

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
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default RectangleNode;