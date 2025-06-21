import { Inject, Injectable } from '@nestjs/common';
import {
  ArticleStage,
  BaseArticleEntity,
  BaseArticleVersionEntity,
  BaseSignatureLevelEntity,
  RESOLVED_ARTICLE_REPO,
} from '@rytass/cms-base-nestjs-module';
import DataLoader from 'dataloader';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { LRUCache } from 'lru-cache';

@Injectable()
export class ArticleStageDataLoader {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(RESOLVED_ARTICLE_REPO)
    private readonly articleRepo: Repository<BaseArticleEntity>,
  ) {}

  private maxSignatureLevelSequence = null;

  public static getArticleStageQueryBuilder(
    qb: SelectQueryBuilder<any>,
    maxSignatureLevelSequence?: number | null,
  ): SelectQueryBuilder<any> {
    qb.select('versions.articleId', 'articleId')
      .addSelect('versions.version', 'articleVersion')
      .from(BaseArticleVersionEntity, 'versions')
      .leftJoin('versions.signatures', 'signatures');

    if (maxSignatureLevelSequence) {
      qb.addSelect(
        `
    CASE
      WHEN versions.deletedAt IS NOT NULL THEN 'DELETED'
      WHEN versions.submittedAt IS NULL THEN 'DRAFT'
      WHEN signatures.result = 'REJECTED' THEN 'DRAFT'
      WHEN signatures.result IS NULL THEN 'REVIEWING'
      WHEN versions.releasedAt IS NULL AND levels.sequence = ${maxSignatureLevelSequence} THEN 'VERIFIED'
      WHEN versions.releasedAt > NOW() AND levels.sequence = ${maxSignatureLevelSequence} THEN 'SCHEDULED'
      WHEN versions.releasedAt <= NOW() AND levels.sequence = ${maxSignatureLevelSequence} THEN 'RELEASED'
      ELSE 'UNKNOWN'
    END`,
        'stage',
      ).leftJoin('signatures.signatureLevel', 'levels');
    } else {
      qb.addSelect(
        `
    CASE
      WHEN versions.deletedAt IS NOT NULL THEN 'DELETED'
      WHEN versions.submittedAt IS NULL THEN 'DRAFT'
      WHEN signatures.result = 'REJECTED' THEN 'DRAFT'
      WHEN signatures.result IS NULL THEN 'REVIEWING'
      WHEN versions.releasedAt IS NULL THEN 'VERIFIED'
      WHEN versions.releasedAt > NOW() THEN 'SCHEDULED'
      WHEN versions.releasedAt <= NOW() THEN 'RELEASED'
      ELSE 'UNKNOWN'
    END`,
        'stage',
      );
    }

    return qb;
  }

  readonly articleStageLoader = new DataLoader<string, ArticleStage>(
    async (ids: readonly string[]): Promise<ArticleStage[]> => {
      if (this.maxSignatureLevelSequence) {
        const sequence = await this.dataSource
          .createQueryBuilder(BaseSignatureLevelEntity, 'signatureLevel')
          .select('MAX("signatureLevel"."sequence")', 'maxSequence')
          .where('"signatureLevel".deletedAt IS NULL')
          .getRawOne();

        this.maxSignatureLevelSequence = sequence?.maxSequence ?? null;
      }

      const qb = this.articleRepo
        .createQueryBuilder('article')
        .innerJoin(
          (qb: any) =>
            ArticleStageDataLoader.getArticleStageQueryBuilder(
              qb,
              this.maxSignatureLevelSequence,
            ),
          'stage',
          'stage."articleId" = article.id',
        );

      qb.andWhere('article.id IN (:...ids)', { ids });

      qb.select('article.id', 'id');
      qb.addSelect('stage.stage', 'stage');

      const articles = await qb.getRawMany();

      const articleMap = new Map(
        articles.map((article) => [article.id, article.stage]),
      );

      return ids.map((id) => articleMap.get(id) ?? ArticleStage.DRAFT);
    },
    {
      cache: true,
      cacheMap: new LRUCache<string, Promise<ArticleStage>>({
        max: 1000,
        ttlAutopurge: true,
        ttl: 1000 * 1, // 1 second
      }),
    },
  );
}
