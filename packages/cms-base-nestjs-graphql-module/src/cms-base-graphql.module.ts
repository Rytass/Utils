import { Module, DynamicModule } from '@nestjs/common';
import {
  CMSBaseModule,
  CMSBaseModuleOptionsDto,
  CMSBaseModuleAsyncOptionsDto,
} from '@rytass/cms-base-nestjs-module';
import { ArticleMutations } from './mutations/article.mutations';
import { CategoryMutations } from './mutations/category.mutations';
import { ArticleQueries } from './queries/article.queries';
import { CategoryQueries } from './queries/category.queries';

@Module({})
export class CMSBaseGraphQLModule {
  static forRootAsync(options: CMSBaseModuleAsyncOptionsDto): DynamicModule {
    return {
      module: CMSBaseGraphQLModule,
      imports: [
        ...(options.imports || []),
        CMSBaseModule.forRootAsync(options),
      ],
      exports: [CMSBaseModule],
      providers: [
        ArticleQueries,
        ArticleMutations,
        CategoryQueries,
        CategoryMutations,
      ],
    };
  }

  static forRoot(options?: CMSBaseModuleOptionsDto): DynamicModule {
    return {
      module: CMSBaseGraphQLModule,
      imports: [CMSBaseModule.forRoot(options)],
      exports: [CMSBaseModule],
      providers: [
        ArticleQueries,
        ArticleMutations,
        CategoryQueries,
        CategoryMutations,
      ],
    };
  }
}
