import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationRepo } from '../src/models/location.entity';
import { WMSModule } from '../src/wms.module';

describe('WMSModule', () => {
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
          WMSModule.forRoot({}),
        ],
      }).compile();

      const locationRepo = module.get(LocationRepo);

      await locationRepo.save([
        {
          id: '1',
          name: 'Location 1',
        },
        {
          id: '2',
          name: 'Location 2',
        },
      ]);

      console.log('Locations created');

      const locations = await locationRepo.find();

      console.log(locations);

      expect(locations).toBeDefined();
    },
    50 * 1000,
  );
});
