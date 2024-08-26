/* eslint-disable quotes */
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  Brackets,
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private readonly logger = new Logger(ArticleBaseService.name);

  private getDefaultQueryBuilder<A extends ArticleEntity = ArticleEntity>(
    alias = 'articles',
    onlyLatest = false,
  ): SelectQueryBuilder<A> {
    const qb = this.baseArticleRepo.createQueryBuilder(alias);

    qb.leftJoinAndSelect(`${alias}.categories`, 'categories');
    qb.innerJoinAndSelect(`${alias}.versions`, 'versions');
    qb.innerJoinAndSelect(
      'versions.multiLanguageContents',
      'multiLanguageContents',
    );

    if (onlyLatest) {
      // Latest version
      qb.innerJoin(
        (subQb) => {
          subQb.from(BaseArticleVersionEntity, 'versions');

          subQb.select('versions.articleId', 'articleId');
          subQb.addSelect('MAX(versions.version)', 'version');
          subQb.groupBy('versions.articleId');

          return subQb;
        },
        'latest',
        'latest.version = versions.version AND latest."articleId" = versions."articleId"',
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
  >(id: string): Promise<ArticleBaseDto<A, AV, AVC>>;
  async findById<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(id: string, language: Language): Promise<SingleArticleBaseDto<A, AV, AVC>>;
  async findById<
    A extends ArticleEntity = ArticleEntity,
    AV extends ArticleVersionEntity = ArticleVersionEntity,
    AVC extends ArticleVersionContentEntity = ArticleVersionContentEntity,
  >(id: string, language?: Language): Promise<ArticleBaseDto<A, AV, AVC>> {
    if (language && !this.multipleLanguageMode) {
      throw new MultipleLanguageModeIsDisabledError();
    }

    const qb = this.getDefaultQueryBuilder<A>('articles', true);

    qb.andWhere('articles.id = :id', { id });

    if (language) {
      qb.andWhere('multiLanguageContents.language = :language', { language });
    }

    const article = await qb.getOne();

    if (!article) {
      throw new ArticleNotFoundError();
    }

    if (language || !this.multipleLanguageMode) {
      const defaultContent = article.versions[0].multiLanguageContents.find(
        (content) => content.language === (language || DEFAULT_LANGUAGE),
      ) as AVC;

      return {
        ...article,
        versions: undefined,
        ...defaultContent,
        id: article.id,
        tags: article.versions[0].tags,
      };
    }

    return {
      ...article,
      versions: undefined,
      id: article.id,
      tags: article.versions[0].tags,
      multiLanguageContents: article.versions[0].multiLanguageContents as AVC[],
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

    const qb = this.getDefaultQueryBuilder<A>('articles', true);

    if (options?.ids?.length) {
      qb.andWhere('articles.id IN (:...ids)', { ids: options.ids });
    }

    if (options?.language) {
      qb.andWhere('multiLanguageContents.language = :language', {
        language: options.language,
      });
    }

    if (options?.categoryIds?.length) {
      qb.andWhere('categories.id IN (:...categoryIds)', {
        categoryIds: options.categoryIds,
      });
    }

    if (options?.searchTerm) {
      switch (options?.searchMode) {
        case ArticleSearchMode.FULL_TEXT: {
          if (!this.fullTextSearchMode)
            throw new Error('Full text search is disabled.');

          const { cut } = await import('@node-rs/jieba');

          const tokens = cut(options.searchTerm.trim());

          qb.andWhere(
            "multiLanguageContents.searchTokens @@ to_tsquery('simple', :searchTerm)",
            {
              searchTerm: tokens.join('|'),
            },
          );

          break;
        }

        case ArticleSearchMode.TITLE:
        default:
          qb.andWhere(
            new Brackets((subQb) => {
              subQb.orWhere('multiLanguageContents.title ILIKE :searchTerm', {
                searchTerm: `%${options.searchTerm}%`,
              });

              subQb.orWhere(
                'multiLanguageContents.description ILIKE :searchTerm',
                {
                  searchTerm: `%${options.searchTerm}%`,
                },
              );

              return subQb;
            }),
          );

          break;
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
        tags: options.tags,
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
                  options.tags,
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
          await this.bindSearchTokens<AVC>(savedContent, options.tags, runner);
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
        tags: options.tags,
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
                  options.tags,
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
          await this.bindSearchTokens<AVC>(savedContent, options.tags, runner);
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
