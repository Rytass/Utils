import { Provider } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { PROVIDE_MEMBER_ENTITY, RESOLVED_MEMBER_REPO } from '../typings/member-base-providers';
import { BaseMemberEntity, BaseMemberRepo } from '../models/base-member.entity';

const TARGETS = [[BaseMemberRepo, PROVIDE_MEMBER_ENTITY, RESOLVED_MEMBER_REPO]];

export const ResolvedRepoProviders = TARGETS.map(([repo, provide, resolved]) => ({
  provide: resolved,
  useFactory: (
    baseRepo: Repository<typeof BaseMemberEntity>,
    entity: new () => BaseMemberEntity,
    dataSource: DataSource,
  ) => (entity ? dataSource.getRepository(entity) : baseRepo),
  inject: [repo, provide, DataSource],
})) as Provider[];
