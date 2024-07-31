import { Module } from '@nestjs/common';
import { MemberBaseModelsModule } from './models/models.module';
import { MemberBaseService } from './services/member-base.service';
import { MemberBaseAdminService } from './services/member-base-admin.service';
import { ResolvedRepoProviders } from './constants/resolved-repo-providers';
import {
  ACCESS_TOKEN_SECRET,
  CASBIN_ENFORCER,
  ENABLE_GLOBAL_GUARD,
} from './typings/member-base-providers';

@Module({
  imports: [MemberBaseModelsModule],
  providers: [
    ...ResolvedRepoProviders,
    MemberBaseService,
    MemberBaseAdminService,
  ],
  exports: [
    MemberBaseModelsModule,
    MemberBaseService,
    MemberBaseAdminService,
    CASBIN_ENFORCER,
    ACCESS_TOKEN_SECRET,
    ENABLE_GLOBAL_GUARD,
  ],
})
export class MemberBaseModule {}
