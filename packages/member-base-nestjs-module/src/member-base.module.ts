import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MemberBaseModelsModule } from './models/models.module';
import { MemberBaseService } from './services/member-base.service';
import { MemberBaseAdminService } from './services/member-base-admin.service';
import { ResolvedRepoProviders } from './constants/resolved-repo-providers';
import { CASBIN_ENFORCER } from './typings/member-base-providers';
import { CasbinGuard } from './guards/casbin.guard';

@Module({
  imports: [MemberBaseModelsModule],
  providers: [
    ...ResolvedRepoProviders,
    MemberBaseService,
    MemberBaseAdminService,
    {
      provide: APP_GUARD,
      useClass: CasbinGuard,
    },
  ],
  exports: [
    MemberBaseModelsModule,
    MemberBaseService,
    MemberBaseAdminService,
    CASBIN_ENFORCER,
  ],
})
export class MemberBaseModule {}
