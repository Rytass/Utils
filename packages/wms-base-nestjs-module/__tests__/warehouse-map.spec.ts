import { Test, TestingModule } from '@nestjs/testing';
import { RESOLVED_WAREHOUSE_MAP_REPO } from '@rytass/wms-base-nestjs-module';
import { mockWarehouseMapEntity, mockWarehouseMapRepo } from '../__mocks__/warehouse-map.mock';
import { WarehouseMapEntity } from '../src/models/warehouse-map.entity';
import { WarehouseMapService } from '../src/services/warehouse-map.service';
import { MapRangeType } from '../src/typings/warehouse-map.enum';

describe('warehouse-map', () => {
  let module: TestingModule;
  let warehouseMapService: WarehouseMapService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        WarehouseMapService,
        {
          provide: RESOLVED_WAREHOUSE_MAP_REPO,
          useValue: mockWarehouseMapRepo,
        },
      ],
    }).compile();

    warehouseMapService = module.get(WarehouseMapService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockWarehouseMapRepo.save.mockImplementation(async entity => entity as WarehouseMapEntity);
  });

  it('should create a new map entity if not found', async () => {
    mockWarehouseMapRepo.findOne.mockResolvedValueOnce(null);
    mockWarehouseMapRepo.create.mockReturnValue({
      id: 'A001',
      mapData: {
        id: 'A001',
        backgrounds: [],
        ranges: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as WarehouseMapEntity);

    const result = await warehouseMapService.updateMap('A001', [], []);

    expect(result).toMatchObject({
      id: 'A001',
      mapData: {
        id: 'A001',
        backgrounds: [],
        ranges: [],
      },
    });
  });

  it('should update an existing map entity if found - rectangle', async () => {
    mockWarehouseMapRepo.findOne.mockResolvedValue(mockWarehouseMapEntity);

    const result = await warehouseMapService.updateMap(
      'A001A',
      [
        {
          id: 'uuid3',
          filename: 'layer3.png',
          x: 3,
          y: 3,
          width: 3000.25,
          height: 3000.8,
        },
      ],
      [
        {
          id: 'A1001A1',
          type: MapRangeType.RECTANGLE,
          color: '#FF0000',
          x: 10,
          y: 10,
          width: 100,
          height: 50,
        },
      ],
    );

    expect(result).toMatchObject({
      id: 'A001A',
      mapData: {
        id: 'A001A',
        backgrounds: [
          {
            id: 'uuid3',
            filename: 'layer3.png',
            x: 3,
            y: 3,
            width: 3000.25,
            height: 3000.8,
          },
        ],
        ranges: [
          {
            id: 'A1001A1',
            type: MapRangeType.RECTANGLE,
            color: '#FF0000',
            x: 10,
            y: 10,
            width: 100,
            height: 50,
          },
        ],
      },
    });
  });

  it('should update an existing map entity if found - polygon', async () => {
    mockWarehouseMapRepo.findOne.mockResolvedValue(mockWarehouseMapEntity);

    const result = await warehouseMapService.updateMap(
      'A001A',
      [
        {
          id: 'uuid3',
          filename: 'layer3.png',
          x: 3,
          y: 3,
          width: 3000.25,
          height: 3000.8,
        },
      ],
      [
        {
          id: 'A001A1',
          type: MapRangeType.POLYGON,
          color: '#FFFF00',
          points: [
            {
              x: 10.5,
              y: 10.5,
            },
            {
              x: 20.5,
              y: 10.5,
            },
            {
              x: 20.5,
              y: 20.5,
            },
          ],
        },
      ],
    );

    expect(result).toMatchObject({
      id: 'A001A',
      mapData: {
        id: 'A001A',
        backgrounds: [
          {
            id: 'uuid3',
            filename: 'layer3.png',
            x: 3,
            y: 3,
            width: 3000.25,
            height: 3000.8,
          },
        ],
        ranges: [
          {
            id: 'A001A1',
            type: MapRangeType.POLYGON,
            color: '#FFFF00',
            points: [
              {
                x: 10.5,
                y: 10.5,
              },
              {
                x: 20.5,
                y: 10.5,
              },
              {
                x: 20.5,
                y: 20.5,
              },
            ],
          },
        ],
      },
    });
  });

  it('should get map by Id (existing)', async () => {
    mockWarehouseMapRepo.findOne.mockResolvedValue(mockWarehouseMapEntity);

    const result = await warehouseMapService.getMapById('A001A');

    expect(result).toEqual({
      ...mockWarehouseMapEntity.mapData,
      id: mockWarehouseMapEntity.id,
    });
  });

  it('should get map by Id (non-existing)', async () => {
    mockWarehouseMapRepo.findOne.mockResolvedValue(null);

    const result = await warehouseMapService.getMapById('A001A');

    expect(result).toEqual({
      id: 'A001A',
      backgrounds: [],
      ranges: [],
    });
  });

  it('should delete map by Id if found', async () => {
    mockWarehouseMapRepo.findOne.mockResolvedValue(mockWarehouseMapEntity);

    const result = await warehouseMapService.deleteMapById('A001A');

    expect(mockWarehouseMapRepo.remove).toHaveBeenCalledWith(mockWarehouseMapEntity);

    expect(result).toBe(true);
  });

  it('should not delete map by Id if not found', async () => {
    mockWarehouseMapRepo.findOne.mockResolvedValue(null);

    const result = await warehouseMapService.deleteMapById('A001B');

    expect(mockWarehouseMapRepo.remove).toHaveBeenCalledTimes(0);

    expect(result).toBe(true);
  });

  it('should throw error when rectangle range missing required properties', async () => {
    mockWarehouseMapRepo.findOne.mockResolvedValue(mockWarehouseMapEntity);

    // Missing x property
    await expect(
      warehouseMapService.updateMap(
        'A001A',
        [],
        [
          {
            id: 'INVALID_RECT1',
            type: MapRangeType.RECTANGLE,
            color: '#FF0000',
            y: 10,
            width: 100,
            height: 50,
          } as Partial<{
            id: string;
            type: MapRangeType;
            color: string;
            x?: number;
            y?: number;
            width?: number;
            height?: number;
          }>,
        ],
      ),
    ).rejects.toThrow('Rectangle range "INVALID_RECT1" requires x, y, width, and height properties');

    // Missing y property
    await expect(
      warehouseMapService.updateMap(
        'A001A',
        [],
        [
          {
            id: 'INVALID_RECT2',
            type: MapRangeType.RECTANGLE,
            color: '#FF0000',
            x: 10,
            width: 100,
            height: 50,
          } as Partial<{
            id: string;
            type: MapRangeType;
            color: string;
            x?: number;
            y?: number;
            width?: number;
            height?: number;
          }>,
        ],
      ),
    ).rejects.toThrow('Rectangle range "INVALID_RECT2" requires x, y, width, and height properties');

    // Missing width property
    await expect(
      warehouseMapService.updateMap(
        'A001A',
        [],
        [
          {
            id: 'INVALID_RECT3',
            type: MapRangeType.RECTANGLE,
            color: '#FF0000',
            x: 10,
            y: 10,
            height: 50,
          } as Partial<{
            id: string;
            type: MapRangeType;
            color: string;
            x?: number;
            y?: number;
            width?: number;
            height?: number;
          }>,
        ],
      ),
    ).rejects.toThrow('Rectangle range "INVALID_RECT3" requires x, y, width, and height properties');

    // Missing height property
    await expect(
      warehouseMapService.updateMap(
        'A001A',
        [],
        [
          {
            id: 'INVALID_RECT4',
            type: MapRangeType.RECTANGLE,
            color: '#FF0000',
            x: 10,
            y: 10,
            width: 100,
          } as Partial<{
            id: string;
            type: MapRangeType;
            color: string;
            x?: number;
            y?: number;
            width?: number;
            height?: number;
          }>,
        ],
      ),
    ).rejects.toThrow('Rectangle range "INVALID_RECT4" requires x, y, width, and height properties');
  });

  it('should throw error when polygon range missing points or has empty points', async () => {
    mockWarehouseMapRepo.findOne.mockResolvedValue(mockWarehouseMapEntity);

    // Missing points property
    await expect(
      warehouseMapService.updateMap(
        'A001A',
        [],
        [
          {
            id: 'INVALID_POLYGON1',
            type: MapRangeType.POLYGON,
            color: '#FF0000',
          } as Partial<{ id: string; type: MapRangeType; color: string; points?: Array<{ x: number; y: number }> }>,
        ],
      ),
    ).rejects.toThrow('Polygon range "INVALID_POLYGON1" requires points array with at least one point');

    // Empty points array
    await expect(
      warehouseMapService.updateMap(
        'A001A',
        [],
        [
          {
            id: 'INVALID_POLYGON2',
            type: MapRangeType.POLYGON,
            color: '#FF0000',
            points: [],
          },
        ],
      ),
    ).rejects.toThrow('Polygon range "INVALID_POLYGON2" requires points array with at least one point');
  });

  it('should handle complex map updates with multiple backgrounds and ranges', async () => {
    mockWarehouseMapRepo.findOne.mockResolvedValue(mockWarehouseMapEntity);

    const result = await warehouseMapService.updateMap(
      'COMPLEX_MAP',
      [
        {
          id: 'bg1',
          filename: 'background1.png',
          x: 0,
          y: 0,
          width: 1000,
          height: 1000,
        },
        {
          id: 'bg2',
          filename: 'background2.png',
          x: 500,
          y: 500,
          width: 800,
          height: 600,
        },
      ],
      [
        {
          id: 'rect1',
          type: MapRangeType.RECTANGLE,
          color: '#FF0000',
          x: 10,
          y: 10,
          width: 100,
          height: 50,
        },
        {
          id: 'poly1',
          type: MapRangeType.POLYGON,
          color: '#00FF00',
          points: [
            { x: 200, y: 200 },
            { x: 300, y: 200 },
            { x: 250, y: 300 },
          ],
        },
        {
          id: 'rect2',
          type: MapRangeType.RECTANGLE,
          color: '#0000FF',
          x: 400,
          y: 400,
          width: 150,
          height: 75,
        },
      ],
    );

    expect(result.mapData.backgrounds).toHaveLength(2);
    expect(result.mapData.ranges).toHaveLength(3);
    expect(result.mapData.ranges.find(r => r.id === 'rect1')).toMatchObject({
      id: 'rect1',
      type: MapRangeType.RECTANGLE,
      color: '#FF0000',
      x: 10,
      y: 10,
      width: 100,
      height: 50,
    });

    expect(result.mapData.ranges.find(r => r.id === 'poly1')).toMatchObject({
      id: 'poly1',
      type: MapRangeType.POLYGON,
      color: '#00FF00',
      points: [
        { x: 200, y: 200 },
        { x: 300, y: 200 },
        { x: 250, y: 300 },
      ],
    });
  });

  it('should handle edge case with zero dimensions for rectangle', async () => {
    mockWarehouseMapRepo.findOne.mockResolvedValue(mockWarehouseMapEntity);

    const result = await warehouseMapService.updateMap(
      'A001A',
      [],
      [
        {
          id: 'ZERO_RECT',
          type: MapRangeType.RECTANGLE,
          color: '#FF0000',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        },
      ],
    );

    expect(result.mapData.ranges[0]).toMatchObject({
      id: 'ZERO_RECT',
      type: MapRangeType.RECTANGLE,
      color: '#FF0000',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });

  it('should handle polygon with single point', async () => {
    mockWarehouseMapRepo.findOne.mockResolvedValue(mockWarehouseMapEntity);

    const result = await warehouseMapService.updateMap(
      'A001A',
      [],
      [
        {
          id: 'SINGLE_POINT_POLY',
          type: MapRangeType.POLYGON,
          color: '#FF0000',
          points: [{ x: 100, y: 100 }],
        },
      ],
    );

    expect(result.mapData.ranges[0]).toMatchObject({
      id: 'SINGLE_POINT_POLY',
      type: MapRangeType.POLYGON,
      color: '#FF0000',
      points: [{ x: 100, y: 100 }],
    });
  });

  afterAll(async () => {
    await module.close();
  });
});
