import { Node } from '@xyflow/react';

export const updateNodeData = <T extends Record<string, unknown>>(
  nodes: Node[],
  nodeId: string,
  updates: Partial<T>,
): Node[] => {
  return nodes.map((node) =>
    node.id === nodeId ? { ...node, data: { ...node.data, ...updates } } : node,
  );
};

export const calculateImageSize = (
  originalWidth: number,
  originalHeight: number,
  maxSize: number = 500,
): { width: number; height: number } => {
  const needsResize = originalWidth > maxSize || originalHeight > maxSize;

  if (!needsResize) {
    return {
      width: Math.round(originalWidth),
      height: Math.round(originalHeight),
    };
  }

  const ratio = Math.min(maxSize / originalWidth, maxSize / originalHeight);

  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio),
  };
};

export const calculateStaggeredPosition = (
  index: number,
  baseX: number = 100,
  baseY: number = 100,
  viewportX?: number,
  viewportY?: number,
  viewportZoom?: number,
): { x: number; y: number } => {
  // If viewport information is provided, calculate position within current viewport
  if (
    viewportX !== undefined &&
    viewportY !== undefined &&
    viewportZoom !== undefined
  ) {
    // Convert viewport coordinates to canvas coordinates
    // The viewport shows the center of the view, so we need to offset from the center
    const centerX =
      -viewportX / viewportZoom + window.innerWidth / 2 / viewportZoom;

    const centerY =
      -viewportY / viewportZoom + window.innerHeight / 2 / viewportZoom;

    // Position images slightly offset from center
    const offsetX = centerX - 200 + index * 30; // Start 200px left of center
    const offsetY = centerY - 100 + index * 20; // Start 100px above center

    return {
      x: offsetX,
      y: offsetY,
    };
  }

  // Fallback to original fixed positioning
  return {
    x: baseX + index * 30,
    y: baseY + index * 20,
  };
};
