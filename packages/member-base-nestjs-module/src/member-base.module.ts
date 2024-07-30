import { Module } from '@nestjs/common';
import { MemberBaseModelsModule } from './models/models.module';
import { MemberBaseService } from './services/member-base.service';
import { MemberBaseAdminService } from './services/member-base-admin.service';
import {
  PROVIDE_MEMBER_ENTITY,
  RESOLVED_MEMBER_REPO,
} from './typings/member-base-providers';
import { BaseMemberEntity, BaseMemberRepo } from './models/base-member.entity';
import { DataSource, Repository } from 'typeorm';

@Module({
  imports: [MemberBaseModelsModule],
  providers: [
    {
      provide: RESOLVED_MEMBER_REPO,
      useFactory: (
        baseMemberRepo: Repository<BaseMemberEntity>,
        memberEntity: typeof BaseMemberEntity,
        dataSource: DataSource,
      ) =>
        memberEntity ? dataSource.getRepository(memberEntity) : baseMemberRepo,
      inject: [BaseMemberRepo, PROVIDE_MEMBER_ENTITY, DataSource],
    },
    MemberBaseService,
    MemberBaseAdminService,
  ],
  exports: [MemberBaseModelsModule, MemberBaseService, MemberBaseAdminService],
})
export class MemberBaseModule {}
