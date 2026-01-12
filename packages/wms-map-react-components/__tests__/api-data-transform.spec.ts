import { Node } from '@xyflow/react';
import {
  transformApiDataToNodes,
  validateMapData,
  calculatePolygonBounds,
  calculateNodeZIndex,
  loadMapDataFromApi,
} from '../src/utils/api-data-transform';
import { Map as WmsMap, MapRangeType } from '../src/typings';

describe('api-data-transform', () => {
  describe('transformApiDataToNodes', () => {
    it('should transform empty map data to empty nodes array', () => {
      const mapData: WmsMap = {
        id: 'test-map',
        backgrounds: [],
        ranges: [],
      };

      const result = transformApiDataToNodes(mapData);

      expect(result).toEqual([]);
    });

    it('should transform backgrounds to imageNodes', () => {
      const mapData: WmsMap = {
        id: 'test-map',
        backgrounds: [
          {
            id: 'bg-1',
            filename: 'image1.jpg',
            x: 100,
            y: 200,
            width: 800,
            height: 600,
          },
        ],
        ranges: [],
      };

      const result = transformApiDataToNodes(mapData);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'bg-1',
        type: 'imageNode',
        position: { x: 100, y: 200 },
        data: {
          imageUrl: 'image1.jpg',
          fileName: 'image1.jpg',
          width: 800,
          height: 600,
        },
        zIndex: 1,
        draggable: true,
        selectable: true,
      });
    });

    it('should use custom imageUrlGenerator for background backgrounds', () => {
      const mapData: WmsMap = {
        id: 'test-map',
        backgrounds: [
          {
            id: 'bg-1',
            filename: 'image1.jpg',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
          },
        ],
        ranges: [],
      };

      const customUrlGenerator = (filename: string): string => `https://cdn.example.com/${filename}`;

      const result = transformApiDataToNodes(mapData, customUrlGenerator);

      expect(result[0].data.imageUrl).toBe('https://cdn.example.com/image1.jpg');
    });

    it('should transform rectangle ranges to rectangleNodes', () => {
      const mapData: WmsMap = {
        id: 'test-map',
        backgrounds: [],
        ranges: [
          {
            id: 'rect-1',
            type: MapRangeType.RECTANGLE,
            color: '#FF0000',
            x: 50,
            y: 75,
            width: 200,
            height: 150,
          },
        ],
      };

      const result = transformApiDataToNodes(mapData);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'rect-1',
        type: 'rectangleNode',
        position: { x: 50, y: 75 },
        data: {
          width: 200,
          height: 150,
          color: '#FF0000',
          label: 'rect-1',
        },
        zIndex: 1,
        draggable: true,
        selectable: true,
      });
    });

    it('should transform polygon ranges to pathNodes', () => {
      const mapData: WmsMap = {
        id: 'test-map',
        backgrounds: [],
        ranges: [
          {
            id: 'poly-1',
            type: MapRangeType.POLYGON,
            color: '#00FF00',
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 50, y: 100 },
            ],
          },
        ],
      };

      const result = transformApiDataToNodes(mapData);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('pathNode');
      expect(result[0].data.color).toBe('#00FF00');
      expect(result[0].data.label).toBe('poly-1');
      // Center should be calculated from points
      expect(result[0].position.x).toBeCloseTo(50);
      expect(result[0].position.y).toBeCloseTo(33.33, 1);
    });

    it('should calculate relative points for polygon nodes', () => {
      const mapData: WmsMap = {
        id: 'test-map',
        backgrounds: [],
        ranges: [
          {
            id: 'poly-1',
            type: MapRangeType.POLYGON,
            color: '#0000FF',
            points: [
              { x: 100, y: 100 },
              { x: 200, y: 100 },
              { x: 150, y: 200 },
            ],
          },
        ],
      };

      const result = transformApiDataToNodes(mapData);
      const relativePoints = result[0].data.points;

      // Points should be relative to center (150, 133.33)
      expect(relativePoints).toHaveLength(3);
      expect(relativePoints[0].x).toBeCloseTo(-50);
      expect(relativePoints[1].x).toBeCloseTo(50);
    });

    it('should assign correct zIndex for mixed backgrounds and ranges', () => {
      const mapData: WmsMap = {
        id: 'test-map',
        backgrounds: [
          { id: 'bg-1', filename: 'img1.jpg', x: 0, y: 0, width: 100, height: 100 },
          { id: 'bg-2', filename: 'img2.jpg', x: 100, y: 0, width: 100, height: 100 },
        ],
        ranges: [
          { id: 'rect-1', type: MapRangeType.RECTANGLE, color: '#FF0000', x: 0, y: 0, width: 50, height: 50 },
          {
            id: 'poly-1',
            type: MapRangeType.POLYGON,
            color: '#00FF00',
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 5, y: 10 },
            ],
          },
        ],
      };

      const result = transformApiDataToNodes(mapData);

      // Backgrounds should have zIndex 1, 2
      const bgNodes = result.filter(n => n.type === 'imageNode');

      expect(bgNodes[0].zIndex).toBe(1);
      expect(bgNodes[1].zIndex).toBe(2);

      // Ranges should have zIndex 3, 4 (after backgrounds)
      const rangeNodes = result.filter(n => n.type !== 'imageNode');

      expect(rangeNodes[0].zIndex).toBe(3);
      expect(rangeNodes[1].zIndex).toBe(4);
    });

    it('should filter out null nodes for unknown range types', () => {
      const mapData = {
        id: 'test-map',
        backgrounds: [],
        ranges: [{ id: 'unknown-1', type: 'UNKNOWN_TYPE', color: '#000000' }],
      } as unknown as Map;

      const result = transformApiDataToNodes(mapData);

      expect(result).toHaveLength(0);
    });
  });

  describe('validateMapData', () => {
    it('should return false for null data', () => {
      expect(validateMapData(null)).toBe(false);
    });

    it('should return false for undefined data', () => {
      expect(validateMapData(undefined)).toBe(false);
    });

    it('should return false for non-object data', () => {
      expect(validateMapData('string')).toBe(false);
      expect(validateMapData(123)).toBe(false);
      expect(validateMapData(true)).toBe(false);
    });

    it('should return false for missing id', () => {
      const data = {
        backgrounds: [],
        ranges: [],
      };

      expect(validateMapData(data)).toBe(false);
    });

    it('should return false for non-string id', () => {
      const data = {
        id: 123,
        backgrounds: [],
        ranges: [],
      };

      expect(validateMapData(data)).toBe(false);
    });

    it('should return false for non-array backgrounds', () => {
      const data = {
        id: 'test-map',
        backgrounds: 'not-an-array',
        ranges: [],
      };

      expect(validateMapData(data)).toBe(false);
    });

    it('should return false for non-array ranges', () => {
      const data = {
        id: 'test-map',
        backgrounds: [],
        ranges: 'not-an-array',
      };

      expect(validateMapData(data)).toBe(false);
    });

    it('should return false for invalid background data (missing id)', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const data = {
        id: 'test-map',
        backgrounds: [{ filename: 'img.jpg', x: 0, y: 0 }],
        ranges: [],
      };

      expect(validateMapData(data)).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should return false for invalid background data (missing filename)', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const data = {
        id: 'test-map',
        backgrounds: [{ id: 'bg-1', x: 0, y: 0 }],
        ranges: [],
      };

      expect(validateMapData(data)).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should return false for invalid background data (non-numeric x)', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const data = {
        id: 'test-map',
        backgrounds: [{ id: 'bg-1', filename: 'img.jpg', x: 'not-a-number', y: 0 }],
        ranges: [],
      };

      expect(validateMapData(data)).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should return false for invalid range data (missing id)', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const data = {
        id: 'test-map',
        backgrounds: [],
        ranges: [{ type: MapRangeType.RECTANGLE, color: '#000' }],
      };

      expect(validateMapData(data)).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should return false for invalid rectangle range (missing width)', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const data = {
        id: 'test-map',
        backgrounds: [],
        ranges: [{ id: 'rect-1', type: MapRangeType.RECTANGLE, color: '#000', x: 0, y: 0, height: 100 }],
      };

      expect(validateMapData(data)).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should return false for invalid polygon range (less than 3 points)', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const data = {
        id: 'test-map',
        backgrounds: [],
        ranges: [
          {
            id: 'poly-1',
            type: MapRangeType.POLYGON,
            color: '#000',
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 10 },
            ],
          },
        ],
      };

      expect(validateMapData(data)).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should return false for invalid polygon point (non-numeric coordinates)', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const data = {
        id: 'test-map',
        backgrounds: [],
        ranges: [
          {
            id: 'poly-1',
            type: MapRangeType.POLYGON,
            color: '#000',
            points: [
              { x: 0, y: 0 },
              { x: 'a', y: 10 },
              { x: 20, y: 20 },
            ],
          },
        ],
      };

      expect(validateMapData(data)).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should return true for valid map data with empty arrays', () => {
      const data: WmsMap = {
        id: 'test-map',
        backgrounds: [],
        ranges: [],
      };

      expect(validateMapData(data)).toBe(true);
    });

    it('should return true for valid map data with backgrounds', () => {
      const data: WmsMap = {
        id: 'test-map',
        backgrounds: [{ id: 'bg-1', filename: 'img.jpg', x: 0, y: 0, width: 100, height: 100 }],
        ranges: [],
      };

      expect(validateMapData(data)).toBe(true);
    });

    it('should return true for valid map data with rectangle ranges', () => {
      const data = {
        id: 'test-map',
        backgrounds: [],
        ranges: [{ id: 'rect-1', type: MapRangeType.RECTANGLE, color: '#FF0000', x: 0, y: 0, width: 100, height: 100 }],
      };

      expect(validateMapData(data)).toBe(true);
    });

    it('should return true for valid map data with polygon ranges', () => {
      const data = {
        id: 'test-map',
        backgrounds: [],
        ranges: [
          {
            id: 'poly-1',
            type: MapRangeType.POLYGON,
            color: '#00FF00',
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 50, y: 100 },
            ],
          },
        ],
      };

      expect(validateMapData(data)).toBe(true);
    });
  });

  describe('calculatePolygonBounds', () => {
    it('should return zero bounds for empty points array', () => {
      const result = calculatePolygonBounds([]);

      expect(result).toEqual({
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        width: 0,
        height: 0,
      });
    });

    it('should calculate bounds for a single point', () => {
      const result = calculatePolygonBounds([{ x: 50, y: 75 }]);

      expect(result).toEqual({
        minX: 50,
        maxX: 50,
        minY: 75,
        maxY: 75,
        width: 0,
        height: 0,
      });
    });

    it('should calculate bounds for multiple points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
        { x: 50, y: 200 },
      ];

      const result = calculatePolygonBounds(points);

      expect(result).toEqual({
        minX: 0,
        maxX: 100,
        minY: 0,
        maxY: 200,
        width: 100,
        height: 200,
      });
    });

    it('should handle negative coordinates', () => {
      const points = [
        { x: -50, y: -25 },
        { x: 50, y: 75 },
        { x: 0, y: 0 },
      ];

      const result = calculatePolygonBounds(points);

      expect(result).toEqual({
        minX: -50,
        maxX: 50,
        minY: -25,
        maxY: 75,
        width: 100,
        height: 100,
      });
    });
  });

  describe('calculateNodeZIndex', () => {
    it('should return 0 for empty nodes array with imageNode type', () => {
      const result = calculateNodeZIndex([], 'imageNode');

      expect(result).toBe(0);
    });

    it('should return 1 for empty nodes array with non-imageNode type', () => {
      const result = calculateNodeZIndex([], 'rectangleNode');

      expect(result).toBe(1);
    });

    it('should return count of imageNodes for imageNode type', () => {
      const nodes: Node[] = [
        { id: 'img-1', type: 'imageNode', position: { x: 0, y: 0 }, data: {} },
        { id: 'img-2', type: 'imageNode', position: { x: 0, y: 0 }, data: {} },
        { id: 'rect-1', type: 'rectangleNode', position: { x: 0, y: 0 }, data: {} },
      ];

      const result = calculateNodeZIndex(nodes, 'imageNode');

      expect(result).toBe(2);
    });

    it('should return maxZIndex + 1 for non-imageNode types', () => {
      const nodes: Node[] = [
        { id: 'img-1', type: 'imageNode', position: { x: 0, y: 0 }, data: {}, zIndex: 1 },
        { id: 'rect-1', type: 'rectangleNode', position: { x: 0, y: 0 }, data: {}, zIndex: 5 },
        { id: 'path-1', type: 'pathNode', position: { x: 0, y: 0 }, data: {}, zIndex: 3 },
      ];

      const result = calculateNodeZIndex(nodes, 'rectangleNode');

      expect(result).toBe(6);
    });

    it('should handle nodes without zIndex property', () => {
      const nodes: Node[] = [
        { id: 'img-1', type: 'imageNode', position: { x: 0, y: 0 }, data: {} },
        { id: 'rect-1', type: 'rectangleNode', position: { x: 0, y: 0 }, data: {} },
      ];

      const result = calculateNodeZIndex(nodes, 'pathNode');

      expect(result).toBe(1);
    });
  });

  describe('loadMapDataFromApi', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should log initial loading message with mapId', async () => {
      const mapId = 'test-map-123';

      // Note: The original source code has a bug where mockMapData uses 'images' instead of 'backgrounds',
      // which causes validateMapData to fail. This test verifies the original behavior.
      await expect(loadMapDataFromApi(mapId)).rejects.toThrow('Invalid map data format');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`模擬載入地圖資料: ${mapId}`));
    });

    it('should throw error due to invalid mock data format', async () => {
      // The original mockMapData uses 'images' property but validateMapData checks for 'backgrounds',
      // causing validation to fail and throw an error
      await expect(loadMapDataFromApi('test-map')).rejects.toThrow('Invalid map data format');
    });

    it('should log validation error message', async () => {
      try {
        await loadMapDataFromApi('test-map');
      } catch {
        // Expected to throw
      }

      // validateMapData logs error when backgrounds is not an array (because mockData uses 'images')
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('backgrounds must be an array'));
    });

    it('should log error message when loading fails', async () => {
      try {
        await loadMapDataFromApi('test-map');
      } catch {
        // Expected to throw
      }

      // console.error is called with two arguments: message and error object
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('載入地圖資料失敗'), expect.any(Error));
    });
  });
});
