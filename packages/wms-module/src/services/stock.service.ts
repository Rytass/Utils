import { Inject, Injectable, Logger } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { LocationEntity } from '../models/location.entity';
import { StockEntity } from '../models/stock.entity';
import { StockFindDto } from '../typings/stock-find.dto';
import {
  RESOLVED_STOCK_REPO,
  RESOLVED_TREE_LOCATION_REPO,
} from '../typings/wms-module-providers';

@Injectable()
export class StockService<Entity extends StockEntity = StockEntity> {
  private readonly logger = new Logger(StockService.name);

  constructor(
    @Inject(RESOLVED_STOCK_REPO)
    private readonly stockRepo: Repository<StockEntity>,
    @Inject(RESOLVED_TREE_LOCATION_REPO)
    private readonly locationRepo: Repository<LocationEntity>,
  ) {}

  async find(options: StockFindDto, manager?: EntityManager): Promise<number> {
    const repo = manager?.getRepository(StockEntity) ?? this.stockRepo;

    const queryBuilder = repo
      .createQueryBuilder('stock')
      .select('SUM(stock.quantity)', 'quantity')
      .addSelect('stock.materialId', 'materialId')
      .addSelect('stock.locationId', 'locationId')
      .addSelect('stock.batchId', 'batchId');
    // .groupBy('stock.materialId')
    // .addGroupBy('stock.locationId')
    // .addGroupBy('stock.batchId');

    if (options.locationIds?.length) {
      const locationIds = this.locationRepo
        .createQueryBuilder('loc')
        .select('loc.id', 'id')
        .where((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from('locations', 'l2')
            .where('l2.id IN (:...ids)', { ids: options.locationIds })
            // eslint-disable-next-line quotes
            .andWhere("loc.mpath LIKE l2.mpath || '%'")
            .getQuery();

          return `EXISTS ${subQuery}`;
        });

      queryBuilder
        .addCommonTableExpression(locationIds, 'locationIds')
        .where('stock.locationId IN locationIds');
    }

    if (options.materialIds?.length) {
      queryBuilder.andWhere('stock.materialId IN (:...ids)', {
        ids: options.materialIds,
      });
    }

    if (options.batchIds?.length) {
      queryBuilder.andWhere('stock.batchId IN (:...ids)', {
        ids: options.batchIds,
      });
    }

    const quantity = await queryBuilder
      .getRawOne<{ quantity: number }>()
      .then((result) => result?.quantity ?? 0);

    return quantity;
  }
}
