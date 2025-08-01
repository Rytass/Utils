import React, { FC, useState, useCallback, useEffect } from 'react';
import { NodeProps, NodeResizeControl, useUpdateNodeInternals, useReactFlow } from '@xyflow/react';
import { EditMode } from '../typings';
import { DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT, ACTIVE_OPACITY, INACTIVE_OPACITY, IMAGE_RESIZE_CONTROL_SIZE } from './constants';
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
  const updateNodeInternals = useUpdateNodeInternals();
  
  const {
    imageUrl,
    width = DEFAULT_IMAGE_WIDTH,
    height = DEFAULT_IMAGE_HEIGHT,
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
  const opacity = editMode === EditMode.BACKGROUND ? ACTIVE_OPACITY : INACTIVE_OPACITY;

  const updateNodeData = useCallback((updates: Partial<ImageNodeData>) => {
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
    const newWidth = params.width;
    const newHeight = newWidth / aspectRatio;

    const newSize = { width: newWidth, height: newHeight };
    setCurrentSize(newSize);
    updateNodeData({ width: newWidth, height: newHeight });
  }, [aspectRatio, updateNodeData]);

  return (
    <div className={`${styles.imageNode} ${selected ? styles.selected : ''}`}>
      {selected && isEditable && (
        <>
          <NodeResizeControl
            style={{
              background: 'white',
              border: '1px solid #5570d3',
              width: IMAGE_RESIZE_CONTROL_SIZE,
              height: IMAGE_RESIZE_CONTROL_SIZE,
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
              width: IMAGE_RESIZE_CONTROL_SIZE,
              height: IMAGE_RESIZE_CONTROL_SIZE,
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
              width: IMAGE_RESIZE_CONTROL_SIZE,
              height: IMAGE_RESIZE_CONTROL_SIZE,
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
              width: IMAGE_RESIZE_CONTROL_SIZE,
              height: IMAGE_RESIZE_CONTROL_SIZE,
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
