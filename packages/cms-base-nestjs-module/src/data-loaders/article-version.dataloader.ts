import { Inject, Injectable } from '@nestjs/common';
import {
  MULTIPLE_LANGUAGE_MODE,
  RESOLVED_ARTICLE_REPO,
} from '../typings/cms-base-providers';
import { Repository } from 'typeorm';
import { ArticleBaseDto } from '../typings/article-base.dto';
import DataLoader from 'dataloader';
import { BaseArticleEntity } from '../models/base-article.entity';
import { BaseArticleVersionContentEntity } from '../models/base-article-version-content.entity';
import { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import {
  removeArticleInvalidFields,
  removeArticleVersionContentInvalidFields,
  removeArticleVersionInvalidFields,
  removeMultipleLanguageArticleVersionInvalidFields,
} from '../utils/remove-invalid-fields';
import { DEFAULT_LANGUAGE } from '../constants/default-language';
import { LRUCache } from 'lru-cache';
import { ArticleStage } from '../typings/article-stage.enum';
import { SignatureService } from '../services/signature.service';
import { ArticleSignatureResult } from '../typings/article-signature-result.enum';

@Injectable()
export class ArticleVersionDataLoader<
  A extends BaseArticleEntity = BaseArticleEntity,
  AV extends BaseArticleVersionEntity = BaseArticleVersionEntity,
  AVC extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> {
  constructor(
    @Inject(RESOLVED_ARTICLE_REPO)
    private readonly articleRepo: Repository<BaseArticleEntity>,
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multipleLanguageMode: boolean,
    private readonly signatureService: SignatureService,
  ) {}

  readonly stageVersionsLoader = new DataLoader<
    string,
    Record<ArticleStage, ArticleBaseDto<A, AV, AVC> | null>
  >(
    async (
      ids: readonly string[],
    ): Promise<Record<ArticleStage, ArticleBaseDto<A, AV, AVC> | null>[]> => {
      const qb = this.articleRepo.createQueryBuilder('articles');

      qb.innerJoinAndSelect('articles.versions', 'versions');
      qb.leftJoinAndSelect('versions.signatures', 'signatures');
      qb.leftJoinAndSelect(
        'versions.multiLanguageContents',
        'multiLanguageContents',
      );

      qb.andWhere('versions.articleId IN (:...ids)', {
        ids: ids,
      });

      const articles = await qb.getMany();

      const articleMap = new Map(
        articles.map((article) => [
          article.id,
          article.versions.reduce(
            (
              vars,
              version,
            ): Record<ArticleStage, ArticleBaseDto<A, AV, AVC> | null> => {
              const articleVersion = (
                this.multipleLanguageMode
                  ? {
                      ...removeMultipleLanguageArticleVersionInvalidFields<AV>(
                        version,
                      ),
                      ...removeArticleInvalidFields<A>(article as Partial<A>),
                      id: article.id,
                      createdAt: article.createdAt,
                      updatedAt: article.versions[0].createdAt,
                      deletedAt: article.deletedAt,
                      updatedBy: article.versions[0].createdBy,
                    }
                  : {
                      ...removeArticleVersionContentInvalidFields<AVC>(
                        version.multiLanguageContents.find(
                          (content) => content.language === DEFAULT_LANGUAGE,
                        ) as AVC,
                      ),
                      ...removeArticleVersionInvalidFields<AV>(version),
                      ...removeArticleInvalidFields<A>(article as Partial<A>),
                      id: article.id,
                      createdAt: article.createdAt,
                      updatedAt: version.createdAt,
                      deletedAt: article.deletedAt,
                      updatedBy: version.createdBy,
                    }
              ) as ArticleBaseDto<A, AV, AVC>;

              if (version.releasedAt) {
                if (version.releasedAt.getTime() > Date.now()) {
                  return {
                    ...vars,
                    [ArticleStage.SCHEDULED]: articleVersion,
                  };
                }

                return {
                  ...vars,
                  [ArticleStage.RELEASED]: articleVersion,
                };
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
                return {
                  ...vars,
                  [ArticleStage.VERIFIED]: articleVersion,
                };
              }

              if (version.submittedAt) {
                return {
                  ...vars,
                  [ArticleStage.REVIEWING]: articleVersion,
                };
              }

              return {
                ...vars,
                [ArticleStage.DRAFT]: articleVersion,
              };
            },
            {
              [ArticleStage.DRAFT]: null,
              [ArticleStage.REVIEWING]: null,
              [ArticleStage.VERIFIED]: null,
              [ArticleStage.SCHEDULED]: null,
              [ArticleStage.RELEASED]: null,
            } as Record<ArticleStage, ArticleBaseDto<A, AV, AVC> | null>,
          ),
        ]),
      );

      return ids.map(
        (id) =>
          articleMap.get(id) as Record<
            ArticleStage,
            ArticleBaseDto<A, AV, AVC> | null
          >,
      );
    },
    {
      cache: true,
      cacheMap: new LRUCache<
        string,
        Promise<Record<ArticleStage, ArticleBaseDto<A, AV, AVC> | null>>
      >({
        ttl: 1000 * 10, // Cache for 10 seconds
        max: 1000, // Maximum number of items in cache
        ttlAutopurge: true,
      }),
    },
  );

  readonly versionsLoader = new DataLoader<
    string,
    ArticleBaseDto<A, AV, AVC>[]
  >(
    async (ids: readonly string[]): Promise<ArticleBaseDto<A, AV, AVC>[][]> => {
      const qb = this.articleRepo.createQueryBuilder('articles');

      qb.withDeleted();
      qb.innerJoinAndSelect('articles.versions', 'versions');
      qb.leftJoinAndSelect('versions.signatures', 'signatures');
      qb.leftJoinAndSelect(
        'versions.multiLanguageContents',
        'multiLanguageContents',
      );

      qb.andWhere('versions.articleId IN (:...ids)', {
        ids: ids,
      });

      qb.addOrderBy('versions.version', 'ASC');

      const articles = await qb.getMany();

      const articleMap = new Map(
        articles.map((article) => [
          article.id,
          article.versions.map((version) =>
            this.multipleLanguageMode
              ? {
                  ...removeMultipleLanguageArticleVersionInvalidFields<AV>(
                    version,
                  ),
                  ...removeArticleInvalidFields<A>(article as Partial<A>),
                  id: article.id,
                  createdAt: article.createdAt,
                  updatedAt: article.versions[0].createdAt,
                  deletedAt: article.deletedAt,
                  updatedBy: article.versions[0].createdBy,
                }
              : {
                  ...removeArticleVersionContentInvalidFields<AVC>(
                    version.multiLanguageContents.find(
                      (content) => content.language === DEFAULT_LANGUAGE,
                    ) as AVC,
                  ),
                  ...removeArticleVersionInvalidFields<AV>(version),
                  ...removeArticleInvalidFields<A>(article as Partial<A>),
                  id: article.id,
                  createdAt: article.createdAt,
                  updatedAt: version.createdAt,
                  deletedAt: article.deletedAt,
                  updatedBy: version.createdBy,
                },
          ) as ArticleBaseDto<A, AV, AVC>[],
        ]),
      );

      return ids.map((id) => articleMap.get(id) || []);
    },
    {
      cache: true,
      cacheMap: new LRUCache<string, Promise<ArticleBaseDto<A, AV, AVC>[]>>({
        ttl: 1000 * 10, // Cache for 10 seconds
        max: 1000, // Maximum number of items in cache
        ttlAutopurge: true,
      }),
    },
  );
}
