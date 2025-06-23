import { Inject, Injectable } from '@nestjs/common';
import { RESOLVED_ARTICLE_REPO } from '../typings/cms-base-providers';
import { BaseArticleEntity } from '../models/base-article.entity';
import { Repository } from 'typeorm';
import DataLoader from 'dataloader';
import { BaseCategoryEntity } from '../models/base-category.entity';
import { LRUCache } from 'lru-cache';

@Injectable()
export class ArticleDataLoader {
  constructor(
    @Inject(RESOLVED_ARTICLE_REPO)
    private readonly articleRepo: Repository<BaseArticleEntity>,
  ) {}

  readonly categoriesLoader = new DataLoader<
    string,
    BaseCategoryEntity[],
    string
  >(
    async (ids: readonly string[]): Promise<BaseCategoryEntity[][]> => {
      const qb = this.articleRepo.createQueryBuilder('articles');

      qb.leftJoinAndSelect('articles.categories', 'categories');

      qb.andWhere('articles.id IN (:...ids)', { ids });

      const articles = await qb.getMany();

      const categoryMap = new Map(
        articles.map((article) => [article.id, article.categories]),
      );

      return ids.map((id) => categoryMap.get(id) ?? []);
    },
    {
      cache: true,
      cacheMap: new LRUCache<string, Promise<BaseCategoryEntity[]>>({
        ttl: 1000 * 60, // 1 minute
        ttlAutopurge: true,
        max: 1000,
      }),
    },
  );
}
