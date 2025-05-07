import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WMSModule } from '../src';
import { StockEntity } from '../src/models/stock.entity';
import { StockService } from '../src/services/stock.service';
import { StockSorter } from '../src/typings/stock-sorter.enum';

describe('StockService', () => {
  let module: TestingModule;
  let stockService: StockService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: 'wms_test_db.sqlite',
          autoLoadEntities: true,
          synchronize: true,
          logging: 'all',
          logger: 'advanced-console',
        }),
        WMSModule.forRootAsync({
          imports: [TypeOrmModule.forFeature([StockEntity])],
          useFactory: () => ({
            // stockEntity: StockEntity,
          }),
        }),
      ],
    }).compile();

    stockService = module.get<StockService>(StockService);
  });

  it('should be defined', async () => {
    expect(stockService).toBeDefined();

    const options = {
      materialIds: [],
      batchIds: [],
      locationIds: ['chihuahua'],
      sorter: StockSorter.CREATED_AT_ASC,
    };

    const sum = await stockService.find(options);

    const stocks = await stockService.findTransactions(options);

    console.log('sum', sum);
    console.log('stocks', stocks);
  });
});
