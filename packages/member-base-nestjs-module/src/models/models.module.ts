import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaseMemberEntity, BaseMemberRepo } from './base-member.entity';
import { DataSource } from 'typeorm';
import { MemberLoginLogEntity, MemberLoginLogRepo } from './member-login-log.entity';
import { MemberPasswordHistoryEntity, MemberPasswordHistoryRepo } from './member-password-history.entity';
import { MemberOAuthRecordEntity, MemberOAuthRecordRepo } from './member-oauth-record.entity';

const models = [
  [BaseMemberRepo, BaseMemberEntity],
  [MemberLoginLogRepo, MemberLoginLogEntity],
  [MemberPasswordHistoryRepo, MemberPasswordHistoryEntity],
  [MemberOAuthRecordRepo, MemberOAuthRecordEntity],
] as [symbol, typeof BaseMemberEntity][];

@Module({
  imports: [TypeOrmModule.forFeature(models.map(model => model[1]))],
  providers: models.map(([symbol, entity]) => ({
    provide: symbol,
    useFactory: (dataSource: DataSource) => dataSource.getRepository(entity),
    inject: [DataSource],
  })),
  exports: models.map(model => model[0]),
})
export class MemberBaseModelsModule {}
