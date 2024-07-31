import { Module } from '@nestjs/common';
import { CMSBaseModelsModule } from './models/models.module';
import { ArticleBaseService } from './services/article-base.service';
import { CategoryBaseService } from './services/category-base.service';
import {
  ResolvedRepoProviders,
  TARGETS,
} from './constant/resolved-repo-providers';
import { CategoryDataLoader } from './data-loaders/category.dataloader';
import { CATEGORY_DATA_LOADER } from './typings/cms-base-providers';

@Module({
  imports: [CMSBaseModelsModule],
  providers: [
    ...ResolvedRepoProviders,
    CategoryDataLoader,
    {
      provide: CATEGORY_DATA_LOADER,
      useExisting: CategoryDataLoader,
    },
    ArticleBaseService,
    CategoryBaseService,
  ],
  exports: [
    ...TARGETS.map(([, , resolved]) => resolved),
    CMSBaseModelsModule,
    ArticleBaseService,
    CategoryBaseService,
    CategoryDataLoader,
  ],
})
export class CMSBaseModule {}
