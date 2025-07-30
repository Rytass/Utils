import React, { FC, useState, useCallback, useEffect } from 'react';
import { NodeProps, NodeResizeControl, useReactFlow } from '@xyflow/react';
import { EditMode } from '../typings';
import styles from './imageNode.module.scss';

interface ImageNodeData {
  imageUrl: string;
  width?: number;
  height?: number;
  fileName?: string;
  originalWidth?: number;
  originalHeight?: number;
}

interface ImageNodeProps extends NodeProps {
  editMode: EditMode;
}

const ImageNode: FC<ImageNodeProps> = ({ data, selected, id, editMode }) => {
  const { setNodes } = useReactFlow();
  
  const {
    imageUrl,
    width = 300,
    height = 200,
    fileName,
    originalWidth = width,
    originalHeight = height,
  } = data as unknown as ImageNodeData;

  const [currentSize, setCurrentSize] = useState({ width, height });

  // Sync currentSize with node data when it changes
  useEffect(() => {
    setCurrentSize({ width, height });
  }, [width, height]);

  // Calculate aspect ratio
  const aspectRatio = originalWidth / originalHeight;
  // Check if this node should be editable based on edit mode
  const isEditable = editMode === EditMode.BACKGROUND;
  const opacity = editMode === EditMode.BACKGROUND ? 1 : 0.4;

  const handleResize = useCallback((event: any, params: any) => {
    const newWidth = params.width;
    const newHeight = newWidth / aspectRatio;

    const newSize = { width: newWidth, height: newHeight };
    setCurrentSize(newSize);
    
    // Update the node data to persist the changes
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                width: newWidth,
                height: newHeight,
              },
            }
          : node
      )
    );
  }, [aspectRatio, id, setNodes]);

  return (
    <div className={`${styles.imageNode} ${selected ? styles.selected : ''}`}>
      {selected && isEditable && (
        <>
          <NodeResizeControl
            style={{
              background: 'white',
              border: '1px solid #5570d3',
              width: 20,
              height: 20,
              borderRadius: 2,
              zIndex: 10,
            }}
            minWidth={50}
            minHeight={50 / aspectRatio}
            keepAspectRatio={true}
            onResize={handleResize}
            position="top-left"
          />
          <NodeResizeControl
            style={{
              background: 'white',
              border: '1px solid #5570d3',
              width: 20,
              height: 20,
              borderRadius: 2,
              zIndex: 10,
            }}
            minWidth={50}
            minHeight={50 / aspectRatio}
            keepAspectRatio={true}
            onResize={handleResize}
            position="top-right"
          />
          <NodeResizeControl
            style={{
              background: 'white',
              border: '1px solid #5570d3',
              width: 20,
              height: 20,
              borderRadius: 2,
              zIndex: 10,
            }}
            minWidth={50}
            minHeight={50 / aspectRatio}
            keepAspectRatio={true}
            onResize={handleResize}
            position="bottom-left"
          />
          <NodeResizeControl
            style={{
              background: 'white',
              border: '1px solid #5570d3',
              width: 20,
              height: 20,
              borderRadius: 2,
              zIndex: 10,
            }}
            minWidth={50}
            minHeight={50 / aspectRatio}
            keepAspectRatio={true}
            onResize={handleResize}
            position="bottom-right"
          />
        </>
      )}
      <div className={styles.imageContainer}>
        <img
          src={imageUrl}
          alt={fileName || 'Uploaded image'}
          className={styles.image}
          style={{
            width: `${currentSize.width}px`,
            height: `${currentSize.height}px`,
            maxWidth: '100%',
            maxHeight: '100%',
            opacity: opacity,
          }}
          draggable={false}
        />
        {fileName && <div className={styles.imageLabel}>{fileName}</div>}
      </div>
    </div>
  );
};

export default ImageNode;
