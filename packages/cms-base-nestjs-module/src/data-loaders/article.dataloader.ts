import { Inject, Injectable } from '@nestjs/common';
import {
  RESOLVED_ARTICLE_REPO,
  RESOLVED_ARTICLE_VERSION_REPO,
} from '../typings/cms-base-providers';
import { BaseArticleEntity } from '../models/base-article.entity';
import { Brackets, Repository } from 'typeorm';
import DataLoader from 'dataloader';
import { BaseCategoryEntity } from '../models/base-category.entity';
import { LRUCache } from 'lru-cache';
import { ArticleStage } from '../typings/article-stage.enum';
import { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import { SignatureService } from '../services/signature.service';
import { ArticleSignatureResult } from '../typings/article-signature-result.enum';

@Injectable()
export class ArticleDataLoader {
  constructor(
    @Inject(RESOLVED_ARTICLE_REPO)
    private readonly articleRepo: Repository<BaseArticleEntity>,
    @Inject(RESOLVED_ARTICLE_VERSION_REPO)
    private readonly articleVersionRepo: Repository<BaseArticleVersionEntity>,
    private readonly signatureService: SignatureService,
  ) {}

  readonly stageCache = new LRUCache<string, Promise<ArticleStage>>({
    ttl: 1000 * 5, // 5 seconds
    ttlAutopurge: true,
    max: 1000,
  });

  readonly stageLoader = new DataLoader<
    {
      id: string;
      version: number;
    },
    ArticleStage,
    string
  >(
    async (
      queryArgs: readonly {
        id: string;
        version: number;
      }[],
    ): Promise<ArticleStage[]> => {
      const qb = this.articleVersionRepo.createQueryBuilder('versions');

      qb.withDeleted();
      qb.leftJoinAndSelect('versions.signatures', 'signatures');

      qb.andWhere(
        new Brackets((subQb) => {
          queryArgs.forEach((args, index) => {
            subQb.orWhere(
              `versions.articleId = :id_${index} AND versions.version = :version_${index}`,
              {
                [`id_${index}`]: args.id,
                [`version_${index}`]: args.version,
              },
            );
          });

          return subQb;
        }),
      );

      const versions = await qb.getMany();

      const versionMap = new Map(
        versions.map((version) => [
          `${version.articleId}:${version.version}`,
          (() => {
            if (version.deletedAt) return ArticleStage.DELETED;

            if (version.releasedAt) {
              if (version.releasedAt.getTime() > Date.now()) {
                return ArticleStage.SCHEDULED;
              }

              return ArticleStage.RELEASED;
            }

            if (
              version.signatures.some(
                (sig) =>
                  sig.result === ArticleSignatureResult.APPROVED &&
                  sig.deletedAt === null &&
                  sig.signatureLevelId ===
                    this.signatureService.finalSignatureLevel?.id,
              )
            ) {
              return ArticleStage.VERIFIED;
            }

            if (
              version.submittedAt &&
              !version.signatures.some(
                (sig) => sig.result === ArticleSignatureResult.REJECTED,
              )
            ) {
              return ArticleStage.REVIEWING;
            }

            return ArticleStage.DRAFT;
          })(),
        ]),
      );

      return queryArgs.map(
        (args) =>
          versionMap.get(`${args.id}:${args.version}`) ?? ArticleStage.UNKNOWN,
      );
    },
    {
      cache: true,
      cacheMap: this.stageCache,
      cacheKeyFn: (queryArgs) => `${queryArgs.id}:${queryArgs.version}`,
    },
  );

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
