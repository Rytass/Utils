import { BaseArticleVersionContentEntity } from '../models/base-article-version-content.entity';
import { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import { BaseArticleEntity } from '../models/base-article.entity';
import { MultiLanguageArticleBaseDto, SingleArticleBaseDto } from './article-base.dto';

export type SingleArticleCollectionDto<
  ArticleEntity extends BaseArticleEntity = BaseArticleEntity,
  ArticleVersionEntity extends BaseArticleVersionEntity = BaseArticleVersionEntity,
  ArticleVersionContentEntity extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> = {
  articles: SingleArticleBaseDto<ArticleEntity, ArticleVersionEntity, ArticleVersionContentEntity>[];
  total: number;
  offset: number;
  limit: number;
};

export type MultiLanguageArticleCollectionDto<
  ArticleEntity extends BaseArticleEntity = BaseArticleEntity,
  ArticleVersionEntity extends BaseArticleVersionEntity = BaseArticleVersionEntity,
  ArticleVersionContentEntity extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> = {
  articles: MultiLanguageArticleBaseDto<ArticleEntity, ArticleVersionEntity, ArticleVersionContentEntity>[];
  total: number;
  offset: number;
  limit: number;
};

export type ArticleCollectionDto<
  ArticleEntity extends BaseArticleEntity = BaseArticleEntity,
  ArticleVersionEntity extends BaseArticleVersionEntity = BaseArticleVersionEntity,
  ArticleVersionContentEntity extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> = {
  articles:
    | SingleArticleBaseDto<ArticleEntity, ArticleVersionEntity, ArticleVersionContentEntity>[]
    | MultiLanguageArticleBaseDto<ArticleEntity, ArticleVersionEntity, ArticleVersionContentEntity>[];
  total: number;
  offset: number;
  limit: number;
};
