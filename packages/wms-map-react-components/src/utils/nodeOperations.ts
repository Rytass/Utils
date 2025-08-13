import { Node } from '@xyflow/react';

export interface CopyNodeOptions {
  currentNode: Node;
  offsetPercentage?: number;
  nodeType: 'rectangleNode' | 'pathNode' | 'imageNode';
  data: any;
}

/**
 * Calculate offset position for copied node
 */
export const calculateCopyOffset = (
  width: number, 
  height: number, 
  offsetPercentage: number = 0.25
) => {
  return {
    offsetX: width * offsetPercentage,
    offsetY: height * offsetPercentage,
  };
};

/**
 * Create a copy of a rectangle node
 */
export const createRectangleCopy = (options: CopyNodeOptions): Node => {
  const { currentNode, offsetPercentage = 0.25, data } = options;
  const { offsetX, offsetY } = calculateCopyOffset(data.width, data.height, offsetPercentage);

  return {
    id: `rectangle-${Date.now()}`,
    type: 'rectangleNode',
    position: {
      x: currentNode.position.x + offsetX,
      y: currentNode.position.y + offsetY,
    },
    data: {
      width: data.width,
      height: data.height,
      color: data.color,
      label: data.label,
    },
  };
};

/**
 * Create a copy of a path node
 */
export const createPathCopy = (options: CopyNodeOptions): Node => {
  const { currentNode, offsetPercentage = 0.25, data } = options;
  
  // Calculate path bounds
  const xs = data.points.map((p: { x: number; y: number }) => p.x);
  const ys = data.points.map((p: { x: number; y: number }) => p.y);
  const bounds = {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
  
  const pathWidth = Math.max(bounds.maxX - bounds.minX, 10);
  const pathHeight = Math.max(bounds.maxY - bounds.minY, 10);
  const { offsetX, offsetY } = calculateCopyOffset(pathWidth, pathHeight, offsetPercentage);

  return {
    id: `path-${Date.now()}`,
    type: 'pathNode',
    position: {
      x: currentNode.position.x + offsetX,
      y: currentNode.position.y + offsetY,
    },
    data: {
      points: data.points,
      color: data.color,
      strokeWidth: data.strokeWidth,
      label: data.label,
    },
  };
};

/**
 * Create a copy of an image node
 */
export const createImageCopy = (options: CopyNodeOptions): Node => {
  const { currentNode, offsetPercentage = 0.25, data } = options;
  const { offsetX, offsetY } = calculateCopyOffset(data.width, data.height, offsetPercentage);

  return {
    id: `image-${Date.now()}`,
    type: 'imageNode',
    position: {
      x: currentNode.position.x + offsetX,
      y: currentNode.position.y + offsetY,
    },
    data: {
      imageUrl: data.imageUrl,
      width: data.width,
      height: data.height,
      fileName: data.fileName,
      originalWidth: data.originalWidth,
      originalHeight: data.originalHeight,
    },
  };
};