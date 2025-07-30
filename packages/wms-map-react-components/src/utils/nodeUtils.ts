import { Node } from '@xyflow/react';

export const updateNodeData = <T = any>(
  nodes: Node[],
  nodeId: string,
  updates: Partial<T>
): Node[] => {
  return nodes.map((node) =>
    node.id === nodeId
      ? { ...node, data: { ...node.data, ...updates } }
      : node
  );
};

export const calculateImageSize = (
  originalWidth: number,
  originalHeight: number,
  maxSize: number = 500
) => {
  let width = originalWidth;
  let height = originalHeight;

  if (width > maxSize || height > maxSize) {
    const ratio = Math.min(maxSize / width, maxSize / height);
    width = width * ratio;
    height = height * ratio;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
};

export const calculateStaggeredPosition = (index: number, baseX: number = 100, baseY: number = 100) => ({
  x: baseX + index * 30,
  y: baseY + index * 20,
});