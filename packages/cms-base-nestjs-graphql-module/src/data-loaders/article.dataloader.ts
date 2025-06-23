import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Brackets, DataSource } from 'typeorm';
import { LRUCache } from 'lru-cache';
import {
  BaseArticleEntity,
  BaseArticleVersionEntity,
  ArticleSignatureEntity,
} from '@rytass/cms-base-nestjs-module';

@Injectable()
export class ArticleDataLoader {
  constructor(private readonly dataSource: DataSource) {}

  readonly articleLoader = new DataLoader<string, BaseArticleEntity | null>(
    async (ids): Promise<(BaseArticleEntity | null)[]> => {
      const qb = this.dataSource.createQueryBuilder(
        BaseArticleEntity,
        'articles',
      );

      qb.where('articles.id IN (:...ids)', { ids });

      const articles = await qb.getMany();

      const articleMap = new Map(
        articles.map((article) => [article.id, article]),
      );

      return ids.map((id) => articleMap.get(id) ?? null);
    },
    {
      cacheMap: new LRUCache<string, Promise<BaseArticleEntity | null>>({
        max: 100,
        ttl: 1000 * 15, // 15 seconds
        ttlAutopurge: true,
      }),
    },
  );

  readonly versionLoader = new DataLoader<
    { id: string; version: number },
    BaseArticleVersionEntity | null,
    string
  >(
    async (args: readonly { id: string; version: number }[]) => {
      const qb = this.dataSource.createQueryBuilder(
        BaseArticleVersionEntity,
        'versions',
      );

      args.forEach(({ id, version }, index) => {
        qb.orWhere(
          new Brackets((subQb) => {
            subQb.andWhere(`versions.articleId = :id_${index}`, {
              [`id_${index}`]: id,
            });

            subQb.andWhere(`versions.version = :version_${index}`, {
              [`version_${index}`]: version,
            });
          }),
        );
      });

      const versions = await qb.getMany();

      const versionMap = new Map(
        versions.map((version) => [
          `${version.articleId}|${version.version}`,
          version,
        ]),
      );

      return args.map(
        ({ id, version }) => versionMap.get(`${id}|${version}`) ?? null,
      );
    },
    {
      cache: true,
      cacheMap: new LRUCache<string, Promise<BaseArticleVersionEntity | null>>({
        max: 100,
        ttl: 1000 * 15, // 15 seconds
        ttlAutopurge: true,
      }),
      cacheKeyFn: (args: { id: string; version: number }) =>
        `${args.id}|${args.version}`,
    },
  );

  readonly signatureLoader = new DataLoader<string, ArticleSignatureEntity[]>(
    async (ids): Promise<ArticleSignatureEntity[][]> => {
      const qb = this.dataSource.createQueryBuilder(
        'ArticleSignatureEntity',
        'signatures',
      );

      qb.leftJoinAndSelect('signatures.signatureLevel', 'signatureLevel');

      qb.where('signatures.articleId IN (:...ids)', { ids });

      const signatures = await qb.getMany();

      const signatureMap = signatures.reduce<
        Record<string, ArticleSignatureEntity[]>
      >(
        (vars, item) => ({
          ...vars,
          [item.articleId]: [...(vars[item.articleId] ?? []), item],
        }),
        {},
      );

      return ids.map((id) => signatureMap[id] ?? []);
    },
    {
      cacheMap: new LRUCache<string, Promise<ArticleSignatureEntity[]>>({
        max: 100,
        ttl: 1000 * 15, // 15 seconds
        ttlAutopurge: true,
      }),
    },
  );
}
