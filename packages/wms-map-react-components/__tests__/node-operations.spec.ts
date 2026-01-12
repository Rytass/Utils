import { Node } from '@xyflow/react';
import {
  calculateCopyOffset,
  createRectangleCopy,
  createPathCopy,
  createImageCopy,
  CopyNodeOptions,
} from '../src/utils/node-operations';

describe('node-operations', () => {
  describe('calculateCopyOffset', () => {
    it('should calculate offset with default percentage (25%)', () => {
      const result = calculateCopyOffset(100, 200);

      expect(result).toEqual({
        offsetX: 25,
        offsetY: 50,
      });
    });

    it('should calculate offset with custom percentage', () => {
      const result = calculateCopyOffset(100, 100, 0.5);

      expect(result).toEqual({
        offsetX: 50,
        offsetY: 50,
      });
    });

    it('should handle zero dimensions', () => {
      const result = calculateCopyOffset(0, 0, 0.25);

      expect(result).toEqual({
        offsetX: 0,
        offsetY: 0,
      });
    });

    it('should handle decimal dimensions', () => {
      const result = calculateCopyOffset(33.3, 66.6, 0.1);

      expect(result.offsetX).toBeCloseTo(3.33, 2);
      expect(result.offsetY).toBeCloseTo(6.66, 2);
    });
  });

  describe('createRectangleCopy', () => {
    const baseNode: Node = {
      id: 'rect-original',
      type: 'rectangleNode',
      position: { x: 100, y: 200 },
      data: {},
    };

    it('should create a copy with offset position', () => {
      const options: CopyNodeOptions = {
        currentNode: baseNode,
        nodeType: 'rectangleNode',
        data: {
          width: 200,
          height: 100,
          color: '#FF0000',
          label: 'Zone A',
        },
      };

      const result = createRectangleCopy(options);

      expect(result.type).toBe('rectangleNode');
      expect(result.position.x).toBe(150); // 100 + (200 * 0.25)
      expect(result.position.y).toBe(225); // 200 + (100 * 0.25)
      expect(result.data.width).toBe(200);
      expect(result.data.height).toBe(100);
      expect(result.data.color).toBe('#FF0000');
      expect(result.data.label).toBe('Zone A');
    });

    it('should generate unique id with timestamp', () => {
      const options: CopyNodeOptions = {
        currentNode: baseNode,
        nodeType: 'rectangleNode',
        data: { width: 100, height: 100, color: '#000' },
      };

      const result = createRectangleCopy(options);

      expect(result.id).toMatch(/^rectangle-\d+$/);
    });

    it('should respect custom offset percentage', () => {
      const options: CopyNodeOptions = {
        currentNode: baseNode,
        nodeType: 'rectangleNode',
        offsetPercentage: 0.5,
        data: { width: 100, height: 100, color: '#000' },
      };

      const result = createRectangleCopy(options);

      expect(result.position.x).toBe(150); // 100 + (100 * 0.5)
      expect(result.position.y).toBe(250); // 200 + (100 * 0.5)
    });
  });

  describe('createPathCopy', () => {
    const baseNode: Node = {
      id: 'path-original',
      type: 'pathNode',
      position: { x: 50, y: 75 },
      data: {},
    };

    it('should create a copy with offset based on path bounds', () => {
      const options: CopyNodeOptions = {
        currentNode: baseNode,
        nodeType: 'pathNode',
        data: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 50, y: 80 },
          ],
          color: '#00FF00',
          strokeWidth: 2,
          label: 'Polygon 1',
        },
      };

      const result = createPathCopy(options);

      expect(result.type).toBe('pathNode');
      // Path width = 100 (max - min), height = 80
      expect(result.position.x).toBe(75); // 50 + (100 * 0.25)
      expect(result.position.y).toBe(95); // 75 + (80 * 0.25)
      expect(result.data.points).toEqual(options.data.points);
      expect(result.data.color).toBe('#00FF00');
      expect(result.data.strokeWidth).toBe(2);
      expect(result.data.label).toBe('Polygon 1');
    });

    it('should generate unique id with timestamp', () => {
      const options: CopyNodeOptions = {
        currentNode: baseNode,
        nodeType: 'pathNode',
        data: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 5, y: 15 },
          ],
          color: '#000',
        },
      };

      const result = createPathCopy(options);

      expect(result.id).toMatch(/^path-\d+$/);
    });

    it('should use minimum dimension of 10 for small paths', () => {
      const options: CopyNodeOptions = {
        currentNode: baseNode,
        nodeType: 'pathNode',
        data: {
          points: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 2, y: 5 },
          ],
          color: '#000',
        },
      };

      const result = createPathCopy(options);

      // Path width = 5 (clamped to 10), height = 5 (clamped to 10)
      expect(result.position.x).toBe(52.5); // 50 + (10 * 0.25)
      expect(result.position.y).toBe(77.5); // 75 + (10 * 0.25)
    });

    it('should respect custom offset percentage', () => {
      const options: CopyNodeOptions = {
        currentNode: baseNode,
        nodeType: 'pathNode',
        offsetPercentage: 0.1,
        data: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 50, y: 100 },
          ],
          color: '#000',
        },
      };

      const result = createPathCopy(options);

      // Path width = 100, height = 100, offset = 10%
      expect(result.position.x).toBe(60); // 50 + (100 * 0.1)
      expect(result.position.y).toBe(85); // 75 + (100 * 0.1)
    });
  });

  describe('createImageCopy', () => {
    const baseNode: Node = {
      id: 'image-original',
      type: 'imageNode',
      position: { x: 0, y: 0 },
      data: {},
    };

    it('should create a copy with offset position', () => {
      const options: CopyNodeOptions = {
        currentNode: baseNode,
        nodeType: 'imageNode',
        data: {
          imageUrl: 'https://example.com/image.jpg',
          width: 400,
          height: 300,
          fileName: 'image.jpg',
          originalWidth: 1600,
          originalHeight: 1200,
        },
      };

      const result = createImageCopy(options);

      expect(result.type).toBe('imageNode');
      expect(result.position.x).toBe(100); // 0 + (400 * 0.25)
      expect(result.position.y).toBe(75); // 0 + (300 * 0.25)
      expect(result.data.imageUrl).toBe('https://example.com/image.jpg');
      expect(result.data.width).toBe(400);
      expect(result.data.height).toBe(300);
      expect(result.data.fileName).toBe('image.jpg');
      expect(result.data.originalWidth).toBe(1600);
      expect(result.data.originalHeight).toBe(1200);
    });

    it('should generate unique id with timestamp', () => {
      const options: CopyNodeOptions = {
        currentNode: baseNode,
        nodeType: 'imageNode',
        data: {
          imageUrl: 'test.jpg',
          width: 100,
          height: 100,
        },
      };

      const result = createImageCopy(options);

      expect(result.id).toMatch(/^image-\d+$/);
    });

    it('should respect custom offset percentage', () => {
      const options: CopyNodeOptions = {
        currentNode: { ...baseNode, position: { x: 100, y: 100 } },
        nodeType: 'imageNode',
        offsetPercentage: 0.5,
        data: {
          imageUrl: 'test.jpg',
          width: 200,
          height: 200,
        },
      };

      const result = createImageCopy(options);

      expect(result.position.x).toBe(200); // 100 + (200 * 0.5)
      expect(result.position.y).toBe(200); // 100 + (200 * 0.5)
    });

    it('should preserve all image data properties', () => {
      const options: CopyNodeOptions = {
        currentNode: baseNode,
        nodeType: 'imageNode',
        data: {
          imageUrl: 'https://cdn.example.com/bg.png',
          width: 800,
          height: 600,
          fileName: 'background.png',
          originalWidth: 3200,
          originalHeight: 2400,
        },
      };

      const result = createImageCopy(options);

      expect(result.data).toEqual({
        imageUrl: 'https://cdn.example.com/bg.png',
        width: 800,
        height: 600,
        fileName: 'background.png',
        originalWidth: 3200,
        originalHeight: 2400,
      });
    });
  });
});
