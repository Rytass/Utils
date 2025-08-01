import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  RESOLVED_WAREHOUSE_MAP_REPO,
  WMSBaseModule,
} from '@rytass/wms-base-nestjs-module';
import {
  mockWarehouseMapEntity,
  mockWarehouseMapRepo,
} from '../__mocks__/warehouse-map.mock';
import { WarehouseMapEntity } from '../src/models/warehouse-map.entity';
import { WarehouseMapService } from '../src/services/warehouse-map.service';
import { MapRangeColor, MapRangeType } from '../src/typings/warehouse-map.enum';

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
    mockWarehouseMapRepo.save.mockImplementation(
      async (entity) => entity as WarehouseMapEntity,
    );
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
    });

    const result = await warehouseMapService.updateMap('A001', [], []);

    expect(result).toEqual({
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
          color: MapRangeColor.RED,
          x: 10,
          y: 10,
          width: 100,
          height: 50,
        },
      ],
    );

    expect(result).toEqual({
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
            color: MapRangeColor.RED,
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
          color: MapRangeColor.YELLOW,
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

    expect(result).toEqual({
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
            color: MapRangeColor.YELLOW,
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

    expect(mockWarehouseMapRepo.remove).toHaveBeenCalledWith(
      mockWarehouseMapEntity,
    );

    expect(result).toBe(true);
  });

  it('should not delete map by Id if not found', async () => {
    mockWarehouseMapRepo.findOne.mockResolvedValue(null);

    const result = await warehouseMapService.deleteMapById('A001B');

    expect(mockWarehouseMapRepo.remove).toHaveBeenCalledTimes(0);

    expect(result).toBe(true);
  });
});
