import { Module, DynamicModule } from '@nestjs/common';
import { CMSBaseModule } from 'cms-base-nestjs-module/lib';
import { CMSBaseModuleOptionsDto } from 'cms-base-nestjs-module/lib/typings/cms-base-root-module-options.dto';
import { CMSBaseModuleAsyncOptionsDto } from 'cms-base-nestjs-module/src/typings/cms-base-root-module-async-options';

@Module({})
export class CmsBaseGraphQLModule {
  static forRootAsync(options: CMSBaseModuleAsyncOptionsDto): DynamicModule {
    return {
      module: CmsBaseGraphQLModule,
      imports: [
        ...(options.imports || []),
        CMSBaseModule.forRootAsync(options),
      ],
      exports: [CMSBaseModule],
    };
  }

  static forRoot(options?: CMSBaseModuleOptionsDto): DynamicModule {
    return {
      module: CmsBaseGraphQLModule,
      imports: [CMSBaseModule.forRoot(options)],
      exports: [CMSBaseModule],
    };
  }
}
