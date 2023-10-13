import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { QuadratsModuleAsyncOptions, QuadratsModuleOptions } from './typings';
import { API_HOST, QUADRATS_AUTH_CLIENT } from './constants';
import { QuadratsArticleService } from './services/article.service';
import { QuadratsArticleCategoryService } from './services/category.service';
import { QuadratsArticleTagService } from './services/tag.service';
import { QuadratsArticleImageService } from './services/image.service';

@Global()
@Module({})
export class QuadratsModule {
  static readonly DEFAULT_HOST = 'https://api.quadrats.io'

  static forRoot(options: QuadratsModuleOptions): DynamicModule {
    return {
      module: QuadratsModule,
      global: true,
      providers: [
        {
          provide: API_HOST,
          useValue: options.host || QuadratsModule.DEFAULT_HOST,
        },
        {
          provide: QUADRATS_AUTH_CLIENT,
          useValue: {
            accessKey: options.accessKey,
            secret: options.secret,
          },
        },
        QuadratsArticleService,
        QuadratsArticleCategoryService,
        QuadratsArticleTagService,
        QuadratsArticleImageService,
      ],
      exports: [
        QuadratsArticleService,
        QuadratsArticleCategoryService,
        QuadratsArticleTagService,
        QuadratsArticleImageService,
      ],
    } as DynamicModule;
  }

  static forRootAsync(options: QuadratsModuleAsyncOptions): DynamicModule {
    const provider: Provider = {
      provide: API_HOST,
      inject: options.inject || [],
      useFactory: options.useFactory,
    }

    return {
      module: QuadratsModule,
      global: true,
      providers: [
        ...this.createAsyncProviders(options),
        provider,
        QuadratsArticleService,
        QuadratsArticleCategoryService,
        QuadratsArticleTagService,
        QuadratsArticleImageService,
      ],
      exports: [
        QuadratsArticleService,
        QuadratsArticleCategoryService,
        QuadratsArticleTagService,
        QuadratsArticleImageService,
      ],
    } as DynamicModule
  }

  private static createAsyncProviders(options: QuadratsModuleAsyncOptions): Provider[] {
    return [this.createAsyncOptionsProvider(options)]
  }

  private static createAsyncOptionsProvider(options: QuadratsModuleAsyncOptions): Provider {
    return {
      inject: options.inject || [],
      provide: QUADRATS_AUTH_CLIENT,
      useFactory: options.useFactory,
    }
  }
}
