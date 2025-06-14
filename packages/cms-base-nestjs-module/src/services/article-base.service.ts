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
  IsNull,
  LessThanOrEqual,
  Not,
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
  AUTO_RELEASE_AFTER_APPROVED,
  DRAFT_MODE,
  FULL_TEXT_SEARCH_MODE,
  MULTIPLE_LANGUAGE_MODE,
  RESOLVED_ARTICLE_REPO,
  RESOLVED_ARTICLE_VERSION_CONTENT_REPO,
  RESOLVED_ARTICLE_VERSION_REPO,
  RESOLVED_CATEGORY_REPO,
  RESOLVED_SIGNATURE_LEVEL_REPO,
  SIGNATURE_LEVELS,
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
import { ArticleFindByIdBaseDto } from '../typings/article-find-by-id.dto';
import { ArticleDefaultQueryBuilderDto } from '../typings/article-default-query-builder.dto';
import { ArticleSignatureResult } from '../typings/article-signature-result.enum';
import {
  ArticleCollectionDto,
  SingleArticleCollectionDto,
} from '../typings/article-collection.dto';
import { ArticleStage } from '../typings/article-stage.enum';
import {
  removeArticleInvalidFields,
  removeArticleVersionContentInvalidFields,
  removeArticleVersionInvalidFields,
  removeMultipleLanguageArticleVersionInvalidFields,
} from '../utils/remove-invalid-fields';
import {
  ArticleSignatureEntity,
  ArticleSignatureRepo,
} from '../models/base-article-signature.entity';
import { BaseSignatureLevelEntity } from '../models/base-signature-level.entity';
import { SignatureInfoDto } from '../typings/signature-info.dto';

