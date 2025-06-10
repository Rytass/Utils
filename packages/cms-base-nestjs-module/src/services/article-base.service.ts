/* eslint-disable quotes */
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  DataSource,
  In,
  QueryRunner,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { BaseArticleEntity } from '../models/base-article.entity';
import {
  MultiLanguageArticleCreateDto,
  SingleArticleCreateDto,
  SingleVersionContentCreateDto,
} from '../typings/article-create.dto';
import { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import { BaseArticleVersionContentEntity } from '../models/base-article-version-content.entity';
import {
  ARTICLE_SIGNATURE_SERVICE,
  DRAFT_MODE,
  FULL_TEXT_SEARCH_MODE,
  MULTIPLE_LANGUAGE_MODE,
  RESOLVED_ARTICLE_REPO,
  RESOLVED_ARTICLE_VERSION_CONTENT_REPO,
  RESOLVED_ARTICLE_VERSION_REPO,
  RESOLVED_CATEGORY_REPO,
} from '../typings/cms-base-providers';
import { DEFAULT_LANGUAGE } from '../constants/default-language';
import { ArticleFindAllDto } from '../typings/article-find-all.dto';
import { Language } from '../typings/language';
import {
  ArticleBaseDto,
  MultiLanguageArticleBaseDto,
  SingleArticleBaseDto,
} from '../typings/article-base.dto';
import { BaseCategoryEntity } from '../models/base-category.entity';
import { ArticleSorter } from '../typings/article-sorter.enum';
import { InjectDataSource } from '@nestjs/typeorm';
import { MultipleLanguageModeIsDisabledError } from '../constants/errors/base.errors';
import {
  ArticleNotFoundError,
  ArticleVersionNotFoundError,
} from '../constants/errors/article.errors';
import { CategoryNotFoundError } from '../constants/errors/category.errors';
import { ArticleSearchMode } from '../typings/article-search-mode.enum';
import { QuadratsText } from '@quadrats/core';
import { FULL_TEXT_SEARCH_TOKEN_VERSION } from '../constants/full-text-search-token-version';
import {
  ArticleNotIncludeFields,
  ArticleVersionContentNotIncludeFields,
  ArticleVersionNotIncludeFields,
} from '../constants/not-include-entity-fields';
import { ArticleSignatureService } from './article-signature.service';
import { ArticleFindByIdBaseDto } from '../typings/article-find-by-id.dto';
import { ArticleDefaultQueryBuilderDto } from '../typings/article-default-query-builder.dto';
import { ArticleSignatureResult } from '../typings/article-signature-result.enum';
import {
  ArticleCollectionDto,
  SingleArticleCollectionDto,
} from '../typings/article-collection.dto';
import { ArticleFindVersionType } from '../typings/article-find-version-type.enum';
import { ArticleStage } from '../typings/article-stage.enum';
import { ArticleSignatureDataLoader } from '../data-loaders/article-signature.dataloader';
import {
  removeArticleInvalidFields,
  removeArticleVersionContentInvalidFields,
  removeArticleVersionInvalidFields,
  removeMultipleLanguageArticleVersionInvalidFields,
} from '../utils/remove-invalid-fields';

@Injectable()
export class ArticleBaseService<
  ArticleEntity extends BaseArticleEntity = BaseArticleEntity,
  ArticleVersionEntity extends
    BaseArticleVersionEntity = BaseArticleVersionEntity,
  ArticleVersionContentEntity extends
    BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> implements OnApplicationBootstrap
{
  constructor(
    @Inject(RESOLVED_ARTICLE_REPO)
    private readonly baseArticleRepo: Repository<BaseArticleEntity>,
    @Inject(RESOLVED_ARTICLE_VERSION_REPO)
    private readonly baseArticleVersionRepo: Repository<BaseArticleVersionEntity>,
    @Inject(RESOLVED_ARTICLE_VERSION_CONTENT_REPO)
    private readonly baseArticleVersionContentRepo: Repository<BaseArticleVersionContentEntity>,
    @Inject(RESOLVED_CATEGORY_REPO)
    private readonly baseCategoryRepo: Repository<BaseCategoryEntity>,
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multipleLanguageMode: boolean,
    @Inject(FULL_TEXT_SEARCH_MODE)
    private readonly fullTextSearchMode: boolean,
    @Inject(ARTICLE_SIGNATURE_SERVICE)
    private readonly articleSignatureService: ArticleSignatureService,
    @Inject(DRAFT_MODE)
    private readonly draftMode: boolean,
    @Inject(ArticleSignatureDataLoader)
    private readonly articleSignatureDataLoader: ArticleSignatureDataLoader,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private readonly logger = new Logger(ArticleBaseService.name);

  private queryStagesFeaturesCheck = (stage: ArticleStage) => {
    switch (stage) {
      case ArticleStage.DRAFT:
        if (!this.draftMode) {
          throw new Error('Draft mode is disabled.');
        }

        break;
      case ArticleStage.VERIFIED:
      case ArticleStage.REVIEWING:
        if (!this.articleSignatureService.enabled) {
          throw new Error('Signature mode is disabled.');
        }

        break;

      default:
        break;
    }
  };

  private limitStageWithQueryBuilder(
    qb: SelectQueryBuilder<BaseArticleEntity>,
    stage: ArticleStage,
    signatureLevelId?: string,
  ): SelectQueryBuilder<BaseArticleEntity> {
    switch (stage) {
      case ArticleStage.DRAFT:
        qb.andWhere(`versions.releasedAt IS NULL`);
        qb.andWhere(`versions.submittedAt IS NULL`);
        break;

      case ArticleStage.REVIEWING:
        qb.andWhere(`versions.releasedAt IS NULL`);
        qb.andWhere(`versions.submittedAt IS NOT NULL`);
        qb.leftJoin(
          'versions.signatures',
          'signatures',
          `signatures.result = :result AND signatures."signatureLevelId" = :signatureLevelId`,
          {
            result: ArticleSignatureResult.APPROVED,
            signatureLevelId:
              signatureLevelId ??
              this.articleSignatureService.finalSignatureLevel?.id,
          },
        );

        qb.andWhere('signatures.id IS NULL');

        break;

      case ArticleStage.VERIFIED:
        qb.andWhere(`versions.releasedAt IS NULL`);
        qb.innerJoin(
          'versions.signatures',
          'signatures',
          `signatures.result = :result AND signatures."signatureLevelId" = :signatureLevelId`,
          {
            result: ArticleSignatureResult.APPROVED,
            signatureLevelId:
              this.articleSignatureService.finalSignatureLevel?.id,
          },
        );

        break;

      case ArticleStage.SCHEDULED:
        qb.andWhere(`versions.releasedAt IS NOT NULL`);
        qb.andWhere(`versions.releasedAt > CURRENT_TIMESTAMP`);
        break;

      case ArticleStage.RELEASED:
      default:
        qb.andWhere(`versions.releasedAt IS NOT NULL`);
        qb.andWhere(`versions.releasedAt <= CURRENT_TIMESTAMP`);
        break;
    }

    return qb;
  }

  private getDefaultQueryBuilder<A extends ArticleEntity = ArticleEntity>(
    alias = 'articles',
    options?: ArticleDefaultQueryBuilderDto,
  ): SelectQueryBuilder<A> {
    if (options?.version && options?.stage) {
      this.logger.warn(
        `Combining version and stage filters, only version filter will be applied.`,
      );
    }

    if (options?.stage) {
      this.queryStagesFeaturesCheck(options.stage);
    }

    const qb = this.baseArticleRepo.createQueryBuilder(alias);

    qb.leftJoinAndSelect(`${alias}.categories`, 'categories');
    qb.innerJoinAndSelect(`${alias}.versions`, 'versions');
    qb.innerJoinAndSelect(
      'versions.multiLanguageContents',
      'multiLanguageContents',
    );

    if (options?.version) {
      qb.andWhere('versions.version = :version', {
        version: options.version,
      });
    } else if (options?.stage) {
      this.limitStageWithQueryBuilder(
        qb,
        options.stage,
        options.stage === ArticleStage.REVIEWING
          ? options?.signatureLevel
          : undefined,
      );
    } else {
      qb.innerJoin(
        (subQb) => {
          subQb.from(BaseArticleVersionEntity, 'versions');

          subQb.select('versions.articleId', 'articleId');
          subQb.addSelect('MAX(versions.version)', 'version');
          subQb.groupBy('versions.articleId');

          return subQb;
        },
        'target',
        'target.version = versions.version AND target."articleId" = versions."articleId"',
      );
    }

    return qb as SelectQueryBuilder<A>;
  }

  private async bindSearchTokens<
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(articleContent: AVC, tags?: string[], runner?: QueryRunner): Promise<void> {
    const { cut } = await import('@node-rs/jieba');

    const tokens = cut(
      articleContent.content
        .filter((content) => content.type === 'p')
        .map((content) =>
          content.children
            .filter((child) => (child as QuadratsText).text)
            .map((child) => (child as QuadratsText).text)
            .join('\n'),
        )
        .join('\n'),
    );

    await (runner ?? this.dataSource).query(
      `UPDATE "${this.baseArticleVersionContentRepo.metadata.tableName}" SET
      "searchTokenVersion" = '${FULL_TEXT_SEARCH_TOKEN_VERSION}',
      "searchTokens" = setweight(to_tsvector('simple', $1), 'A') || setweight(to_tsvector('simple', $2), 'B') || setweight(to_tsvector('simple', $3), 'C') || setweight(to_tsvector('simple', $4), 'D')
      WHERE "articleId" = $5 AND "version" = $6 AND "language" = $7`,
      [
        articleContent.title,
        tags?.join(' ') ?? '',
        articleContent.description ?? '',
        tokens.join(' ') ?? '',
        articleContent.articleId,
        articleContent.version,
        articleContent.language,
      ],
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    // Auto indexing if full text search mode enabled
    if (this.fullTextSearchMode) {
      const qb = this.getDefaultQueryBuilder('articles');

      qb.orWhere('multiLanguageContents.searchTokens IS NULL');
      qb.orWhere(
        'multiLanguageContents.searchTokenVersion != :searchTokenVersion',
        {
          searchTokenVersion: FULL_TEXT_SEARCH_TOKEN_VERSION,
        },
      );

      const articles = await qb.getMany();

      if (articles.length) {
        this.logger.log('Start indexing articles...');

        await articles
          .map(
            (article) => () =>
              this.bindSearchTokens<ArticleVersionContentEntity>(
                article.versions[0]
                  .multiLanguageContents[0] as ArticleVersionContentEntity,
                article.versions[0].tags,
              ),
          )
          .reduce((prev, next) => prev.then(next), Promise.resolve());

        this.logger.log('Indexing articles done.');
      }

      await this.dataSource.query(
        `CREATE INDEX IF NOT EXISTS "article_version_contents_search_tokens_idx" ON "${this.baseArticleVersionContentRepo.metadata.tableName}" USING GIN ("searchTokens")`,
      );
    }
  }

  async findById<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options?: ArticleFindByIdBaseDto,
  ): Promise<ArticleBaseDto<A, AV, AVC>>;
  async findById<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options?: ArticleFindByIdBaseDto & { language: Language },
  ): Promise<SingleArticleBaseDto<A, AV, AVC>>;
  async findById<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options?: ArticleFindByIdBaseDto,
  ): Promise<ArticleBaseDto<A, AV, AVC>> {
    if (options?.language && !this.multipleLanguageMode) {
      throw new MultipleLanguageModeIsDisabledError();
    }

    const qb = this.getDefaultQueryBuilder<A>('articles', {
      stage: options?.stage ?? undefined,
      version: options?.version ?? undefined,
    });

    qb.andWhere('articles.id = :id', { id });

    if (options?.language) {
      qb.andWhere('multiLanguageContents.language = :language', {
        language: options.language,
      });
    }

    const article = await qb.getOne();

    if (!article) {
      throw new ArticleNotFoundError();
    }

    if (options?.language || !this.multipleLanguageMode) {
      const languageContent = article.versions[0].multiLanguageContents.find(
        (content) =>
          content.language === (options?.language || DEFAULT_LANGUAGE),
      ) as AVC;

      return {
        ...removeArticleVersionContentInvalidFields<AVC>(languageContent),
        ...removeArticleVersionInvalidFields<AV>(article.versions[0]),
        ...removeArticleInvalidFields<A>(article),
      } as SingleArticleBaseDto<A, AV, AVC>;
    }

    return {
      ...removeMultipleLanguageArticleVersionInvalidFields<AV>(
        article.versions[0],
      ),
      ...removeArticleInvalidFields<A>(article),
    } as MultiLanguageArticleBaseDto<A, AV, AVC>;
  }

  private async getFindAllQueryBuilder<A extends ArticleEntity = ArticleEntity>(
    options?: ArticleFindAllDto & { language: Language },
  ): Promise<SelectQueryBuilder<A>>;
  private async getFindAllQueryBuilder<A extends ArticleEntity = ArticleEntity>(
    options?: ArticleFindAllDto,
  ): Promise<SelectQueryBuilder<A>>;
  private async getFindAllQueryBuilder<A extends ArticleEntity = ArticleEntity>(
    options?: ArticleFindAllDto,
  ): Promise<SelectQueryBuilder<A>> {
    const qb = this.getDefaultQueryBuilder<A>('articles', {
      stage: options?.stage ?? undefined,
      signatureLevel: options?.signatureLevel,
    });

    if (options?.ids?.length) {
      qb.andWhere('articles.id IN (:...ids)', { ids: options.ids });
    }

    if (options?.language) {
      qb.andWhere('multiLanguageContents.language = :language', {
        language: options.language,
      });
    }

    if (options?.requiredCategoryIds?.length) {
      const relationMetadata =
        this.baseArticleRepo.metadata.manyToManyRelations.find(
          (relation) =>
            `${this.baseArticleRepo.metadata.schema}.${relation.propertyPath}` ===
            this.baseCategoryRepo.metadata.tablePath,
        )?.junctionEntityMetadata;

      options?.requiredCategoryIds?.forEach((categoryId, index) => {
        const relationQb = this.dataSource.createQueryBuilder();

        relationQb.from(
          `${this.baseArticleRepo.metadata.schema}.${relationMetadata?.tableName}`,
          `requiredCategoryRelations${index}`,
        );

        relationQb.andWhere(
          `"requiredCategoryRelations${index}"."categoryId" = :requiredCategoryId${index}`,
          {
            [`requiredCategoryId${index}`]: categoryId,
          },
        );

        relationQb.andWhere(
          `"requiredCategoryRelations${index}"."articleId" = articles.id`,
        );

        qb.andWhereExists(relationQb);
      });
    }

    if (options?.categoryIds?.length) {
      const relationMetadata =
        this.baseArticleRepo.metadata.manyToManyRelations.find(
          (relation) =>
            `${this.baseArticleRepo.metadata.schema}.${relation.propertyPath}` ===
            this.baseCategoryRepo.metadata.tablePath,
        )?.junctionEntityMetadata;

      const relationQb = this.dataSource.createQueryBuilder();

      relationQb.from(
        `${this.baseArticleRepo.metadata.schema}.${relationMetadata?.tableName}`,
        `categoryRelations`,
      );

      relationQb.andWhere(
        '"categoryRelations"."categoryId" IN (:...categoryIds)',
        {
          categoryIds: options.categoryIds,
        },
      );

      relationQb.andWhere(`"categoryRelations"."articleId" = articles.id`);

      qb.andWhereExists(relationQb);
    }

    if (options?.searchTerm) {
      switch (options?.searchMode) {
        case ArticleSearchMode.FULL_TEXT: {
          if (!this.fullTextSearchMode)
            throw new Error('Full text search is disabled.');

          const { cut } = await import('@node-rs/jieba');

          const tokens = cut(options.searchTerm.trim());

          const searchQb = this.dataSource.createQueryBuilder();

          searchQb.from(
            `${this.baseArticleVersionContentRepo.metadata.schema}.${this.baseArticleVersionContentRepo.metadata.tableName}`,
            'contents',
          );

          searchQb.andWhere(
            "contents.searchTokens @@ to_tsquery('simple', :searchTerm)",
            {
              searchTerm: tokens.join('|'),
            },
          );

          searchQb.andWhere('contents."entityName" = :entityName', {
            entityName: this.baseArticleVersionContentRepo.metadata.targetName,
          });

          searchQb.andWhere('contents."articleId" = "versions"."articleId"');
          searchQb.andWhere('contents."version" = "versions"."version"');

          qb.andWhereExists(searchQb);

          break;
        }

        case ArticleSearchMode.TITLE_AND_TAG:
        case ArticleSearchMode.TITLE:
        default: {
          const searchQb = this.dataSource.createQueryBuilder();

          searchQb.from(
            `${this.baseArticleVersionContentRepo.metadata.schema}.${this.baseArticleVersionContentRepo.metadata.tableName}`,
            'contents',
          );

          if (options?.searchMode === ArticleSearchMode.TITLE_AND_TAG) {
            searchQb.orWhere(
              ':tagSearchTerm = ANY (SELECT LOWER(value) FROM jsonb_array_elements_text(versions.tags))',
              {
                tagSearchTerm: `${options.searchTerm?.toLocaleLowerCase()}`,
              },
            );
          }

          searchQb.orWhere('contents.title ILIKE :searchTerm', {
            searchTerm: `%${options.searchTerm}%`,
          });

          searchQb.orWhere('contents.description ILIKE :searchTerm', {
            searchTerm: `%${options.searchTerm}%`,
          });

          searchQb.andWhere('contents."entityName" = :entityName', {
            entityName: this.baseArticleVersionContentRepo.metadata.targetName,
          });

          searchQb.andWhere('contents."articleId" = "versions"."articleId"');
          searchQb.andWhere('contents."version" = "versions"."version"');

          qb.andWhereExists(searchQb);

          break;
        }
      }
    }

    switch (options?.sorter) {
      case ArticleSorter.CREATED_AT_ASC:
        qb.addOrderBy('articles.createdAt', 'ASC');
        break;

      case ArticleSorter.CREATED_AT_DESC:
      default:
        qb.addOrderBy('articles.createdAt', 'DESC');
        break;
    }

    return qb;
  }

  async findCollection<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    options?: ArticleFindAllDto & { language: Language },
  ): Promise<SingleArticleCollectionDto<A, AV, AVC>>;
  async findCollection<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(options?: ArticleFindAllDto): Promise<ArticleCollectionDto<A, AV, AVC>>;
  async findCollection<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(options?: ArticleFindAllDto): Promise<ArticleCollectionDto<A, AV, AVC>> {
    if (options?.language && !this.multipleLanguageMode) {
      throw new MultipleLanguageModeIsDisabledError();
    }

    const qb = await this.getFindAllQueryBuilder<A>(options);

    qb.skip(options?.offset ?? 0);
    qb.take(Math.min(options?.limit ?? 20, 100));

    const [articles, total] = await qb.getManyAndCount();

    if (options?.language || !this.multipleLanguageMode) {
      return {
        articles: articles.map((article) => {
          const languageContent =
            article.versions[0].multiLanguageContents.find(
              (content) =>
                content.language === (options?.language || DEFAULT_LANGUAGE),
            ) as AVC;

          return {
            ...removeArticleVersionContentInvalidFields<AVC>(languageContent),
            ...removeArticleVersionInvalidFields<AV>(article.versions[0]),
            ...removeArticleInvalidFields<A>(article),
          };
        }),
        total,
        offset: options?.offset ?? 0,
        limit: Math.min(options?.limit ?? 20, 100),
      } as SingleArticleCollectionDto<A, AV, AVC>;
    }

    return {
      articles: articles.map(
        (article) =>
          ({
            ...removeMultipleLanguageArticleVersionInvalidFields(
              article.versions[0],
            ),
            ...removeArticleInvalidFields(article),
          }) as MultiLanguageArticleBaseDto<A, AV, AVC>,
      ),
      total,
      offset: options?.offset ?? 0,
      limit: Math.min(options?.limit ?? 20, 100),
    };
  }

  async findAll<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    options?: ArticleFindAllDto & { language: Language },
  ): Promise<SingleArticleBaseDto<A, AV, AVC>[]>;
  async findAll<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(options?: ArticleFindAllDto): Promise<ArticleBaseDto<A, AV, AVC>[]>;
  async findAll<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(options?: ArticleFindAllDto): Promise<ArticleBaseDto<A, AV, AVC>[]> {
    if (options?.language && !this.multipleLanguageMode) {
      throw new MultipleLanguageModeIsDisabledError();
    }

    const qb = await this.getFindAllQueryBuilder<A>(options);

    qb.skip(options?.offset ?? 0);
    qb.take(Math.min(options?.limit ?? 20, 100));

    const articles = await qb.getMany();

    if (options?.language || !this.multipleLanguageMode) {
      return articles.map((article) => {
        const languageContent = article.versions[0].multiLanguageContents.find(
          (content) =>
            content.language === (options?.language || DEFAULT_LANGUAGE),
        ) as AVC;

        return {
          ...removeArticleVersionContentInvalidFields<AVC>(languageContent),
          ...removeArticleVersionInvalidFields<AV>(article.versions[0]),
          ...removeArticleInvalidFields<A>(article),
        } as SingleArticleBaseDto<A, AV, AVC>;
      });
    }

    return articles.map(
      (article) =>
        ({
          ...removeMultipleLanguageArticleVersionInvalidFields<AV>(
            article.versions[0],
          ),
          ...removeArticleInvalidFields<A>(article),
        }) as MultiLanguageArticleBaseDto<A, AV, AVC>,
    );
  }

  async deleteVersion(id: string, version: number): Promise<void> {
    const qb = this.baseArticleVersionRepo.createQueryBuilder('versions');

    qb.andWhere('versions.articleId = :id', { id });
    qb.andWhere('versions.version = :version', { version });

    const targetVersion = await qb.getOne();

    if (!targetVersion) {
      throw new ArticleVersionNotFoundError();
    }

    await this.baseArticleVersionRepo.softRemove(targetVersion);
  }

  async archive(id: string): Promise<void> {
    const article = await this.baseArticleRepo.findOne({ where: { id } });

    if (!article) {
      throw new ArticleNotFoundError();
    }

    await this.baseArticleRepo.softDelete(id);
  }

  async withdraw<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(id: string): Promise<ArticleBaseDto<A, AV, AVC>> {
    if (!this.draftMode) {
      throw new Error('Draft mode is disabled.');
    }

    const article = await this.findById<A, AV, AVC>(id, {
      stage: ArticleStage.RELEASED,
    });

    const targetPlaceArticle = await this.findById<A, AV, AVC>(id, {
      stage: this.articleSignatureService.enabled
        ? ArticleStage.VERIFIED
        : ArticleStage.DRAFT,
    }).catch((ex) => null);

    this.logger.debug(`Withdraw article ${id} [${article.version}]`);

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      if (targetPlaceArticle) {
        this.logger.debug(
          `Article ${id} is already in draft or verified [${targetPlaceArticle.version}]. Removing previous version.`,
        );

        await runner.manager.softDelete(BaseArticleVersionEntity, {
          articleId: id,
          version: targetPlaceArticle.version,
        });
      }

      await runner.manager.update(
        BaseArticleVersionEntity,
        {
          articleId: id,
          version: article.version,
        },
        {
          releasedAt: null,
        },
      );

      await runner.commitTransaction();
    } catch (ex) {
      await runner.rollbackTransaction();

      throw ex;
    } finally {
      await runner.release();
    }

    article.releasedAt = null;

    return article;
  }

  async release<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options?: { releasedAt?: Date; version?: number },
  ): Promise<ArticleBaseDto<A, AV, AVC>> {
    const article = await this.findById<A, AV, AVC>(id, {
      version: options?.version ?? undefined,
    });

    let shouldDeleteVersion = null;

    if (options?.version) {
      shouldDeleteVersion = await this.findById(id, {
        stage:
          (options?.releasedAt?.getTime() ?? Date.now()) <= Date.now()
            ? ArticleStage.RELEASED
            : ArticleStage.SCHEDULED,
      }).catch((ex) => null);
    }

    if (article.releasedAt) {
      this.logger.debug(
        `Article ${id} is already released [${article.version}] at ${article.releasedAt}.`,
      );

      return article;
    }

    this.logger.debug(`Release article ${id} [${article.version}]`);

    const willReleasedAt = options?.releasedAt ?? new Date();

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      if (shouldDeleteVersion) {
        this.logger.debug(
          `Article ${id} is already scheduled or released [${shouldDeleteVersion.version}]. Removing previous version.`,
        );

        await runner.manager.softRemove(BaseArticleVersionEntity, {
          articleId: shouldDeleteVersion.id,
          version: shouldDeleteVersion.version,
        });
      }

      await runner.manager.update(
        BaseArticleVersionEntity,
        {
          articleId: id,
          version: article.version,
        },
        {
          releasedAt: willReleasedAt,
        },
      );

      await runner.commitTransaction();
    } catch (ex) {
      await runner.rollbackTransaction();

      throw ex;
    } finally {
      await runner.release();
    }

    article.releasedAt = willReleasedAt;

    return article;
  }

  async submit<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options?: { version?: number; userId?: string },
  ): Promise<ArticleBaseDto<A, AV, AVC>> {
    if (!this.articleSignatureService.enabled) {
      throw new Error('Signature mode is disabled.');
    }

    const article = await this.findById<A, AV, AVC>(id, {
      version: options?.version ?? undefined,
    });

    if (article.submittedAt) {
      throw new BadRequestException(
        `Article ${id} is already submitted [${article.version}] at ${article.submittedAt}.`,
      );
    }

    const pendingReviewArticle = await this.findById<A, AV, AVC>(id, {
      stage: ArticleStage.REVIEWING,
    }).catch((ex) => null);

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      if (pendingReviewArticle) {
        this.logger.debug(
          `Article ${id} is already pending review [${pendingReviewArticle.version}]. Removing previous version.`,
        );

        await runner.manager.softRemove(BaseArticleVersionEntity, {
          articleId: id,
          version: pendingReviewArticle.version,
        });
      }

      await runner.manager.update(
        BaseArticleVersionEntity,
        {
          articleId: id,
          version: article.version,
        },
        {
          submittedAt: new Date(),
          submittedBy: options?.userId ?? undefined,
        },
      );

      await runner.commitTransaction();
    } catch (ex) {
      await runner.rollbackTransaction();

      throw ex;
    } finally {
      await runner.release();
    }

    article.submittedAt = new Date();

    return article;
  }

  async addVersion<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options: Omit<SingleArticleCreateDto<A, AV, AVC>, 'version'>,
  ): Promise<A>;
  async addVersion<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options: Omit<MultiLanguageArticleCreateDto<A, AV, AVC>, 'version'>,
  ): Promise<A>;
  async addVersion<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options: Omit<
      | SingleArticleCreateDto<A, AV, AVC>
      | MultiLanguageArticleCreateDto<A, AV, AVC>,
      'version'
    >,
  ): Promise<A> {
    const targetCategories = options?.categoryIds?.length
      ? await this.baseCategoryRepo.find({
          where: {
            id: In(options.categoryIds),
            bindable: true,
          },
        })
      : [];

    if (targetCategories.length !== (options?.categoryIds?.length ?? 0)) {
      throw new CategoryNotFoundError();
    }

    const article = await this.baseArticleRepo.findOne({
      where: { id },
      relations: ['categories'],
    });

    if (!article) {
      throw new ArticleNotFoundError();
    }

    if (article.categories.length && !options.categoryIds) {
      this.logger.warn(
        `Article ${id} has categories, but no categoryIds provided when add version. The article categories will no change after version added.`,
      );
    }

    const latestQb =
      this.baseArticleVersionRepo.createQueryBuilder('articleVersions');

    latestQb.andWhere('articleVersions.articleId = :id', { id });
    latestQb.addOrderBy('articleVersions.version', 'DESC');

    const latestVersion = await latestQb.getOne();

    if (!latestVersion) {
      throw new ArticleVersionNotFoundError();
    }

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      await runner.manager.save(
        this.baseArticleRepo.create({
          ...article,
          ...removeArticleInvalidFields(options),
          ...(options.categoryIds ? { categories: targetCategories } : {}),
        }),
      );

      const version = this.baseArticleVersionRepo.create({
        ...removeArticleVersionInvalidFields<AV>(options),
        articleId: article.id,
        version: latestVersion.version + 1,
        releasedAt: this.draftMode ? options.releasedAt : new Date(),
      });

      await runner.manager.save(version);

      if ('multiLanguageContents' in options) {
        if (!this.multipleLanguageMode)
          throw new MultipleLanguageModeIsDisabledError();

        const savedContents = await runner.manager.save<AVC>(
          Object.entries(
            options.multiLanguageContents as Record<
              Language,
              SingleVersionContentCreateDto<AVC>
            >,
          ).map(
            ([language, content]) =>
              this.baseArticleVersionContentRepo.create({
                ...removeArticleVersionContentInvalidFields<AVC>(content),
                articleId: article.id,
                version: latestVersion.version + 1,
                language,
              }) as AVC,
          ),
        );

        if (this.fullTextSearchMode) {
          await savedContents
            .map(
              (articleContent) => () =>
                this.bindSearchTokens<AVC>(
                  articleContent as AVC,
                  options.tags ?? [],
                  runner,
                ),
            )
            .reduce((prev, next) => prev.then(next), Promise.resolve());
        }
      } else {
        const savedContent = await runner.manager.save<AVC>(
          this.baseArticleVersionContentRepo.create({
            ...removeArticleVersionContentInvalidFields<AVC>(
              options as SingleArticleCreateDto<A, AV, AVC>,
            ),
            articleId: article.id,
            version: latestVersion.version + 1,
            language: DEFAULT_LANGUAGE,
          }) as AVC,
        );

        if (this.fullTextSearchMode) {
          await this.bindSearchTokens<AVC>(
            savedContent,
            options.tags ?? [],
            runner,
          );
        }
      }

      await runner.commitTransaction();

      return article as A;
    } catch (ex) {
      await runner.rollbackTransaction();

      throw new BadRequestException(ex);
    } finally {
      await runner.release();
    }
  }

  async create<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(options: SingleArticleCreateDto<A, AV, AVC>): Promise<A>;
  async create<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(options: MultiLanguageArticleCreateDto<A, AV, AVC>): Promise<A>;
  async create<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    options:
      | SingleArticleCreateDto<A, AV, AVC>
      | MultiLanguageArticleCreateDto<A, AV, AVC>,
  ): Promise<ArticleBaseDto<A, AV, AVC>> {
    if (options?.submitted && !this.articleSignatureService.enabled) {
      throw new Error('Signature mode is disabled.');
    }

    if (options?.releasedAt && !this.draftMode) {
      throw new Error('Draft mode is disabled.');
    }

    const targetCategories = options?.categoryIds?.length
      ? await this.baseCategoryRepo.find({
          where: {
            id: In(options.categoryIds),
            bindable: true,
          },
        })
      : [];

    if (targetCategories.length !== (options?.categoryIds?.length ?? 0)) {
      throw new CategoryNotFoundError();
    }

    const article = this.baseArticleRepo.create({
      ...removeArticleInvalidFields(options),
      categories: targetCategories,
    });

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      await runner.manager.save(article);

      const version = this.baseArticleVersionRepo.create({
        ...removeArticleVersionInvalidFields<AV>(options),
        articleId: article.id,
        releasedAt: this.draftMode ? options.releasedAt : new Date(),
      });

      await runner.manager.save(version);

      if ('multiLanguageContents' in options) {
        if (!this.multipleLanguageMode)
          throw new MultipleLanguageModeIsDisabledError();

        const savedContents = await runner.manager.save(
          Object.entries(options.multiLanguageContents).map(
            ([language, content]) =>
              this.baseArticleVersionContentRepo.create({
                ...removeArticleVersionContentInvalidFields<AVC>(content),
                articleId: article.id,
                version: version.version,
                language,
              }) as AVC,
          ),
        );

        if (this.fullTextSearchMode) {
          await savedContents
            .map(
              (articleContent) => () =>
                this.bindSearchTokens<AVC>(
                  articleContent,
                  options.tags ?? [],
                  runner,
                ),
            )
            .reduce((prev, next) => prev.then(next), Promise.resolve());
        }
      } else {
        const savedContent = await runner.manager.save(
          this.baseArticleVersionContentRepo.create({
            ...removeArticleVersionContentInvalidFields<AVC>(options),
            articleId: article.id,
            version: version.version,
            language: DEFAULT_LANGUAGE,
          }) as AVC,
        );

        if (this.fullTextSearchMode) {
          await this.bindSearchTokens<AVC>(
            savedContent,
            options.tags ?? [],
            runner,
          );
        }
      }

      await runner.commitTransaction();

      return this.findById<A, AV, AVC>(article.id, {
        version: version.version,
      });
    } catch (ex) {
      await runner.rollbackTransaction();

      throw new BadRequestException(ex);
    } finally {
      await runner.release();
    }
  }
}
