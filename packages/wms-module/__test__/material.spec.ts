import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChildEntity, Column, DataSource } from 'typeorm';
import { WMSModule } from '../src';
import { MaterialEntity } from '../src/models/material.entity';
import { MaterialService } from '../src/services/material.service';

@ChildEntity()
export class CustomMaterialEntity extends MaterialEntity {
  @Column('varchar')
  customField: string;
}

describe('TypeORM Custom Entity', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          // database: ':memory:',
          database: 'wms_test_db.sqlite',
          autoLoadEntities: true,
          synchronize: true,
          logging: true,
        }),
        WMSModule.forRootAsync({
          imports: [
            TypeOrmModule.forFeature([MaterialEntity, CustomMaterialEntity]),
          ],
          useFactory: () => ({
            materialEntity: CustomMaterialEntity,
          }),
          inject: [],
        }),
      ],
    }).compile();
  });

  it('should create a custom entity', async () => {
    const location = new CustomMaterialEntity();

    location.customField = 'Custom Value';
    location.id = 'SOME_WHERE';

    const materialService = module.get<MaterialService>(MaterialService);

    await materialService.create(location);

    const materialRepo = module
      .get<DataSource>(DataSource)
      .getRepository(CustomMaterialEntity);

    const savedLocation = await materialRepo.findOneOrFail({
      where: { id: location.id },
    });

    expect(savedLocation).toBeDefined();

    expect(savedLocation.customField).toEqual('Custom Value');
  });
});
