import { Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { LocationEntity } from '../models/location.entity';
import { StockEntity } from '../models/stock.entity';
import { StockCollectionDto } from '../typings/stock-collection.dto';
import { StockFindAllDto, StockFindDto } from '../typings/stock-find.dto';
import { StockSorter } from '../typings/stock-sorter.enum';
import { RESOLVED_STOCK_REPO, RESOLVED_TREE_LOCATION_REPO } from '../typings/wms-base-module-providers';

@Injectable()
export class StockService {
  constructor(
    @Inject(RESOLVED_STOCK_REPO)
    private readonly stockRepo: Repository<StockEntity>,
    @Inject(RESOLVED_TREE_LOCATION_REPO)
    private readonly locationRepo: Repository<LocationEntity>,
  ) {}

  private getQueryBuilder(options: StockFindDto, manager?: EntityManager): SelectQueryBuilder<StockEntity> {
    const repo = manager?.getRepository(StockEntity) ?? this.stockRepo;

    const queryBuilder = repo.createQueryBuilder('stock');

    if (options.locationIds?.length) {
      if (options.exactLocationMatch) {
        queryBuilder.andWhere('stock.locationId IN (:...locationIds)', {
          locationIds: options.locationIds,
        });
      } else {
        const locationIds = this.locationRepo
          .createQueryBuilder('loc')
          .select('loc.id', 'id')
          .where(qb => {
            const subQuery = qb
              .subQuery()
              .select('1')
              .from('locations', 'l2')
              .where('l2.id IN (:...l2Ids)', { l2Ids: options.locationIds })

              .andWhere("loc.mpath LIKE l2.mpath || '%'")
              .getQuery();

            return `EXISTS ${subQuery}`;
          });

        queryBuilder.addCommonTableExpression(locationIds, 'locationIds').andWhere('stock.locationId IN locationIds');
      }
    }

    if (options.materialIds?.length) {
      queryBuilder.andWhere('stock.materialId IN (:...materialIds)', {
        materialIds: options.materialIds,
      });
    }

    if (options.batchIds?.length) {
      queryBuilder.andWhere('stock.batchId IN (:...batchIds)', {
        batchIds: options.batchIds,
      });
    }

    return queryBuilder;
  }

  async find(options: StockFindDto, manager?: EntityManager): Promise<number> {
    const queryBuilder = this.getQueryBuilder(options, manager).select('SUM(stock.quantity)', 'quantity');

    const quantity = await queryBuilder.getRawOne<{ quantity: number }>().then(result => result?.quantity ?? 0);

    return quantity;
  }

  async findTransactions(options: StockFindAllDto): Promise<StockCollectionDto> {
    const qb = this.getQueryBuilder(options);

    const offset = options?.offset ?? 0;
    const limit = Math.min(options?.limit ?? 20, 100);

    qb.skip(offset);
    qb.take(limit);

    switch (options?.sorter) {
      case StockSorter.CREATED_AT_ASC:
        qb.addOrderBy('stock.createdAt', 'ASC');
        break;

      case StockSorter.CREATED_AT_DESC:
      default:
        qb.addOrderBy('stock.createdAt', 'DESC');
    }

    const [stocks, total] = await qb.getManyAndCount();

    return {
      transactionLogs: stocks.map(stock => ({
        id: stock.id,
        materialId: stock.materialId,
        batchId: stock.batchId,
        locationId: stock.locationId,
        orderId: stock.orderId,
        quantity: stock.quantity,
        createdAt: stock.createdAt,
      })),
      total,
      offset,
      limit,
    };
  }
}
