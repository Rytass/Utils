import React, { FC } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import styles from './imageNode.module.scss';

interface ImageNodeData {
  imageUrl: string;
  width?: number;
  height?: number;
  fileName?: string;
}

const ImageNode: FC<NodeProps<ImageNodeData>> = ({ data, selected }) => {
  const { imageUrl, width = 300, height = 200, fileName } = data;

  return (
    <div className={`${styles.imageNode} ${selected ? styles.selected : ''}`}>
      <div className={styles.imageContainer}>
        <img 
          src={imageUrl} 
          alt={fileName || 'Uploaded image'}
          className={styles.image}
          style={{ 
            width: `${width}px`, 
            height: `${height}px`,
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        />
        {fileName && (
          <div className={styles.imageLabel}>
            {fileName}
          </div>
        )}
      </div>
      
      {/* Handles for connecting to other nodes */}
      <Handle
        type="target"
        position={Position.Top}
        className={styles.handle}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={styles.handle}
      />
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
      />
    </div>
  );
};

export default ImageNode;