import { Inject, Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Repository } from 'typeorm';
import { LRUCache } from 'lru-cache';
import {
  BaseArticleEntity,
  BaseCategoryEntity,
  BaseCategoryMultiLanguageNameEntity,
  RESOLVED_ARTICLE_REPO,
  RESOLVED_CATEGORY_REPO,
} from '@rytass/cms-base-nestjs-module';

@Injectable()
export class CategoryDataLoader {
  constructor(
    @Inject(RESOLVED_CATEGORY_REPO)
    private readonly categoryRepo: Repository<BaseCategoryEntity>,
    @Inject(RESOLVED_ARTICLE_REPO)
    private readonly articleRepo: Repository<BaseArticleEntity>,
  ) {}

  readonly multiLanguageNameLoader = new DataLoader<
    string,
    BaseCategoryMultiLanguageNameEntity[]
  >(
    async (ids): Promise<BaseCategoryMultiLanguageNameEntity[][]> => {
      const qb = this.categoryRepo.createQueryBuilder('categories');

      qb.innerJoinAndSelect(
        'categories.multiLanguageNames',
        'multiLanguageNames',
      );

      qb.andWhere('categories.id IN (:...ids)', { ids });

      const categories = await qb.getMany();

      const categoryMap = new Map(
        categories.map((category) => [
          category.id,
          category.multiLanguageNames,
        ]),
      );

      return ids.map((id) => categoryMap.get(id) ?? []);
    },
    {
      cacheMap: new LRUCache<
        string,
        Promise<BaseCategoryMultiLanguageNameEntity[]>
      >({
        max: 100,
        ttl: 1000 * 15, // 15 seconds
        ttlAutopurge: true,
      }),
    },
  );

  readonly loaderWithArticleId = new DataLoader<string, BaseCategoryEntity[]>(
    async (ids): Promise<BaseCategoryEntity[][]> => {
      const qb = this.articleRepo.createQueryBuilder('articles');

      qb.innerJoinAndSelect('articles.categories', 'categories');

      qb.andWhere('articles.id IN (:...ids)', { ids });

      const articles = await qb.getMany();

      const articleMap = new Map(
        articles.map((article) => [article.id, article.categories]),
      );

      return ids.map((id) => articleMap.get(id) ?? []);
    },
    {
      cacheMap: new LRUCache<string, Promise<BaseCategoryEntity[]>>({
        max: 100,
        ttl: 1000 * 15, // 15 seconds
        ttlAutopurge: true,
      }),
    },
  );
}
