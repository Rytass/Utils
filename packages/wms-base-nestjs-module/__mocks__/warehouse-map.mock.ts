import { Repository } from 'typeorm';
import { WarehouseMapEntity } from '../src/models/warehouse-map.entity';
import { MapRangeType } from '../src/typings/warehouse-map.enum';

export const mockWarehouseMapEntity: WarehouseMapEntity = {
  id: 'A001A',
  mapData: {
    id: 'A001A',
    backgrounds: [
      {
        id: 'uuid1',
        filename: 'layer.png',
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
      },
      {
        id: 'uuid2',
        filename: 'layer2.png',
        x: 50.6,
        y: 12.4,
        width: 1250.35,
        height: 1000.5,
      },
    ],
    ranges: [
      {
        id: 'A001A1',
        type: MapRangeType.RECTANGLE,
        color: '#FF0000',
        x: 10,
        y: 10,
        width: 100,
        height: 50,
      },
      {
        id: 'A001A2',
        type: MapRangeType.POLYGON,
        color: '#FF0000',
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
          {
            x: 10.5,
            y: 20.5,
          },
        ],
      },
    ],
  },
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
} as WarehouseMapEntity;

export const mockWarehouseMapRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
} as unknown as jest.Mocked<Repository<WarehouseMapEntity>>;
