import { Module } from '@nestjs/common';
import { CMSBaseModelsModule } from './models/models.module';
import { ArticleBaseService } from './services/article-base.service';
import { CategoryBaseService } from './services/category-base.service';

@Module({
  imports: [CMSBaseModelsModule],
  providers: [ArticleBaseService, CategoryBaseService],
  exports: [CMSBaseModelsModule, ArticleBaseService, CategoryBaseService],
})
export class CMSBaseModule {}
