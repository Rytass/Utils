import { Inject, Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Repository } from 'typeorm';
import { LRUCache } from 'lru-cache';
import { BaseArticleEntity, DEFAULT_LANGUAGE, RESOLVED_ARTICLE_REPO } from '@rytass/cms-base-nestjs-module';
import { CategoryDto } from '../dto/category.dto';

@Injectable()
export class ArticleDataLoader {
  constructor(
    @Inject(RESOLVED_ARTICLE_REPO)
    private readonly articleRepo: Repository<BaseArticleEntity>,
  ) {}

  private readonly batchLoadCategories = async (
    queryArgs: readonly {
      articleId: string;
      language?: string;
    }[],
  ): Promise<CategoryDto[][]> => {
    const qb = this.articleRepo.createQueryBuilder('articles');

    qb.leftJoinAndSelect('articles.categories', 'categories');
    qb.leftJoinAndSelect('categories.multiLanguageNames', 'multiLanguageNames');

    qb.andWhere('articles.id IN (:...ids)', {
      ids: queryArgs.map(arg => arg.articleId),
    });

    const articles = await qb.getMany();

    const categoryMap = articles.reduce<Record<string, CategoryDto[]>>(
      (vars, article) =>
        article.categories.reduce(
          (cVars, category) =>
            category.multiLanguageNames.reduce(
              (mVars, multiLanguageName) => ({
                ...mVars,
                [`${article.id}:${multiLanguageName.language}`]: [
                  ...(mVars[`${article.id}:${multiLanguageName.language}`] || []),
                  {
                    ...category,
                    ...multiLanguageName,
                  },
                ],
              }),
              cVars,
            ),
          vars,
        ),
      {},
    );

    return queryArgs.map(arg => categoryMap[`${arg.articleId}:${arg.language ?? DEFAULT_LANGUAGE}`] ?? []);
  };

  readonly categoriesLoader = new DataLoader<
    {
      articleId: string;
      language?: string;
    },
    CategoryDto[],
    string
  >(this.batchLoadCategories, {
    cache: true,
    cacheMap: new LRUCache<string, Promise<CategoryDto[]>>({
      ttl: 1000 * 60, // 1 minute
      ttlAutopurge: true,
      max: 1000,
    }),
    cacheKeyFn: (queryArgs): string => `${queryArgs.articleId}:${queryArgs.language ?? DEFAULT_LANGUAGE}`,
  });

  readonly categoriesLoaderNoCache = new DataLoader<
    {
      articleId: string;
      language?: string;
    },
    CategoryDto[],
    string
  >(this.batchLoadCategories, {
    cache: false,
  });
}
