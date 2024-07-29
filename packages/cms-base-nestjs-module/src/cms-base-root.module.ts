import { CMSBaseRootModuleOptionsDto } from './typings/cms-base-root-module-options.dto';
import { CMSBaseModule } from './cms-base.module';
import { CMSBaseRootModuleAsyncOptionsDto } from './typings/cms-base-root-module-async-options';
import { getProvidersFromOptions } from './helper/get-providers-from-options';
import { DynamicModule } from '@nestjs/common';

export class CMSBaseRootModule {
  static forRootAsync(
    options?: CMSBaseRootModuleAsyncOptionsDto,
  ): DynamicModule {
    return {
      module: CMSBaseModule,
      imports: options?.imports ?? [],
      providers: getProvidersFromOptions(options),
    };
  }

  static forRoot(options?: CMSBaseRootModuleOptionsDto): DynamicModule {
    return {
      module: CMSBaseModule,
      providers: getProvidersFromOptions(options),
    };
  }
}
