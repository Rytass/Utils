import { MapBackgroundInput } from '../src/dto/map-background.input';
import { MapPolygonRangePointInput } from '../src/dto/map-polygon-range-point.input';
import { MapRangeInput } from '../src/dto/map-range-input';
import { MapRangeType } from '../src/typings/warehouse-map.enum';

describe('WMS Base NestJS Module DTOs', () => {
  describe('MapBackgroundInput', () => {
    it('should create an instance with all properties', () => {
      const input = new MapBackgroundInput();

      input.id = 'bg-1';
      input.filename = 'background.jpg';
      input.x = 100;
      input.y = 200;
      input.width = 800;
      input.height = 600;

      expect(input.id).toBe('bg-1');
      expect(input.filename).toBe('background.jpg');
      expect(input.x).toBe(100);
      expect(input.y).toBe(200);
      expect(input.width).toBe(800);
      expect(input.height).toBe(600);
    });

    it('should be an instance of MapBackgroundInput', () => {
      const input = new MapBackgroundInput();

      expect(input).toBeInstanceOf(MapBackgroundInput);
    });
  });

  describe('MapPolygonRangePointInput', () => {
    it('should create an instance with x and y coordinates', () => {
      const point = new MapPolygonRangePointInput();

      point.x = 50;
      point.y = 75;

      expect(point.x).toBe(50);
      expect(point.y).toBe(75);
    });

    it('should be an instance of MapPolygonRangePointInput', () => {
      const point = new MapPolygonRangePointInput();

      expect(point).toBeInstanceOf(MapPolygonRangePointInput);
    });
  });

  describe('MapRangeInput', () => {
    it('should create a rectangle range input', () => {
      const input = new MapRangeInput();

      input.id = 'rect-1';
      input.type = MapRangeType.RECTANGLE;
      input.color = '#FF0000';
      input.x = 100;
      input.y = 150;
      input.width = 200;
      input.height = 150;

      expect(input.id).toBe('rect-1');
      expect(input.type).toBe(MapRangeType.RECTANGLE);
      expect(input.color).toBe('#FF0000');
      expect(input.x).toBe(100);
      expect(input.y).toBe(150);
      expect(input.width).toBe(200);
      expect(input.height).toBe(150);
    });

    it('should create a polygon range input', () => {
      const point1 = new MapPolygonRangePointInput();

      point1.x = 0;
      point1.y = 0;

      const point2 = new MapPolygonRangePointInput();

      point2.x = 100;
      point2.y = 0;

      const point3 = new MapPolygonRangePointInput();

      point3.x = 50;
      point3.y = 100;

      const input = new MapRangeInput();

      input.id = 'poly-1';
      input.type = MapRangeType.POLYGON;
      input.color = '#00FF00';
      input.points = [point1, point2, point3];

      expect(input.id).toBe('poly-1');
      expect(input.type).toBe(MapRangeType.POLYGON);
      expect(input.color).toBe('#00FF00');
      expect(input.points).toHaveLength(3);
    });

    it('should be an instance of MapRangeInput', () => {
      const input = new MapRangeInput();

      expect(input).toBeInstanceOf(MapRangeInput);
    });

    it('should allow optional properties for rectangle', () => {
      const input = new MapRangeInput();

      input.id = 'rect-1';
      input.type = MapRangeType.RECTANGLE;
      input.color = '#0000FF';

      expect(input.x).toBeUndefined();
      expect(input.y).toBeUndefined();
      expect(input.width).toBeUndefined();
      expect(input.height).toBeUndefined();
    });

    it('should allow optional points property', () => {
      const input = new MapRangeInput();

      input.id = 'poly-1';
      input.type = MapRangeType.POLYGON;
      input.color = '#00FF00';

      expect(input.points).toBeUndefined();
    });
  });
});
