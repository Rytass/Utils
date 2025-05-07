import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChildEntity, Column } from 'typeorm';
import { WMSModule } from '../src';
import { LocationEntity } from '../src/models/location.entity';
import { LocationService } from '../src/services/location.service';

@ChildEntity()
export class CustomLocationEntity extends LocationEntity {
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

  it('should create a custom location entity', async () => {
    const locationService =
      module.get<LocationService<CustomLocationEntity>>(LocationService);

    await locationService.create({
      id: 'archivableA',
      customField: 'customField',
    });

    await locationService.create(
      {
        id: 'childA',
        customField: 'customField',
      },
      'archivableA',
    );

    await locationService.archive('archivableA');
  });
});
