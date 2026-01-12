import { updateNodeData, calculateImageSize, calculateStaggeredPosition } from '../src/utils/node-utils';
import { Node } from '@xyflow/react';

describe('Node Utils', () => {
  describe('updateNodeData', () => {
    const mockNodes: Node[] = [
      { id: '1', type: 'default', position: { x: 0, y: 0 }, data: { label: 'Node 1', color: 'red' } },
      { id: '2', type: 'default', position: { x: 100, y: 100 }, data: { label: 'Node 2', color: 'blue' } },
    ];

    it('should update data of specific node', () => {
      const result = updateNodeData(mockNodes, '1', { color: 'green' });

      expect(result[0].data.color).toBe('green');
      expect(result[0].data.label).toBe('Node 1');
    });

    it('should not modify other nodes', () => {
      const result = updateNodeData(mockNodes, '1', { color: 'green' });

      expect(result[1].data.color).toBe('blue');
    });

    it('should return new array reference', () => {
      const result = updateNodeData(mockNodes, '1', { color: 'green' });

      expect(result).not.toBe(mockNodes);
    });

    it('should handle non-existent node id', () => {
      const result = updateNodeData(mockNodes, 'non-existent', { color: 'green' });

      expect(result).toEqual(mockNodes);
    });

    it('should merge new data with existing data', () => {
      const result = updateNodeData(mockNodes, '1', { newProp: 'value' });

      expect(result[0].data).toEqual({ label: 'Node 1', color: 'red', newProp: 'value' });
    });
  });

  describe('calculateImageSize', () => {
    it('should return original size if within max bounds', () => {
      const result = calculateImageSize(200, 300, 500);

      expect(result).toEqual({ width: 200, height: 300 });
    });

    it('should scale down width when it exceeds max', () => {
      const result = calculateImageSize(1000, 400, 500);

      expect(result.width).toBeLessThanOrEqual(500);
      expect(result.height).toBeLessThanOrEqual(500);
    });

    it('should scale down height when it exceeds max', () => {
      const result = calculateImageSize(400, 1000, 500);

      expect(result.width).toBeLessThanOrEqual(500);
      expect(result.height).toBeLessThanOrEqual(500);
    });

    it('should maintain aspect ratio', () => {
      const result = calculateImageSize(1000, 500, 500);
      const originalRatio = 1000 / 500;
      const resultRatio = result.width / result.height;

      expect(Math.abs(originalRatio - resultRatio)).toBeLessThan(0.01);
    });

    it('should use default maxSize of 500', () => {
      const result = calculateImageSize(1000, 400);

      expect(result.width).toBeLessThanOrEqual(500);
    });

    it('should round dimensions to integers', () => {
      const result = calculateImageSize(999, 333, 500);

      expect(Number.isInteger(result.width)).toBe(true);
      expect(Number.isInteger(result.height)).toBe(true);
    });
  });

  describe('calculateStaggeredPosition', () => {
    it('should return fallback position when no viewport info', () => {
      const result = calculateStaggeredPosition(0);

      expect(result).toEqual({ x: 100, y: 100 });
    });

    it('should increment position for each index', () => {
      const result0 = calculateStaggeredPosition(0);
      const result1 = calculateStaggeredPosition(1);

      expect(result1.x).toBe(result0.x + 30);
      expect(result1.y).toBe(result0.y + 20);
    });

    it('should use custom base position', () => {
      const result = calculateStaggeredPosition(0, 200, 300);

      expect(result).toEqual({ x: 200, y: 300 });
    });

    it('should calculate viewport-based position when viewport info is provided', () => {
      const originalWindow = global.window;

      global.window = {
        ...originalWindow,
        innerWidth: 1920,
        innerHeight: 1080,
      } as Window & typeof globalThis;

      const result = calculateStaggeredPosition(0, 100, 100, 0, 0, 1);

      expect(typeof result.x).toBe('number');
      expect(typeof result.y).toBe('number');

      global.window = originalWindow;
    });

    it('should handle zoom factor in viewport calculation', () => {
      const originalWindow = global.window;

      global.window = {
        ...originalWindow,
        innerWidth: 1920,
        innerHeight: 1080,
      } as Window & typeof globalThis;

      const result1 = calculateStaggeredPosition(0, 100, 100, 0, 0, 1);
      const result2 = calculateStaggeredPosition(0, 100, 100, 0, 0, 2);

      expect(result1).not.toEqual(result2);

      global.window = originalWindow;
    });
  });
});
