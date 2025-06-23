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
  ) {}

  readonly versionsLoader = new DataLoader<
    string,
    ArticleBaseDto<A, AV, AVC>[]
  >(async (ids: readonly string[]): Promise<ArticleBaseDto<A, AV, AVC>[][]> => {
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
  });
}
