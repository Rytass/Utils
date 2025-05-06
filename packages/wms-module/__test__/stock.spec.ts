import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WMSModule } from '../src';
import { StockEntity } from '../src/models/stock.entity';
import { StockService } from '../src/services/stock.service';

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

    const stocks = await stockService.find({
      materialIds: [],
      batchIds: [],
      locationIds: ['2'],
    });

    console.log('stocks', stocks);
  });
});
