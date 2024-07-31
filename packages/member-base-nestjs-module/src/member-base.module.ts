import { Module } from '@nestjs/common';
import { MemberBaseModelsModule } from './models/models.module';
import { MemberBaseService } from './services/member-base.service';
import { MemberBaseAdminService } from './services/member-base-admin.service';
import { ResolvedRepoProviders } from './constants/resolved-repo-providers';
import {
  ACCESS_TOKEN_SECRET,
  CASBIN_ENFORCER,
  ENABLE_GLOBAL_GUARD,
  GRAPHQL_CONTEXT_TOKEN_PARSER,
} from './typings/member-base-providers';
import { GraphQLContextTokenParserProvider } from './providers/graphql-context-token-parser.provider';

@Module({
  imports: [MemberBaseModelsModule],
  providers: [
    ...ResolvedRepoProviders,
    MemberBaseService,
    MemberBaseAdminService,
    GraphQLContextTokenParserProvider,
  ],
  exports: [
    MemberBaseModelsModule,
    MemberBaseService,
    MemberBaseAdminService,
    CASBIN_ENFORCER,
    ACCESS_TOKEN_SECRET,
    ENABLE_GLOBAL_GUARD,
    GRAPHQL_CONTEXT_TOKEN_PARSER,
  ],
})
export class MemberBaseModule {}
