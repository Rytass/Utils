import { Module } from '@nestjs/common';
import { CMSBaseModelsModule } from './models/models.module';
import { ArticleBaseService } from './services/article-base.service';

@Module({
  imports: [CMSBaseModelsModule],
  providers: [ArticleBaseService],
  exports: [CMSBaseModelsModule, ArticleBaseService],
})
export class CMSBaseModule {}
