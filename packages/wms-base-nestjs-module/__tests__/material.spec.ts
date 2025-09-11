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
          imports: [TypeOrmModule.forFeature([MaterialEntity, CustomMaterialEntity])],
          useFactory: () => ({
            materialEntity: CustomMaterialEntity,
          }),
        }),
      ],
    }).compile();

    service = module.get<MaterialService<CustomMaterialEntity>>(MaterialService);
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

  it('should create material with minimal required fields', async () => {
    const material = await service.create({
      id: 'MINIMAL_MATERIAL',
    });

    expect(material).toHaveProperty('id', 'MINIMAL_MATERIAL');
    expect(material).toHaveProperty('createdAt');
    expect(material).toHaveProperty('updatedAt');
  });

  it('should create material with all custom fields', async () => {
    const material = await service.create({
      id: 'FULL_MATERIAL',
      name: 'Full Test Material',
      customField: 'Full custom value',
    });

    expect(material).toHaveProperty('id', 'FULL_MATERIAL');
    expect(material).toHaveProperty('name', 'Full Test Material');
    expect(material).toHaveProperty('customField', 'Full custom value');
  });

  it('should handle empty string values', async () => {
    const material = await service.create({
      id: 'EMPTY_STRING_MATERIAL',
      name: '',
      customField: '',
    });

    expect(material).toHaveProperty('id', 'EMPTY_STRING_MATERIAL');
    expect(material).toHaveProperty('name', '');
    expect(material).toHaveProperty('customField', '');
  });

  it('should create multiple materials with different IDs', async () => {
    const material1 = await service.create({
      id: 'MATERIAL_1',
      name: 'Material One',
      customField: 'Custom One',
    });

    const material2 = await service.create({
      id: 'MATERIAL_2',
      name: 'Material Two',
      customField: 'Custom Two',
    });

    expect(material1.id).toBe('MATERIAL_1');
    expect(material2.id).toBe('MATERIAL_2');
    expect(material1.id).not.toBe(material2.id);
  });

  it('should preserve special characters in fields', async () => {
    const specialName = 'Material with 特殊字符 & symbols @#$%';
    const specialCustomField = 'Custom field with emojis and unicode';

    const material = (await service.create({
      id: 'SPECIAL_CHARS_MATERIAL',
      name: specialName,
      customField: specialCustomField,
    })) as CustomMaterialEntity;

    expect(material.name).toBe(specialName);
    expect(material.customField).toBe(specialCustomField);
  });

  it('should create material with very long field values', async () => {
    const longName = 'A'.repeat(255);
    const longCustomField = 'B'.repeat(255);

    const material = (await service.create({
      id: 'LONG_FIELDS_MATERIAL',
      name: longName,
      customField: longCustomField,
    })) as CustomMaterialEntity;

    expect(material.name).toBe(longName);
    expect(material.customField).toBe(longCustomField);
  });

  it('should auto-generate timestamps for created material', async () => {
    const material = await service.create({
      id: 'TIMESTAMP_MATERIAL',
      name: 'Test Material',
      customField: 'Test Value',
    });

    expect(material.createdAt).toBeInstanceOf(Date);
    expect(material.updatedAt).toBeInstanceOf(Date);

    // Check that timestamps are within reasonable range (within last minute)
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    expect(material.createdAt.getTime()).toBeGreaterThan(oneMinuteAgo.getTime());
    expect(material.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(material.updatedAt.getTime()).toBeGreaterThan(oneMinuteAgo.getTime());
    expect(material.updatedAt.getTime()).toBeLessThanOrEqual(now.getTime());
  });
});
