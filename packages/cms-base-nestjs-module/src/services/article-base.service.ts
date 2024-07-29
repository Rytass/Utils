import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import {
  BaseArticleRepo,
  BaseArticleEntity,
} from '../models/base-article.entity';
import { ArticleCreateDto } from '../typings/article-create.dto';
import {
  BaseArticleVersionEntity,
  BaseArticleVersionRepo,
} from '../models/base-article-version.entity';
import {
  BaseArticleVersionContentEntity,
  BaseArticleVersionContentRepo,
} from '../models/base-article-version-content.entity';
import { MULTIPLE_LANGUAGE_MODE } from '../typings/cms-base-providers';
import { DEFAULT_LANGUAGE } from '../constant/default-language';
import { ArticleFindAllDto } from '../typings/article-find-all.dto';
import { Language } from '../typings/language';
import {
  ArticleBaseDto,
  MultiLanguageArticleBaseDto,
  SingleArticleBaseDto,
} from '../typings/article-base.dto';

@Injectable()
export class ArticleBaseService {
  constructor(
    @Inject(BaseArticleRepo)
    private readonly baseArticleRepo: Repository<BaseArticleEntity>,
    @Inject(BaseArticleVersionRepo)
    private readonly baseArticleVersionRepo: Repository<BaseArticleVersionEntity>,
    @Inject(BaseArticleVersionContentRepo)
    private readonly baseArticleVersionContentRepo: Repository<BaseArticleVersionContentEntity>,
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multipleLanguageMode: boolean,
    private readonly dataSource: DataSource,
  ) {}

  private getDefaultQueryBuilder(
    alias = 'articles',
    onlyLatest = false,
  ): SelectQueryBuilder<BaseArticleEntity> {
    const qb = this.baseArticleRepo.createQueryBuilder(alias);

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

  async findById(id: string, language: Language): Promise<SingleArticleBaseDto>;
  async findById(id: string, language?: Language): Promise<ArticleBaseDto> {
    if (language && !this.multipleLanguageMode) {
      throw new BadRequestException('Multiple language mode is disabled');
    }

    const qb = this.getDefaultQueryBuilder('articles');

    qb.andWhere('articles.id = :id', { id });

    if (language) {
      qb.andWhere('multiLanguageContents.language = :language', { language });
    }

    const article = await qb.getOne();

    if (!article) {
      throw new BadRequestException('Article not found');
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
    options: ArticleFindAllDto & { language: Language },
  ): Promise<SingleArticleBaseDto[]>;
  async findAll(options: ArticleFindAllDto): Promise<ArticleBaseDto[]> {
    if (options.language && !this.multipleLanguageMode) {
      throw new BadRequestException('Multiple language mode is disabled');
    }

    const qb = this.getDefaultQueryBuilder('articles');

    if (options.ids) {
      qb.andWhere('articles.id IN (:...ids)', { ids: options.ids });
    }

    if (options.language) {
      qb.andWhere('multiLanguageContents.language = :language', {
        language: options.language,
      });
    }

    const articles = await qb.getMany();

    if (options.language || !this.multipleLanguageMode) {
      return articles.map((article) => {
        const defaultContent = article.versions[0].multiLanguageContents.find(
          (content) =>
            content.language === (options.language || DEFAULT_LANGUAGE),
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
      throw new BadRequestException('Article not found');
    }

    await this.baseArticleRepo.softDelete(id);
  }

  async addVersion(
    id: string,
    options: ArticleCreateDto,
  ): Promise<BaseArticleEntity> {
    const article = await this.baseArticleRepo.findOne({ where: { id } });

    if (!article) {
      throw new BadRequestException('Article not found');
    }

    const latestQb =
      this.baseArticleVersionRepo.createQueryBuilder('articleVersions');

    latestQb.andWhere('articleVersions.articleId = :id', { id });
    latestQb.addOrderBy('articleVersions.version', 'DESC');

    const latestVersion = await latestQb.getOne();

    if (!latestVersion) {
      throw new BadRequestException('Article version not found');
    }

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      const version = this.baseArticleVersionRepo.create({
        articleId: article.id,
        version: latestVersion.version + 1,
        tags: options.tags,
      });

      await runner.manager.save(version);

      if ('multiLanguageContents' in options) {
        if (!this.multipleLanguageMode)
          throw new BadRequestException('Multiple language mode is disabled');

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
    const article = this.baseArticleRepo.create({});

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
          throw new BadRequestException('Multiple language mode is disabled');

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