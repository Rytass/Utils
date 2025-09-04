import { Inject, Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { RESOLVED_CATEGORY_REPO } from '../typings/cms-base-providers';
import { Repository } from 'typeorm';
import { LRUCache } from 'lru-cache';
import { BaseCategoryEntity } from '../models/base-category.entity';

@Injectable()
export class CategoryDataLoader<CategoryEntity extends BaseCategoryEntity = BaseCategoryEntity> {
  constructor(
    @Inject(RESOLVED_CATEGORY_REPO)
    private readonly categoryRepo: Repository<BaseCategoryEntity>,
  ) {}

  readonly withParentsLoader = new DataLoader<string, CategoryEntity | null>(
    async (ids): Promise<(CategoryEntity | null)[]> => {
      const qb = this.categoryRepo.createQueryBuilder('categories');

      qb.innerJoinAndSelect('categories.multiLanguageNames', 'multiLanguageNames');

      qb.leftJoinAndSelect('categories.parents', 'parents');
      qb.leftJoinAndSelect('parents.multiLanguageNames', 'childMultiLanguageNames');

      qb.andWhere('categories.id IN (:...ids)', { ids });

      const categories = await qb.getMany();

      const categoryMap = new Map(categories.map(category => [category.id, category as CategoryEntity]));

      return ids.map(id => categoryMap.get(id) ?? null);
    },
    {
      cacheMap: new LRUCache<string, Promise<CategoryEntity | null>>({
        max: 100,
        ttl: 1000 * 15, // 15 seconds
        ttlAutopurge: true,
      }),
    },
  );
}
