import React, { FC, useState } from 'react';
import { NodeProps, NodeResizeControl } from '@xyflow/react';
import styles from './imageNode.module.scss';

interface ImageNodeData {
  imageUrl: string;
  width?: number;
  height?: number;
  fileName?: string;
  originalWidth?: number;
  originalHeight?: number;
}

const ImageNode: FC<NodeProps> = ({ data, selected, id }) => {
  const {
    imageUrl,
    width = 300,
    height = 200,
    fileName,
    originalWidth = width,
    originalHeight = height,
  } = data as unknown as ImageNodeData;

  const [currentSize, setCurrentSize] = useState({ width, height });

  // Calculate aspect ratio
  const aspectRatio = originalWidth / originalHeight;

  const handleResize = (event: any, params: any) => {
    const newWidth = params.width;
    const newHeight = newWidth / aspectRatio;

    setCurrentSize({ width: newWidth, height: newHeight });
  };

  return (
    <div className={`${styles.imageNode} ${selected ? styles.selected : ''}`}>
      {selected && (
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
          }}
          draggable={false}
        />
        {fileName && <div className={styles.imageLabel}>{fileName}</div>}
      </div>
    </div>
  );
};

export default ImageNode;
