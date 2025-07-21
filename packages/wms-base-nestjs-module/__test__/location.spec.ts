import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomLocationEntity, locationMock } from '../__mocks__/location.mock';
import { materialMock } from '../__mocks__/material.mock';
import {
  MaterialService,
  OrderEntity,
  OrderService,
  WMSBaseModule,
} from '../src';
import {
  LocationAlreadyExistedError,
  LocationCannotArchiveError,
} from '../src/constants/errors/base.error';
import { LocationEntity } from '../src/models/location.entity';
import { LocationService } from '../src/services/location.service';

describe('location', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          autoLoadEntities: true,
          synchronize: true,
          logging: false,
        }),
        WMSBaseModule.forRootAsync({
          imports: [
            TypeOrmModule.forFeature([LocationEntity, CustomLocationEntity]),
          ],
          useFactory: () => ({
            locationEntity: CustomLocationEntity,
          }),
          inject: [],
        }),
      ],
    }).compile();
  });

  it('should create nested custom location entities', async () => {
    const locationService =
      module.get<LocationService<CustomLocationEntity>>(LocationService);

    const parent = await locationService.create(locationMock.parent);

    const child = await locationService.create(locationMock.child1);

    expect(parent).toHaveProperty('id', 'Parent');
    expect(parent).toHaveProperty('customField', 'Top Level');

    expect(child).toHaveProperty('id', 'Child1');
    expect(child).toHaveProperty('customField', 'customField');
    expect(child).toHaveProperty('parentId', 'Parent');
  });

  it('should throw error when creating duplicate location', async () => {
    const locationService =
      module.get<LocationService<CustomLocationEntity>>(LocationService);

    await locationService.create(locationMock.duplicate);

    await expect(
      locationService.create(locationMock.duplicate),
    ).rejects.toThrow(LocationAlreadyExistedError);
  });

  it('should throw error when archiving location has stocks', async () => {
    const locationService =
      module.get<LocationService<CustomLocationEntity>>(LocationService);

    const orderService = module.get<OrderService>(OrderService);
    const materialService = module.get<MaterialService>(MaterialService);

    await locationService.create(locationMock.locationWithStock);

    await materialService.create(materialMock.m1);

    await orderService.createOrder(OrderEntity, {
      order: {},
      batches: [
        {
          id: 'BatchId',
          locationId: locationMock.locationWithStock.id,
          materialId: materialMock.m1.id,
          quantity: 1,
        },
      ],
    });

    await expect(
      locationService.archive(locationMock.locationWithStock.id),
    ).rejects.toThrow(LocationCannotArchiveError);
  });
});
