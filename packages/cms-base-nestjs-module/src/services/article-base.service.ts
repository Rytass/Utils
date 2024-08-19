import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { BaseArticleEntity } from '../models/base-article.entity';
import { ArticleCreateDto } from '../typings/article-create.dto';
import { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import { BaseArticleVersionContentEntity } from '../models/base-article-version-content.entity';
import {
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

@Injectable()
export class ArticleBaseService {
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private readonly logger = new Logger(ArticleBaseService.name);

  private getDefaultQueryBuilder(
    alias = 'articles',
    onlyLatest = false,
  ): SelectQueryBuilder<BaseArticleEntity> {
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
        'latest.version = versions.version && latest."articleId" = versions."articleId"',
      );
    }

    return qb;
  }

  async findById(id: string): Promise<ArticleBaseDto>;
  async findById(id: string, language: Language): Promise<SingleArticleBaseDto>;
  async findById(id: string, language?: Language): Promise<ArticleBaseDto> {
    if (language && !this.multipleLanguageMode) {
      throw new MultipleLanguageModeIsDisabledError();
    }

    const qb = this.getDefaultQueryBuilder('articles');

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
      ) as BaseArticleVersionContentEntity;

      return {
        id: article.id,
        tags: article.versions[0].tags,
        language: defaultContent.language,
        version: defaultContent.version,
        title: defaultContent.title,
        description: defaultContent.description,
        content: defaultContent.content,
      };
    }

    return {
      id: article.id,
      tags: article.versions[0].tags,
      multiLanguageContents: article.versions[0].multiLanguageContents,
    };
  }

  async findAll(
    options?: ArticleFindAllDto & { language: Language },
  ): Promise<SingleArticleBaseDto[]>;
  async findAll(options?: ArticleFindAllDto): Promise<ArticleBaseDto[]>;
  async findAll(options?: ArticleFindAllDto): Promise<ArticleBaseDto[]> {
    if (options?.language && !this.multipleLanguageMode) {
      throw new MultipleLanguageModeIsDisabledError();
    }

    const qb = this.getDefaultQueryBuilder('articles');

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
        ) as BaseArticleVersionContentEntity;

        return {
          id: article.id,
          tags: article.versions[0].tags,
          language: defaultContent.language,
          version: defaultContent.version,
          title: defaultContent.title,
          description: defaultContent.description,
          content: defaultContent.content,
        };
      });
    }

    return articles.map((article) => ({
      id: article.id,
      tags: article.versions[0].tags,
      multiLanguageContents: article.versions[0].multiLanguageContents,
    }));
  }

  async archive(id: string): Promise<void> {
    const article = await this.baseArticleRepo.findOne({ where: { id } });

    if (!article) {
      throw new ArticleNotFoundError();
    }

    await this.baseArticleRepo.softDelete(id);
  }

  async addVersion(
    id: string,
    options: ArticleCreateDto,
  ): Promise<BaseArticleEntity> {
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

    if (options.categoryIds) {
      article.categories = targetCategories;
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
      await runner.manager.save(article);

      const version = this.baseArticleVersionRepo.create({
        articleId: article.id,
        version: latestVersion.version + 1,
        tags: options.tags,
      });

      await runner.manager.save(version);

      if ('multiLanguageContents' in options) {
        if (!this.multipleLanguageMode)
          throw new MultipleLanguageModeIsDisabledError();

        await runner.manager.save(
          Object.entries(options.multiLanguageContents).map(
            ([language, content]) =>
              this.baseArticleVersionContentRepo.create({
                articleId: article.id,
                version: latestVersion.version + 1,
                language,
                title: content.title,
                description: content.description,
                content: content.content,
              }),
          ),
        );
      } else {
        await runner.manager.save(
          this.baseArticleVersionContentRepo.create({
            articleId: article.id,
            version: latestVersion.version + 1,
            language: DEFAULT_LANGUAGE,
            title: options.title,
            description: options.description,
            content: options.content,
          }),
        );
      }

      await runner.commitTransaction();

      return article;
    } catch (ex) {
      await runner.rollbackTransaction();

      throw new BadRequestException(ex);
    } finally {
      await runner.release();
    }
  }

  async create(options: ArticleCreateDto): Promise<BaseArticleEntity> {
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
      categories: targetCategories,
    });

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      await runner.manager.save(article);

      const version = this.baseArticleVersionRepo.create({
        articleId: article.id,
        version: 0,
        tags: options.tags,
      });

      await runner.manager.save(version);

      if ('multiLanguageContents' in options) {
        if (!this.multipleLanguageMode)
          throw new MultipleLanguageModeIsDisabledError();

        await runner.manager.save(
          Object.entries(options.multiLanguageContents).map(
            ([language, content]) =>
              this.baseArticleVersionContentRepo.create({
                articleId: article.id,
                version: 0,
                language,
                title: content.title,
                description: content.description,
                content: content.content,
              }),
          ),
        );
      } else {
        await runner.manager.save(
          this.baseArticleVersionContentRepo.create({
            articleId: article.id,
            version: 0,
            language: DEFAULT_LANGUAGE,
            title: options.title,
            description: options.description,
            content: options.content,
          }),
        );
      }

      await runner.commitTransaction();

      return article;
    } catch (ex) {
      await runner.rollbackTransaction();

      throw new BadRequestException(ex);
    } finally {
      await runner.release();
    }
  }
}
