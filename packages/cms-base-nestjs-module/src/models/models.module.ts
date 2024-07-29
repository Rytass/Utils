import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaseArticleEntity, BaseArticleRepo } from './base-article.entity';
import { DataSource } from 'typeorm';
import {
  BaseArticleVersionEntity,
  BaseArticleVersionRepo,
} from './base-article-version.entity';
import { BaseCategoryEntity, BaseCategoryRepo } from './base-category.entity';
import {
  BaseCategoryMultiLanguageNameEntity,
  BaseCategoryMultiLanguageNameRepo,
} from './base-category-multi-language-name.entity';
import {
  BaseArticleVersionContentEntity,
  BaseArticleVersionContentRepo,
} from './base-article-version-content.entity';

const models = [
  [BaseArticleRepo, BaseArticleEntity],
  [BaseArticleVersionRepo, BaseArticleVersionEntity],
  [BaseArticleVersionContentRepo, BaseArticleVersionContentEntity],
  [BaseCategoryRepo, BaseCategoryEntity],
  [BaseCategoryMultiLanguageNameRepo, BaseCategoryMultiLanguageNameEntity],
] as [symbol, typeof BaseArticleEntity][];

@Module({
  imports: [TypeOrmModule.forFeature(models.map((model) => model[1]))],
  providers: models.map(([symbol, entity]) => ({
    provide: symbol,
    useFactory: (dataSource: DataSource) => dataSource.getRepository(entity),
    inject: [DataSource],
  })),
  exports: models.map((model) => model[0]),
})
export class CMSBaseModelsModule {}
