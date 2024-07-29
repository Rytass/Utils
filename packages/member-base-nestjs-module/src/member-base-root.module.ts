import { MemberBaseRootModuleOptionsDto } from './typings/member-base-root-module-options.dto';
import { MemberBaseModule } from './member-base.module';
import { MemberBaseRootModuleAsyncOptionsDto } from './typings/member-base-root-module-async-options';
import { getProvidersFromOptions } from './helper/get-providers-from-options';
import { DynamicModule } from '@nestjs/common';

export class MemberBaseRootModule {
  static forRootAsync(
    options?: MemberBaseRootModuleAsyncOptionsDto,
  ): DynamicModule {
    return {
      module: MemberBaseModule,
      imports: options?.imports ?? [],
      providers: getProvidersFromOptions(options),
    };
  }

  static forRoot(options?: MemberBaseRootModuleOptionsDto): DynamicModule {
    return {
      module: MemberBaseModule,
      providers: getProvidersFromOptions(options),
    };
  }
}
