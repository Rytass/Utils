import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChildEntity, Column, DataSource, Repository } from 'typeorm';
import { LocationEntity, LocationRepo } from '../src/models/location.entity';
import { LocationService } from '../src/services/location.service';
import { WMSModule } from '../src/wms.module';

@ChildEntity()
class MyLocationEntity extends LocationEntity {
  @Column('varchar')
  customField: string;
}

describe('WMSModule', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          // database: 'database.sqlite',
          autoLoadEntities: true,
          synchronize: true,
          logging: true,
        }),
        WMSModule.forRoot({
          locationEntity: MyLocationEntity,
        }),
      ],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
  });

  // afterAll(async () => {
  //   if (dataSource) {
  //     await dataSource.dropDatabase();
  //     await dataSource.destroy();
  //   }
  // });

  it(
    'should use sqlite to test if entity is defined',
    async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            // database: 'database.sqlite',
            autoLoadEntities: true,
            synchronize: true,
            logging: true,
          }),
          WMSModule.forRoot({
            locationEntity: MyLocationEntity,
          }),
        ],
      }).compile();

      const locationRepo =
        module.get<Repository<MyLocationEntity>>(LocationRepo);

      const locationService =
        module.get<LocationService<MyLocationEntity>>(LocationService);

      await locationService.createLocation({
        id: '1',
        customField: 'customField',
      });

      await locationService.createLocation(
        {
          id: '2',
          customField: 'anotherCustomField',
        },
        '1',
      );

      const locations = await locationRepo.find({
        relations: {
          parent: true,
          children: true,
        },
      });

      expect(locations).toEqual([
        expect.objectContaining({
          id: '1',
          children: [
            expect.objectContaining({
              id: '2',
            }),
          ],
          parent: null,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deletedAt: null,
        }),
        expect.objectContaining({
          id: '2',
          children: [],
          parent: expect.objectContaining({
            id: '1',
          }),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deletedAt: null,
        }),
      ]);
    },
    50 * 1000,
  );
});
