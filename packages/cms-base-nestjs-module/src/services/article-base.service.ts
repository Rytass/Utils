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
  ENABLE_SIGNATURE_MODE,
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
    @Inject(ENABLE_SIGNATURE_MODE)
    private readonly signatureMode: boolean,
    @Inject(ARTICLE_SIGNATURE_SERVICE)
    private readonly articleSignatureService: ArticleSignatureService,
    @Inject(DRAFT_MODE)
    private readonly draftMode: boolean,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private readonly logger = new Logger(ArticleBaseService.name);

  private getDefaultQueryBuilder<A extends ArticleEntity = ArticleEntity>(
    alias = 'articles',
    options?: ArticleDefaultQueryBuilderDto,
  ): SelectQueryBuilder<A> {
    const qb = this.baseArticleRepo.createQueryBuilder(alias);

    qb.leftJoinAndSelect(`${alias}.categories`, 'categories');
    qb.innerJoinAndSelect(`${alias}.versions`, 'versions');
    qb.innerJoinAndSelect(
      'versions.multiLanguageContents',
      'multiLanguageContents',
    );

    qb.innerJoin(
      (subQb) => {
        subQb.from(BaseArticleVersionEntity, 'versions');

        subQb.select('versions.articleId', 'articleId');
        subQb.addSelect('MAX(versions.version)', 'version');
        subQb.groupBy('versions.articleId');

        if (
          this.draftMode &&
          options?.versionType === ArticleFindVersionType.RELEASED
        ) {
          subQb.andWhere('versions.releasedAt IS NOT NULL');
        }

        if (this.signatureMode && options?.onlyApproved) {
          subQb.innerJoin('versions.signatures', 'signatures');
          subQb.andWhere('signatures.result = :result', {
            result: ArticleSignatureResult.APPROVED,
          });

          const latestId = this.articleSignatureService.finalSignatureLevel?.id;

          if (latestId) {
            subQb.andWhere('signatures.signatureLevelId = :signatureLevelId', {
              signatureLevelId: latestId,
            });
          } else {
            subQb.andWhere('signatures.signatureLevelId IS NULL');
          }
        }

        return subQb;
      },
      'target',
      'target.version = versions.version AND target."articleId" = versions."articleId"',
    );

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
      versionType:
        (this.draftMode
          ? options?.versionType
          : ArticleFindVersionType.RELEASED) ?? ArticleFindVersionType.RELEASED,
      onlyApproved: options?.onlyApproved,
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
      const defaultContent = article.versions[0].multiLanguageContents.find(
        (content) =>
          content.language === (options?.language || DEFAULT_LANGUAGE),
      ) as AVC;

      return {
        ...article,
        versions: undefined,
        ...defaultContent,
        id: article.id,
        version: article.versions[0].version,
        tags: article.versions[0].tags,
      };
    }

    return {
      ...article,
      versions: undefined,
      id: article.id,
      tags: article.versions[0].tags,
      version: article.versions[0].version,
      multiLanguageContents: article.versions[0].multiLanguageContents as AVC[],
    };
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
      versionType:
        (this.draftMode
          ? options?.versionType
          : ArticleFindVersionType.RELEASED) ?? ArticleFindVersionType.RELEASED,
      onlyApproved: options?.onlyApproved,
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
          const defaultContent = article.versions[0].multiLanguageContents.find(
            (content) =>
              content.language === (options?.language || DEFAULT_LANGUAGE),
          ) as AVC;

          return {
            ...article,
            versions: undefined,
            ...defaultContent,
            id: article.id,
            tags: article.versions[0].tags,
          };
        }),
        total,
        offset: options?.offset ?? 0,
        limit: Math.min(options?.limit ?? 20, 100),
      };
    }

    return {
      articles: articles.map(
        (article) =>
          ({
            ...article,
            versions: undefined,
            version: article.versions[0].version,
            tags: article.versions[0].tags,
            multiLanguageContents: article.versions[0]
              .multiLanguageContents as AVC[],
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
        const defaultContent = article.versions[0].multiLanguageContents.find(
          (content) =>
            content.language === (options?.language || DEFAULT_LANGUAGE),
        ) as AVC;

        return {
          ...article,
          versions: undefined,
          ...defaultContent,
          id: article.id,
          tags: article.versions[0].tags,
        };
      });
    }

    return articles.map(
      (article) =>
        ({
          ...article,
          versions: undefined,
          version: article.versions[0].version,
          tags: article.versions[0].tags,
          multiLanguageContents: article.versions[0]
            .multiLanguageContents as AVC[],
        }) as MultiLanguageArticleBaseDto<A, AV, AVC>,
    );
  }

  async archive(id: string): Promise<void> {
    const article = await this.baseArticleRepo.findOne({ where: { id } });

    if (!article) {
      throw new ArticleNotFoundError();
    }

    await this.baseArticleRepo.softDelete(id);
  }

  async release<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(id: string, releasedAt?: Date): Promise<ArticleBaseDto<A, AV, AVC>> {
    if (!this.draftMode) {
      throw new Error('Draft mode is disabled.');
    }

    const article = await this.findById<A, AV, AVC>(id, {
      versionType: ArticleFindVersionType.LATEST,
    });

    if (article.releasedAt) {
      this.logger.debug(
        `Article ${id} is already released [${article.version}] at ${article.releasedAt}.`,
      );

      return article;
    }

    this.logger.debug(`Release article ${id} [${article.version}]`);

    const willReleasedAt = releasedAt ?? new Date();

    await this.baseArticleVersionRepo.update(
      {
        articleId: id,
        version: article.version,
      },
      {
        releasedAt: willReleasedAt,
      },
    );

    article.releasedAt = willReleasedAt;

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
          ...Object.entries(options)
            .filter(([key]) => !~ArticleNotIncludeFields.indexOf(key))
            .reduce(
              (vars, [key, value]) => ({
                ...vars,
                [key]: value,
              }),
              {},
            ),
          ...(options.categoryIds ? { categories: targetCategories } : {}),
        }),
      );

      const version = this.baseArticleVersionRepo.create({
        ...Object.entries(options)
          .filter(([key]) => !~ArticleVersionNotIncludeFields.indexOf(key))
          .reduce(
            (vars, [key, value]) => ({
              ...vars,
              [key]: value,
            }),
            {},
          ),
        articleId: article.id,
        version: latestVersion.version + 1,
        tags: options.tags ?? [],
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
                ...content,
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
            ...Object.entries(options)
              .filter(
                ([key]) => !~ArticleVersionContentNotIncludeFields.indexOf(key),
              )
              .reduce(
                (vars, [key, value]) => ({
                  ...vars,
                  [key]: value,
                }),
                {},
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

    const article = this.baseArticleRepo.create({
      ...Object.entries(options)
        .filter(([key]) => !~ArticleNotIncludeFields.indexOf(key))
        .reduce(
          (vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }),
          {},
        ),
      categories: targetCategories,
    });

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      await runner.manager.save(article);

      const version = this.baseArticleVersionRepo.create({
        ...Object.entries(options)
          .filter(([key]) => !~ArticleVersionNotIncludeFields.indexOf(key))
          .reduce(
            (vars, [key, value]) => ({
              ...vars,
              [key]: value,
            }),
            {},
          ),
        articleId: article.id,
        tags: options.tags ?? [],
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
                ...content,
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
            ...Object.entries(options)
              .filter(
                ([key]) => !~ArticleVersionContentNotIncludeFields.indexOf(key),
              )
              .reduce(
                (vars, [key, value]) => ({
                  ...vars,
                  [key]: value,
                }),
                {},
              ),
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

      return article as A;
    } catch (ex) {
      await runner.rollbackTransaction();

      throw new BadRequestException(ex);
    } finally {
      await runner.release();
    }
  }
}
