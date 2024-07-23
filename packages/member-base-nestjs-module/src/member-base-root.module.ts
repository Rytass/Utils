import { MemberBaseRootModuleOptionsDto } from './typings/member-base-root-module-options.dto';
import { MemberBaseModule } from './member-base.module';
import { LOGIN_FAILED_BAN_THRESHOLD } from './typings/member-base-providers';
import { MemberBaseRootModuleAsyncOptionsDto } from './typings/member-base-root-module-async-options';

export class MemberBaseRootModule {
  static forRootAsync(options?: MemberBaseRootModuleAsyncOptionsDto) {
    return {
      module: MemberBaseModule,
      imports: options?.imports ?? [],
      providers: [
        {
          provide: LOGIN_FAILED_BAN_THRESHOLD,
          useValue: options?.loginFailedBanThreshold ?? 5,
        },
      ],
    };
  }

  static forRoot(options?: MemberBaseRootModuleOptionsDto) {
    return {
      module: MemberBaseModule,
      providers: [
        {
          provide: LOGIN_FAILED_BAN_THRESHOLD,
          useValue: options?.loginFailedBanThreshold ?? 5,
        },
      ],
    };
  }
}
