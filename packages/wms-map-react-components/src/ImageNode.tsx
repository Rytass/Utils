import React, { FC, useState, useCallback, useEffect } from 'react';
import { NodeProps, NodeResizeControl, useUpdateNodeInternals, useReactFlow } from '@xyflow/react';
import { EditMode } from '../typings';
import { DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT, ACTIVE_OPACITY, INACTIVE_OPACITY, IMAGE_RESIZE_CONTROL_SIZE } from './constants';
import { useContextMenu } from './hooks/useContextMenu';
import { createImageCopy } from './utils/nodeOperations';
import ContextMenu from './ContextMenu';
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

  // Context menu functionality
  const {
    contextMenu,
    handleContextMenu,
    handleCloseContextMenu,
    handleDelete,
    arrangeActions,
    arrangeStates,
    getNodes,
    setNodes: setNodesFromHook,
  } = useContextMenu({ id, editMode, isEditable, nodeType: 'imageNode' });

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

  // Handle copy and paste
  const handleCopyPaste = useCallback(() => {
    const currentNode = getNodes().find(node => node.id === id);
    if (!currentNode) {
      console.error('Current node not found');
      return;
    }
    
    setNodesFromHook((nds) => {
      // Calculate next zIndex
      const maxZIndex = Math.max(...nds.map(n => n.zIndex || 0), 0);
      
      const copiedNode = createImageCopy({
        currentNode,
        nodeType: 'imageNode',
        data: { 
          imageUrl, 
          width: currentSize.width, 
          height: currentSize.height, 
          fileName,
          originalWidth,
          originalHeight,
        },
      });
      
      const nodeWithZIndex = { ...copiedNode, zIndex: maxZIndex + 1 };
      return [...nds, nodeWithZIndex];
    });
    handleCloseContextMenu();
  }, [id, imageUrl, currentSize, fileName, originalWidth, originalHeight, getNodes, setNodesFromHook, handleCloseContextMenu]);

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
      <div 
        className={styles.imageContainer}
        onContextMenu={handleContextMenu}
      >
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

export default ImageNode;
