import { Node } from '@xyflow/react';
import {
  transformNodesToMapData,
  transformNodeToClickInfo,
  logNodeData,
  logMapData,
} from '../src/utils/map-data-transform';
import { MapRangeType, Map } from '../src/typings';

describe('map-data-transform', () => {
  describe('transformNodesToMapData', () => {
    it('should transform empty nodes array to map data with empty arrays', () => {
      const result = transformNodesToMapData([]);

      expect(result.backgrounds).toEqual([]);
      expect(result.ranges).toEqual([]);
      expect(result.id).toMatch(/^map-\d+$/);
    });

    it('should transform imageNode to MapBackground', () => {
      const nodes: Node[] = [
        {
          id: 'img-1',
          type: 'imageNode',
          position: { x: 100, y: 200 },
          data: {
            fileName: 'background.jpg',
            imageUrl: 'https://example.com/background.jpg',
            width: 800,
            height: 600,
          },
        },
      ];

      const result = transformNodesToMapData(nodes);

      expect(result.backgrounds).toHaveLength(1);
      expect(result.backgrounds[0]).toEqual({
        id: 'img-1',
        filename: 'background.jpg',
        x: 100,
        y: 200,
        width: 800,
        height: 600,
      });
    });

    it('should use default values for missing imageNode data', () => {
      const nodes: Node[] = [
        {
          id: 'img-1',
          type: 'imageNode',
          position: { x: 0, y: 0 },
          data: {
            imageUrl: 'https://example.com/img.jpg',
          },
        },
      ];

      const result = transformNodesToMapData(nodes);

      expect(result.backgrounds[0].filename).toBe('unknown.jpg');
      expect(result.backgrounds[0].width).toBe(300);
      expect(result.backgrounds[0].height).toBe(200);
    });

    it('should transform rectangleNode to MapRectangleRange', () => {
      const nodes: Node[] = [
        {
          id: 'rect-1',
          type: 'rectangleNode',
          position: { x: 50, y: 75 },
          data: {
            width: 200,
            height: 150,
            color: '#FF0000',
            label: 'Zone A',
          },
        },
      ];

      const result = transformNodesToMapData(nodes);

      expect(result.ranges).toHaveLength(1);
      expect(result.ranges[0]).toEqual({
        id: 'Zone A',
        type: MapRangeType.RECTANGLE,
        color: '#FF0000',
        x: 50,
        y: 75,
        width: 200,
        height: 150,
      });
    });

    it('should use node id as range id when label is missing', () => {
      const nodes: Node[] = [
        {
          id: 'rect-1',
          type: 'rectangleNode',
          position: { x: 0, y: 0 },
          data: {
            width: 100,
            height: 100,
            color: '#00FF00',
          },
        },
      ];

      const result = transformNodesToMapData(nodes);

      expect(result.ranges[0].id).toBe('rect-1');
    });

    it('should use default values for missing rectangleNode data', () => {
      const nodes: Node[] = [
        {
          id: 'rect-1',
          type: 'rectangleNode',
          position: { x: 0, y: 0 },
          data: {},
        },
      ];

      const result = transformNodesToMapData(nodes);

      expect(result.ranges[0]).toMatchObject({
        color: '#0000FF',
        width: 100,
        height: 100,
      });
    });

    it('should transform pathNode to MapPolygonRange', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ];

      const nodes: Node[] = [
        {
          id: 'path-1',
          type: 'pathNode',
          position: { x: 0, y: 0 },
          data: {
            points,
            color: '#00FF00',
            label: 'Polygon 1',
          },
        },
      ];

      const result = transformNodesToMapData(nodes);

      expect(result.ranges).toHaveLength(1);
      expect(result.ranges[0]).toEqual({
        id: 'Polygon 1',
        type: MapRangeType.POLYGON,
        color: '#00FF00',
        points,
      });
    });

    it('throws when pathNode is missing the points array', () => {
      const nodes: Node[] = [
        {
          id: 'path-1',
          type: 'pathNode',
          position: { x: 0, y: 0 },
          data: {},
        },
      ];

      // pathData.points is required by the current implementation; calling
      // transformNodesToMapData with missing points raises a TypeError instead
      // of silently returning defaults.
      expect(() => transformNodesToMapData(nodes)).toThrow(TypeError);
    });

    it('should handle mixed node types', () => {
      const nodes: Node[] = [
        {
          id: 'img-1',
          type: 'imageNode',
          position: { x: 0, y: 0 },
          data: { imageUrl: 'img.jpg', fileName: 'image.jpg', width: 500, height: 400 },
        },
        {
          id: 'rect-1',
          type: 'rectangleNode',
          position: { x: 100, y: 100 },
          data: { width: 50, height: 50, color: '#FF0000' },
        },
        {
          id: 'path-1',
          type: 'pathNode',
          position: { x: 200, y: 200 },
          data: {
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 10 },
              { x: 5, y: 15 },
            ],
            color: '#00FF00',
          },
        },
      ];

      const result = transformNodesToMapData(nodes);

      expect(result.backgrounds).toHaveLength(1);
      expect(result.ranges).toHaveLength(2);
    });

    it('should ignore unknown node types with console warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const nodes: Node[] = [
        {
          id: 'unknown-1',
          type: 'unknownNode',
          position: { x: 0, y: 0 },
          data: {},
        },
      ];

      const result = transformNodesToMapData(nodes);

      expect(result.backgrounds).toHaveLength(0);
      expect(result.ranges).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown node type'), expect.anything());

      consoleSpy.mockRestore();
    });
  });

  describe('transformNodeToClickInfo', () => {
    it('should transform imageNode to ImageNodeClickInfo', () => {
      const node: Node = {
        id: 'img-1',
        type: 'imageNode',
        position: { x: 100, y: 200 },
        zIndex: 1,
        selected: true,
        data: {
          fileName: 'test.jpg',
          imageUrl: 'https://example.com/test.jpg',
          width: 800,
          height: 600,
          originalWidth: 1600,
          originalHeight: 1200,
        },
      };

      const result = transformNodeToClickInfo(node);

      expect(result).not.toBeNull();
      expect(result!.type).toBe('imageNode');
      expect(result!.id).toBe('img-1');
      expect(result!.position).toEqual({ x: 100, y: 200 });
      expect(result!.zIndex).toBe(1);
      expect(result!.selected).toBe(true);

      const imageInfo = result as {
        type: 'imageNode';
        imageData: {
          filename: string;
          size: { width: number; height: number };
          originalSize: { width: number; height: number };
          imageUrl: string;
        };
        mapBackground: { id: string; filename: string; x: number; y: number; width: number; height: number };
      };

      expect(imageInfo.imageData.filename).toBe('test.jpg');
      expect(imageInfo.imageData.size).toEqual({ width: 800, height: 600 });
      expect(imageInfo.imageData.originalSize).toEqual({ width: 1600, height: 1200 });
      expect(imageInfo.mapBackground.id).toBe('img-1');
    });

    it('should use default values for missing imageNode data', () => {
      const node: Node = {
        id: 'img-1',
        type: 'imageNode',
        position: { x: 0, y: 0 },
        data: {
          imageUrl: 'https://example.com/img.jpg',
        },
      };

      const result = transformNodeToClickInfo(node);

      const imageInfo = result as {
        imageData: {
          filename: string;
          size: { width: number; height: number };
          originalSize: { width: number; height: number };
        };
      };

      expect(imageInfo.imageData.filename).toBe('unknown.jpg');
      expect(imageInfo.imageData.size).toEqual({ width: 0, height: 0 });
      expect(imageInfo.imageData.originalSize).toEqual({ width: 0, height: 0 });
    });

    it('should transform rectangleNode to RectangleNodeClickInfo', () => {
      const node: Node = {
        id: 'rect-1',
        type: 'rectangleNode',
        position: { x: 50, y: 75 },
        zIndex: 2,
        selected: false,
        data: {
          width: 200,
          height: 150,
          color: '#FF0000',
          label: 'Zone A',
        },
      };

      const result = transformNodeToClickInfo(node);

      expect(result).not.toBeNull();
      expect(result!.type).toBe('rectangleNode');
      expect(result!.id).toBe('rect-1');

      const rectInfo = result as {
        rectangleData: { color: string; size: { width: number; height: number } };
        mapRectangleRange: {
          id: string;
          type: MapRangeType;
          color: string;
          x: number;
          y: number;
          width: number;
          height: number;
        };
      };

      expect(rectInfo.rectangleData.color).toBe('#FF0000');
      expect(rectInfo.rectangleData.size).toEqual({ width: 200, height: 150 });
      expect(rectInfo.mapRectangleRange.id).toBe('Zone A');
      expect(rectInfo.mapRectangleRange.type).toBe(MapRangeType.RECTANGLE);
    });

    it('should use default values for missing rectangleNode data', () => {
      const node: Node = {
        id: 'rect-1',
        type: 'rectangleNode',
        position: { x: 0, y: 0 },
        data: {},
      };

      const result = transformNodeToClickInfo(node);

      const rectInfo = result as { rectangleData: { color: string; size: { width: number; height: number } } };

      expect(rectInfo.rectangleData.color).toBe('#0000FF');
      expect(rectInfo.rectangleData.size).toEqual({ width: 100, height: 100 });
    });

    it('should transform pathNode to PathNodeClickInfo', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ];

      const node: Node = {
        id: 'path-1',
        type: 'pathNode',
        position: { x: 50, y: 33 },
        zIndex: 3,
        selected: true,
        data: {
          points,
          color: '#00FF00',
          strokeWidth: 3,
          label: 'Polygon 1',
        },
      };

      const result = transformNodeToClickInfo(node);

      expect(result).not.toBeNull();
      expect(result!.type).toBe('pathNode');
      expect(result!.id).toBe('path-1');

      const pathInfo = result as {
        pathData: {
          color: string;
          strokeWidth: number;
          pointCount: number;
          points: { x: number; y: number }[];
          bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
        };
        mapPolygonRange: { id: string; type: MapRangeType; color: string; points: { x: number; y: number }[] };
      };

      expect(pathInfo.pathData.color).toBe('#00FF00');
      expect(pathInfo.pathData.strokeWidth).toBe(3);
      expect(pathInfo.pathData.pointCount).toBe(3);
      // transformNodeToClickInfo persists absolute points (points + node.position
      // delta). With min(points) = (0, 0) and node.position = (50, 33), the
      // delta is (50, 33), so each point shifts by that amount.
      expect(pathInfo.pathData.points).toEqual([
        { x: 50, y: 33 },
        { x: 150, y: 33 },
        { x: 100, y: 133 },
      ]);

      expect(pathInfo.pathData.bounds).toEqual({
        minX: 50,
        minY: 33,
        maxX: 150,
        maxY: 133,
      });

      expect(pathInfo.mapPolygonRange.id).toBe('Polygon 1');
      expect(pathInfo.mapPolygonRange.type).toBe(MapRangeType.POLYGON);
    });

    it('throws when pathNode is missing the points array', () => {
      const node: Node = {
        id: 'path-1',
        type: 'pathNode',
        position: { x: 0, y: 0 },
        data: {},
      };

      // pathData.points is required by transformNodeToClickInfo; missing points
      // raises a TypeError rather than returning a default ClickInfo.
      expect(() => transformNodeToClickInfo(node)).toThrow(TypeError);
    });

    it('should return null for unknown node type', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const node: Node = {
        id: 'unknown-1',
        type: 'unknownNode',
        position: { x: 0, y: 0 },
        data: {},
      };

      const result = transformNodeToClickInfo(node);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('未知的節點類型'));

      consoleSpy.mockRestore();
    });
  });

  describe('logNodeData', () => {
    let consoleGroupSpy: jest.SpyInstance;
    let consoleGroupEndSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation();
      consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleGroupSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should log imageNode data', () => {
      const node: Node = {
        id: 'img-1',
        type: 'imageNode',
        position: { x: 100, y: 200 },
        zIndex: 1,
        selected: true,
        data: {
          fileName: 'test.jpg',
          imageUrl: 'https://example.com/test.jpg',
          width: 800,
          height: 600,
          originalWidth: 1600,
          originalHeight: 1200,
        },
      };

      logNodeData(node);

      expect(consoleGroupSpy).toHaveBeenCalledWith(expect.stringContaining('imageNode'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '📋 基本資訊:',
        expect.objectContaining({
          id: 'img-1',
          type: 'imageNode',
        }),
      );

      expect(consoleLogSpy).toHaveBeenCalledWith('🖼️ 背景圖片資訊:', expect.any(Object));
      expect(consoleLogSpy).toHaveBeenCalledWith('💾 儲存格式 (MapBackground):', expect.any(Object));
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it('should truncate long imageUrl in log output', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(100);
      const node: Node = {
        id: 'img-1',
        type: 'imageNode',
        position: { x: 0, y: 0 },
        data: {
          imageUrl: longUrl,
        },
      };

      logNodeData(node);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🖼️ 背景圖片資訊:',
        expect.objectContaining({
          imageUrl: expect.stringContaining('...'),
        }),
      );
    });

    it('should log rectangleNode data', () => {
      const node: Node = {
        id: 'rect-1',
        type: 'rectangleNode',
        position: { x: 50, y: 75 },
        zIndex: 2,
        selected: false,
        data: {
          width: 200,
          height: 150,
          color: '#FF0000',
          label: 'Zone A',
        },
      };

      logNodeData(node);

      expect(consoleGroupSpy).toHaveBeenCalledWith(expect.stringContaining('rectangleNode'));
      expect(consoleLogSpy).toHaveBeenCalledWith('📐 矩形資訊:', expect.any(Object));
      expect(consoleLogSpy).toHaveBeenCalledWith('💾 儲存格式 (MapRectangleRange):', expect.any(Object));
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it('should log pathNode data with bounds', () => {
      const node: Node = {
        id: 'path-1',
        type: 'pathNode',
        position: { x: 0, y: 0 },
        zIndex: 3,
        selected: true,
        data: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 50, y: 100 },
          ],
          color: '#00FF00',
          strokeWidth: 3,
        },
      };

      logNodeData(node);

      expect(consoleGroupSpy).toHaveBeenCalledWith(expect.stringContaining('pathNode'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🔗 路徑資訊:',
        expect.objectContaining({
          pointCount: 3,
          bounds: expect.objectContaining({
            minX: 0,
            maxX: 100,
            minY: 0,
            maxY: 100,
          }),
        }),
      );

      expect(consoleLogSpy).toHaveBeenCalledWith('💾 儲存格式 (MapPolygonRange):', expect.any(Object));
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it('throws when logNodeData receives a pathNode without points', () => {
      const node: Node = {
        id: 'path-1',
        type: 'pathNode',
        position: { x: 0, y: 0 },
        data: {},
      };

      // logNodeData reads pathData.points directly without a guard, so a
      // missing points array bubbles up as a TypeError.
      expect(() => logNodeData(node)).toThrow(TypeError);
    });

    it('should warn for unknown node type', () => {
      const node: Node = {
        id: 'unknown-1',
        type: 'unknownType',
        position: { x: 0, y: 0 },
        data: {},
      };

      logNodeData(node);

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('未知的節點類型'));
    });
  });

  describe('logMapData', () => {
    let consoleGroupSpy: jest.SpyInstance;
    let consoleGroupEndSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation();
      consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleGroupSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should log map data overview', () => {
      const mapData: Map = {
        id: 'test-map',
        backgrounds: [],
        ranges: [],
      };

      logMapData(mapData);

      expect(consoleGroupSpy).toHaveBeenCalledWith(expect.stringContaining('WMS Map Data Export'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '📋 Map Overview:',
        expect.objectContaining({
          id: 'test-map',
          backgroundCount: 0,
          rangeCount: 0,
        }),
      );

      expect(consoleLogSpy).toHaveBeenCalledWith('📄 Complete Map Data:', mapData);
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it('should log background images', () => {
      const mapData: Map = {
        id: 'test-map',
        backgrounds: [
          { id: 'bg-1', filename: 'img1.jpg', x: 100, y: 200, width: 800, height: 600 },
          { id: 'bg-2', filename: 'img2.jpg', x: 300, y: 400, width: 1000, height: 800 },
        ],
        ranges: [],
      };

      logMapData(mapData);

      expect(consoleGroupSpy).toHaveBeenCalledWith('🖼️ Background Images');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Background 1:',
        expect.objectContaining({
          id: 'bg-1',
          filename: 'img1.jpg',
        }),
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Background 2:',
        expect.objectContaining({
          id: 'bg-2',
          filename: 'img2.jpg',
        }),
      );
    });

    it('should log rectangle ranges', () => {
      const mapData: Map = {
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

      logMapData(mapData);

      expect(consoleGroupSpy).toHaveBeenCalledWith('📐 Ranges');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Rectangle 1:',
        expect.objectContaining({
          id: 'rect-1',
          type: MapRangeType.RECTANGLE,
          color: '#FF0000',
        }),
      );
    });

    it('should log polygon ranges', () => {
      const mapData: Map = {
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

      logMapData(mapData);

      expect(consoleGroupSpy).toHaveBeenCalledWith('📐 Ranges');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Polygon 1:',
        expect.objectContaining({
          id: 'poly-1',
          type: MapRangeType.POLYGON,
          color: '#00FF00',
          pointCount: 3,
        }),
      );
    });

    it('should log mixed backgrounds and ranges', () => {
      const mapData: Map = {
        id: 'test-map',
        backgrounds: [{ id: 'bg-1', filename: 'img1.jpg', x: 0, y: 0, width: 500, height: 400 }],
        ranges: [
          {
            id: 'rect-1',
            type: MapRangeType.RECTANGLE,
            color: '#FF0000',
            x: 100,
            y: 100,
            width: 50,
            height: 50,
          },
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

      logMapData(mapData);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '📋 Map Overview:',
        expect.objectContaining({
          backgroundCount: 1,
          rangeCount: 2,
        }),
      );

      expect(consoleGroupSpy).toHaveBeenCalledWith('🖼️ Background Images');
      expect(consoleGroupSpy).toHaveBeenCalledWith('📐 Ranges');
    });
  });
});
