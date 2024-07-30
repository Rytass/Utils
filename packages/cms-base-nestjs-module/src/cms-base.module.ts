import { Module } from '@nestjs/common';
import { CMSBaseModelsModule } from './models/models.module';
import { ArticleBaseService } from './services/article-base.service';
import { CategoryBaseService } from './services/category-base.service';
import { ResolvedRepoProviders } from './constant/resolved-repo-providers';

@Module({
  imports: [CMSBaseModelsModule],
  providers: [
    ...ResolvedRepoProviders,
    ArticleBaseService,
    CategoryBaseService,
  ],
  exports: [CMSBaseModelsModule, ArticleBaseService, CategoryBaseService],
})
export class CMSBaseModule {}