@Injectable()
export class ArticleBaseService<
  ArticleEntity extends BaseArticleEntity = BaseArticleEntity,
  ArticleVersionEntity extends
    BaseArticleVersionEntity = BaseArticleVersionEntity,
  ArticleVersionContentEntity extends
    BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
  SignatureLevelEntity extends
    BaseSignatureLevelEntity = BaseSignatureLevelEntity,
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
    @Inject(DRAFT_MODE)
    private readonly draftMode: boolean,
    @Inject(SIGNATURE_LEVELS)
    private readonly signatureLevels: string[] | SignatureLevelEntity[],
    @Inject(RESOLVED_SIGNATURE_LEVEL_REPO)
    private readonly signatureLevelRepo: Repository<BaseSignatureLevelEntity>,
    @Inject(ArticleSignatureRepo)
    private readonly articleSignatureRepo: Repository<ArticleSignatureEntity>,
    @Inject(AUTO_RELEASE_AFTER_APPROVED)
    private readonly autoReleaseAfterApproved: boolean,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private readonly logger = new Logger(ArticleBaseService.name);

  private get signatureEnabled(): boolean {
    return this.signatureLevels.length > 0;
  }

  private signatureLevelsCache: BaseSignatureLevelEntity[] = [];

  get finalSignatureLevel(): SignatureLevelEntity | null {
    return (this.signatureLevelsCache[this.signatureLevelsCache.length - 1] ??
      null) as SignatureLevelEntity | null;
  }

  private queryStagesFeaturesCheck = (stage: ArticleStage) => {
    switch (stage) {
      case ArticleStage.DRAFT:
        if (!this.draftMode) {
          throw new Error('Draft mode is disabled.');
        }

        break;
      case ArticleStage.VERIFIED:
      case ArticleStage.REVIEWING:
        if (!this.signatureEnabled) {
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
    signatureLevel?: string,
  ): SelectQueryBuilder<BaseArticleEntity> {
    switch (stage) {
      case ArticleStage.DRAFT:
        qb.innerJoin(
          (subQb) => {
            subQb.from(this.baseArticleVersionRepo.target, 'versions');

            subQb.select('versions.articleId', 'articleId');
            subQb.addSelect('versions.version', 'version');
            subQb.addSelect(
              'ROW_NUMBER() OVER (PARTITION BY versions."articleId" ORDER BY versions."createdAt" DESC)',
              'rowIndex',
            );

            subQb.andWhere('versions.releasedAt IS NULL');
            subQb.andWhere('versions.submittedAt IS NULL');

            return subQb;
          },
          'stage_ranked',
          'stage_ranked."articleId" = versions."articleId" AND stage_ranked."version" = versions."version" AND stage_ranked."rowIndex" = 1',
        );

        break;

      case ArticleStage.REVIEWING:
        qb.andWhere(`versions.releasedAt IS NULL`);
        qb.andWhere(`versions.submittedAt IS NOT NULL`);

        qb.leftJoin(
          'versions.signatures',
          'signatures',
          `signatures.result = :result`,
          {
            result: ArticleSignatureResult.APPROVED,
          },
        );

        qb.leftJoin(
          'signatures.signatureLevel',
          'signatureLevel',
          'signatureLevel.name = :signatureLevel',
          {
            signatureLevel: signatureLevel ?? this.finalSignatureLevel?.name,
          },
        );

        qb.andWhere('signatureLevel.id IS NULL');

        break;

      case ArticleStage.VERIFIED:
        qb.andWhere(`versions.releasedAt IS NULL`);
        qb.innerJoin(
          (subQb) => {
            subQb.from(this.articleSignatureRepo.target, 'signatures');
            subQb.innerJoin('signatures.articleVersion', 'articleVersion');

            subQb.select('signatures.articleId', 'articleId');
            subQb.addSelect('signatures.version', 'version');
            subQb.addSelect(
              'ROW_NUMBER() OVER (PARTITION BY signatures."articleId" ORDER BY signatures."signedAt" DESC)',
              'rowIndex',
            );

            subQb.andWhere(
              `signatures.result = :result AND signatures."signatureLevelId" = :signatureLevelId`,
              {
                result: ArticleSignatureResult.APPROVED,
                signatureLevelId: this.finalSignatureLevel?.id,
              },
            );

            return subQb;
          },
          'stage_ranked',
          'stage_ranked."articleId" = versions."articleId" AND stage_ranked."version" = versions."version" AND stage_ranked."rowIndex" = 1',
        );

        break;

      case ArticleStage.SCHEDULED:
        qb.innerJoin(
          (subQb) => {
            subQb.from(this.baseArticleVersionRepo.target, 'versions');

            subQb.select('versions.articleId', 'articleId');
            subQb.addSelect('versions.version', 'version');
            subQb.addSelect(
              'ROW_NUMBER() OVER (PARTITION BY versions."articleId" ORDER BY versions."releasedAt" ASC)',
              'rowIndex',
            );

            subQb.andWhere(`versions.releasedAt IS NOT NULL`);
            subQb.andWhere(`versions.releasedAt > CURRENT_TIMESTAMP`);

            return subQb;
          },
          'stage_ranked',
          'stage_ranked."articleId" = versions."articleId" AND stage_ranked."version" = versions."version" AND stage_ranked."rowIndex" = 1',
        );

        break;

      case ArticleStage.RELEASED:
      default:
        qb.innerJoin(
          (subQb) => {
            subQb.from(this.baseArticleVersionRepo.target, 'versions');

            subQb.select('versions.articleId', 'articleId');
            subQb.addSelect('versions.version', 'version');
            subQb.addSelect(
              'ROW_NUMBER() OVER (PARTITION BY versions."articleId" ORDER BY versions."releasedAt" DESC)',
              'rowIndex',
            );

            subQb.andWhere(`versions.releasedAt IS NOT NULL`);
            subQb.andWhere(`versions.releasedAt <= CURRENT_TIMESTAMP`);

            return subQb;
          },
          'stage_ranked',
          'stage_ranked."articleId" = versions."articleId" AND stage_ranked."version" = versions."version" AND stage_ranked."rowIndex" = 1',
        );

        break;
    }

    return qb;
  }

  private getDefaultQueryBuilder<A extends ArticleEntity = ArticleEntity>(
    alias = 'articles',
    options?: ArticleDefaultQueryBuilderDto,
    runner?: QueryRunner,
  ): SelectQueryBuilder<A> {
    if (options?.version && options?.stage) {
      this.logger.warn(
        `Combining version and stage filters, only version filter will be applied.`,
      );
    }

    if (options?.stage) {
      this.queryStagesFeaturesCheck(options.stage);
    }

    const qb = runner
      ? runner.manager.createQueryBuilder(this.baseArticleRepo.target, alias)
      : this.baseArticleRepo.createQueryBuilder(alias);

    qb.leftJoinAndSelect(`${alias}.categories`, 'categories');
    qb.innerJoinAndSelect(`${alias}.versions`, 'versions');
    qb.innerJoinAndSelect(
      'versions.multiLanguageContents',
      'multiLanguageContents',
    );

    if (options?.version !== undefined) {
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
          subQb.from(this.baseArticleVersionRepo.target, 'versions');

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

    if (this.signatureEnabled) {
      const signatureLevels = await this.signatureLevelRepo.find();

      const existedMap = new Map(
        signatureLevels.map((level) => [level.name, level]),
      );

      const usedSet = new Set<BaseSignatureLevelEntity>();
      const targetLevelNames = new Set(
        this.signatureLevels.map((level) =>
          level instanceof BaseSignatureLevelEntity ? level.name : level,
        ),
      );

      const runner = this.dataSource.createQueryRunner();

      await runner.connect();
      await runner.startTransaction();

      try {
        await signatureLevels
          .filter((level) => !targetLevelNames.has(level.name))
          .map((level) => async () => {
            await runner.manager.delete(this.articleSignatureRepo.target, {
              signatureLevelId: level.id,
            });

            await runner.manager.softDelete(this.signatureLevelRepo.target, {
              id: level.id,
            });
          })
          .reduce((prev, next) => prev.then(next), Promise.resolve());

        this.signatureLevelsCache = await this.signatureLevels
          .map((level, index) => async (levels: BaseSignatureLevelEntity[]) => {
            if (level instanceof BaseSignatureLevelEntity) {
              level.sequence = index;
              level.required = true;

              await runner.manager.save(level);

              usedSet.add(level);

              return [...levels, level];
            }

            if (existedMap.has(level)) {
              const existedLevel = existedMap.get(
                level,
              ) as BaseSignatureLevelEntity;

              existedLevel.sequence = index;
              existedLevel.required = true;

              await runner.manager.save(existedLevel);

              usedSet.add(existedLevel);

              return [...levels, existedLevel];
            }

            const newLevel = this.signatureLevelRepo.create({
              name: level,
              required: true,
              sequence: index,
            });

            await runner.manager.save(newLevel);

            usedSet.add(newLevel);

            return levels;
          })
          .reduce(
            (prev, next) => prev.then(next),
            Promise.resolve([] as BaseSignatureLevelEntity[]),
          );

        await runner.commitTransaction();
      } catch (ex) {
        await runner.rollbackTransaction();

        throw ex;
      } finally {
        await runner.release();
      }
    }
  }

  async findById<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options?: ArticleFindByIdBaseDto,
    runner?: QueryRunner,
  ): Promise<ArticleBaseDto<A, AV, AVC>>;
  async findById<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options?: ArticleFindByIdBaseDto & { language: Language },
    runner?: QueryRunner,
  ): Promise<SingleArticleBaseDto<A, AV, AVC>>;
  async findById<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options?: ArticleFindByIdBaseDto,
    runner?: QueryRunner,
  ): Promise<ArticleBaseDto<A, AV, AVC>> {
    if (options?.language && !this.multipleLanguageMode) {
      throw new MultipleLanguageModeIsDisabledError();
    }

    const qb = this.getDefaultQueryBuilder<A>(
      'articles',
      {
        stage: options?.stage ?? undefined,
        version: options?.version ?? undefined,
      },
      runner,
    );

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
      stage: this.signatureEnabled ? ArticleStage.VERIFIED : ArticleStage.DRAFT,
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

        await runner.manager.softDelete(this.baseArticleVersionRepo.target, {
          articleId: id,
          version: targetPlaceArticle.version,
        });
      }

      await runner.manager.softDelete(this.baseArticleVersionRepo.target, {
        articleId: id,
        releasedAt: LessThanOrEqual(new Date()),
        version: Not(article.version),
      });

      await runner.manager.update(
        this.baseArticleVersionRepo.target,
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

    const shouldDeleteVersion = await this.findById(id, {
      stage:
        (options?.releasedAt?.getTime() ?? Date.now()) <= Date.now()
          ? ArticleStage.RELEASED
          : ArticleStage.SCHEDULED,
    }).catch((ex) => null);

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

        await runner.manager.softRemove(this.baseArticleVersionRepo.target, {
          articleId: shouldDeleteVersion.id,
          version: shouldDeleteVersion.version,
        });
      }

      await runner.manager.update(
        this.baseArticleVersionRepo.target,
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
    if (!this.signatureEnabled) {
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

        await runner.manager.softRemove(this.baseArticleVersionRepo.target, {
          articleId: id,
          version: pendingReviewArticle.version,
        });
      }

      await runner.manager.update(
        this.baseArticleVersionRepo.target,
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

  private getPlacedArticleStage({
    submitted,
    releasedAt,
    signatureLevel,
  }: {
    submitted: boolean;
    releasedAt: Date | null;
    signatureLevel: string | null;
  }) {
    if (submitted) {
      return ArticleStage.REVIEWING;
    }

    if (signatureLevel) {
      if (signatureLevel === this.finalSignatureLevel?.name) {
        return ArticleStage.VERIFIED;
      }

      return ArticleStage.REVIEWING;
    }

    if (releasedAt) {
      if (releasedAt.getTime() > Date.now()) {
        return ArticleStage.SCHEDULED;
      }

      return ArticleStage.RELEASED;
    }

    if (this.draftMode) {
      return ArticleStage.DRAFT;
    }

    return ArticleStage.RELEASED;
  }

  private optionsCheck<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    options: Omit<
      | SingleArticleCreateDto<A, AV, AVC>
      | MultiLanguageArticleCreateDto<A, AV, AVC>,
      'version'
    >,
  ): void {
    if (options.submitted && options.signatureLevel) {
      throw new Error(
        'Signature level is not allowed when submitting an article version.',
      );
    }

    if (options.submitted && options.releasedAt) {
      throw new Error(
        'Released at is not allowed when submitting an article version.',
      );
    }

    if (
      options.releasedAt &&
      options.signatureLevel &&
      this.finalSignatureLevel?.name !== options.signatureLevel
    ) {
      throw new Error(
        'Only final signature level is allowed when releasing an article version.',
      );
    }

    if (options.submitted && !this.signatureEnabled) {
      throw new Error('Signature mode is disabled.');
    }

    if (options.releasedAt && !this.draftMode) {
      throw new Error('Draft mode is disabled.');
    }
  }

  async addVersion<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options: SingleArticleCreateDto<A, AV, AVC> & { id: A['id'] },
  ): Promise<A>;
  async addVersion<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options: MultiLanguageArticleCreateDto<A, AV, AVC> & { id: A['id'] },
  ): Promise<A>;
  async addVersion<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(
    id: string,
    options:
      | (SingleArticleCreateDto<A, AV, AVC> & { id: A['id'] })
      | (MultiLanguageArticleCreateDto<A, AV, AVC> & { id: A['id'] }),
  ): Promise<A> {
    this.optionsCheck<A, AV, AVC>(options);

    const placedArticleStage = this.getPlacedArticleStage({
      submitted: options.submitted ?? false,
      releasedAt: options.releasedAt ?? null,
      signatureLevel: options.signatureLevel ?? null,
    });

    const placedArticle = await this.findById<A, AV, AVC>(id, {
      stage: placedArticleStage,
    }).catch((ex) => null);

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

    latestQb.withDeleted();
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
      if (placedArticle) {
        await runner.manager.softRemove(this.baseArticleVersionRepo.target, {
          articleId: id,
          version: placedArticle.version,
        });
      }

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
        submittedAt:
          options.submitted || options.releasedAt || options.signatureLevel
            ? new Date()
            : null,
        submittedBy:
          options.submitted || options.releasedAt || options.signatureLevel
            ? options.userId
            : undefined,
        releasedAt: this.draftMode ? options.releasedAt : new Date(),
        releasedBy: options.releasedAt ? options.userId : undefined,
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

      if (options.signatureLevel || options.releasedAt) {
        await this.approveVersion(
          {
            id: article.id,
            version: version.version,
          },
          {
            signatureLevel:
              options.signatureLevel ?? this.finalSignatureLevel?.name,
            signerId: options.userId,
            runner,
          },
        );
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
    this.optionsCheck<A, AV, AVC>(options);

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
      ...removeArticleInvalidFields<A>(options as Partial<A>),
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
        submittedAt:
          options.submitted || options.releasedAt || options.signatureLevel
            ? new Date()
            : null,
        submittedBy:
          options.submitted || options.releasedAt || options.signatureLevel
            ? options.userId
            : undefined,
        releasedAt: this.draftMode ? options.releasedAt : new Date(),
        releasedBy: options.releasedAt ? options.userId : undefined,
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

      if (options.signatureLevel || options.releasedAt) {
        await this.approveVersion(
          {
            id: article.id,
            version: version.version,
          },
          {
            signatureLevel:
              options.signatureLevel ?? this.finalSignatureLevel?.name,
            signerId: options.userId,
            runner,
          },
        );
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
  rejectVersion(
    articleVersion: {
      id: string;
      version: number;
    },
    signatureInfo?: SignatureInfoDto<SignatureLevelEntity> & {
      reason?: string | null;
      runner?: QueryRunner;
    },
  ): Promise<ArticleSignatureEntity> {
    return this.signature(
      ArticleSignatureResult.REJECTED,
      articleVersion,
      signatureInfo,
    );
  }

  approveVersion(
    articleVersion: {
      id: string;
      version: number;
    },
    signatureInfo?: SignatureInfoDto<SignatureLevelEntity> & {
      runner?: QueryRunner;
    },
  ): Promise<ArticleSignatureEntity> {
    return this.signature(
      ArticleSignatureResult.APPROVED,
      articleVersion,
      signatureInfo,
    );
  }

  private async signature(
    result: ArticleSignatureResult,
    articleVersion: {
      id: string;
      version: number;
    },
    signatureInfo?: SignatureInfoDto<SignatureLevelEntity> & {
      reason?: string | null;
      runner?: QueryRunner;
    },
  ): Promise<ArticleSignatureEntity> {
    if (!this.signatureEnabled) {
      throw new BadRequestException('Signature is not enabled');
    }

    const placedArticle = await this.findById(
      articleVersion.id,
      {
        stage:
          result === ArticleSignatureResult.APPROVED
            ? (signatureInfo?.signatureLevel ?? this.signatureLevels[0]) ===
              this.finalSignatureLevel?.name
              ? ArticleStage.VERIFIED
              : ArticleStage.REVIEWING
            : ArticleStage.DRAFT,
      },
      signatureInfo?.runner,
    ).catch((ex) => null);

    if (signatureInfo?.runner) {
      if (
        !(await signatureInfo.runner.manager.exists(
          this.baseArticleVersionRepo.target,
          {
            where: {
              articleId: articleVersion.id,
              version: articleVersion.version,
            },
          },
        ))
      ) {
        throw new BadRequestException('Invalid article version');
      }
    } else if (
      !(await this.baseArticleVersionRepo.exists({
        where: {
          articleId: articleVersion.id,
          version: articleVersion.version,
        },
      }))
    ) {
      throw new BadRequestException('Invalid article version');
    }

    if (
      this.signatureLevelsCache.length > 1 &&
      !signatureInfo?.signatureLevel
    ) {
      throw new BadRequestException('Signature level is required');
    }

    const targetLevelIndex = signatureInfo?.signatureLevel
      ? this.signatureLevelsCache.findIndex((level) =>
          signatureInfo.signatureLevel instanceof BaseSignatureLevelEntity
            ? level.id === signatureInfo.signatureLevel.id
            : level.name === signatureInfo.signatureLevel,
        )
      : 0;

    if (signatureInfo?.signatureLevel && !~targetLevelIndex) {
      throw new BadRequestException('Invalid signature level');
    }

    const runner = signatureInfo?.runner ?? this.dataSource.createQueryRunner();

    if (!signatureInfo?.runner) {
      await runner.connect();
      await runner.startTransaction();
    }

    try {
      const qb = runner.manager.createQueryBuilder(
        this.articleSignatureRepo.target,
        'signatures',
      );

      qb.andWhere('signatures.articleId = :articleId', {
        articleId: articleVersion.id,
      });

      qb.andWhere('signatures.version = :version', {
        version: articleVersion.version,
      });

      qb.setLock('pessimistic_write');

      const signatures = await qb.getMany();

      if (!Number.isNaN(targetLevelIndex)) {
        const signatureMap = new Map(
          signatures.map((signature) => [
            signature.signatureLevelId,
            signature,
          ]),
        );

        const needSignTargets = this.signatureLevelsCache
          .slice(0, targetLevelIndex + 1)
          .map((level) => signatureMap.get(level.id) ?? null);

        const targetSignature = needSignTargets[targetLevelIndex];

        if (targetSignature) {
          if (targetSignature.result === ArticleSignatureResult.REJECTED) {
            await runner.manager.softDelete(this.articleSignatureRepo.target, {
              id: targetSignature.id,
            });
          } else {
            throw new BadRequestException('Already signed');
          }
        }

        if (targetLevelIndex > 0) {
          const previousSignature = needSignTargets[targetLevelIndex - 1];
          const previousRequiredSignatureLevels = this.signatureLevelsCache
            .slice(0, targetLevelIndex)
            .filter((level) => level.required);

          const latestRequireSignatureLevel =
            previousRequiredSignatureLevels[
              previousRequiredSignatureLevels.length - 1
            ];

          if (
            previousSignature &&
            previousSignature.result !== ArticleSignatureResult.APPROVED
          ) {
            throw new BadRequestException('Previous valid signature not found');
          }

          const latestRequireSignature = signatureMap.get(
            latestRequireSignatureLevel.id,
          );

          if (!latestRequireSignature) {
            throw new BadRequestException('Previous valid signature not found');
          }
        }

        const signature = this.articleSignatureRepo.create({
          articleId: articleVersion.id,
          version: articleVersion.version,
          signatureLevelId: this.signatureLevelsCache[targetLevelIndex].id,
          result,
          signerId: signatureInfo?.signerId ?? null,
          rejectReason:
            result === ArticleSignatureResult.REJECTED
              ? (signatureInfo?.reason ?? null)
              : null,
        });

        if (
          this.draftMode &&
          this.autoReleaseAfterApproved &&
          this.signatureLevelsCache[targetLevelIndex].id ===
            this.finalSignatureLevel?.id
        ) {
          await runner.manager.update(
            this.baseArticleVersionRepo.target,
            {
              id: articleVersion.id,
              version: articleVersion.version,
              releasedAt: IsNull(),
            },
            {
              releasedAt: new Date(),
            },
          );
        }

        await runner.manager.save(signature);

        if (placedArticle) {
          await runner.manager.softDelete(this.baseArticleVersionRepo.target, {
            articleId: placedArticle.id,
            version: placedArticle.version,
          });
        }

        if (!signatureInfo?.runner) {
          await runner.commitTransaction();
        }

        return signature;
      } else if (signatures.length) {
        throw new BadRequestException('Already signed');
      }

      const signature = this.articleSignatureRepo.create({
        articleId: articleVersion.id,
        version: articleVersion.version,
        result,
        signerId: signatureInfo?.signerId ?? null,
        rejectReason:
          result === ArticleSignatureResult.REJECTED
            ? (signatureInfo?.reason ?? null)
            : null,
      });

      if (this.draftMode && this.autoReleaseAfterApproved) {
        await runner.manager.update(
          this.baseArticleVersionRepo.target,
          {
            id: articleVersion.id,
            version: articleVersion.version,
            releasedAt: IsNull(),
          },
          {
            releasedAt: new Date(),
          },
        );
      }

      await runner.manager.save(signature);

      if (placedArticle) {
        await runner.manager.softDelete(this.baseArticleVersionRepo.target, {
          articleId: placedArticle.id,
          version: placedArticle.version,
        });
      }

      if (!signatureInfo?.runner) {
        await runner.commitTransaction();
      }

      return signature;
    } catch (ex) {
      if (!signatureInfo?.runner) {
        await runner.rollbackTransaction();
      }

      throw ex;
    } finally {
      if (!signatureInfo?.runner) {
        await runner.release();
      }
    }
  }

  async refreshSignatureLevelsCache(): Promise<void> {
    this.signatureLevelsCache = (await (
      this.signatureLevelRepo as Repository<BaseSignatureLevelEntity>
    ).find({
      order: { sequence: 'ASC' },
    })) as SignatureLevelEntity[];
  }
}
