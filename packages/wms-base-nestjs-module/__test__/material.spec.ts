import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomMaterialEntity } from '../__mocks__/material.mock';
import { WMSBaseModule } from '../src';
import { MaterialEntity } from '../src/models/material.entity';
import { MaterialService } from '../src/services/material.service';

jest.mock('../src/models/warehouse-map.entity', () => ({
  WarehouseMapEntity: class MockWarehouseMapEntity {},
  WarehouseMapRepo: Symbol('MockWarehouseMapRepo'),
}));

describe('material', () => {
  let module: TestingModule;
  let service: MaterialService<CustomMaterialEntity>;

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
            TypeOrmModule.forFeature([MaterialEntity, CustomMaterialEntity]),
          ],
          useFactory: () => ({
            materialEntity: CustomMaterialEntity,
          }),
        }),
      ],
    }).compile();

    service =
      module.get<MaterialService<CustomMaterialEntity>>(MaterialService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should create a custom material entity', async () => {
    const material = await service.create({
      id: 'SOME_MATERIAL_ID',
      name: 'Test Material',
      customField: 'custom value',
    });

    expect(material).toHaveProperty('id', 'SOME_MATERIAL_ID');
    expect(material).toHaveProperty('name', 'Test Material');
    expect(material).toHaveProperty('customField', 'custom value');
  });
});
