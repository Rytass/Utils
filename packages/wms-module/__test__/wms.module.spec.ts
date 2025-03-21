import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChildEntity, Column, Repository } from 'typeorm';
import { LocationEntity, LocationRepo } from '../src/models/location.entity';
import { LocationService } from '../src/services/location.service';
import { WMSModule } from '../src/wms.module';

@ChildEntity()
class MyLocationEntity extends LocationEntity {
  @Column('varchar')
  customField: string;
}

describe('WMSModule', () => {
  it(
    'should use sqlite to test if entity is defined',
    async () => {
      const module: TestingModule = await Test.createTestingModule({
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
              TypeOrmModule.forFeature([LocationEntity, MyLocationEntity]),
            ],
            useFactory: () => ({
              locationEntity: MyLocationEntity,
            }),
            inject: [],
          }),
        ],
      }).compile();

      const locationRepo =
        module.get<Repository<MyLocationEntity>>(LocationRepo);

      const locationService =
        module.get<LocationService<MyLocationEntity>>(LocationService);

      await locationService.createLocation({
        id: 'chihuahua',
        customField: 'customField',
      });

      await locationService.createLocation(
        {
          id: '2',
          customField: 'anotherCustomField',
        },
        'chihuahua',
      );

      const locations = await locationRepo.find({
        relations: {
          parent: true,
          children: true,
        },
      });

      console.log('locations', locations);

      expect(locations).toEqual([
        expect.objectContaining({
          id: 'chihuahua',
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
            id: 'chihuahua',
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
