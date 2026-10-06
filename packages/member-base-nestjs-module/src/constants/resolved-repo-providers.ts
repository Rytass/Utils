import { Provider } from '@nestjs/common';
import { Repository, DataSource, ObjectLiteral } from 'typeorm';
import {
  PROVIDE_MEMBER_ENTITY,
  PROVIDE_MEMBER_SESSION_ENTITY,
  RESOLVED_MEMBER_REPO,
  RESOLVED_MEMBER_SESSION_REPO,
} from '../typings/member-base.tokens';
import { BaseMemberRepo } from '../models/base-member.entity';
import { MemberSessionRepo } from '../models/member-session.entity';

const TARGETS = [
  [BaseMemberRepo, PROVIDE_MEMBER_ENTITY, RESOLVED_MEMBER_REPO],
  [MemberSessionRepo, PROVIDE_MEMBER_SESSION_ENTITY, RESOLVED_MEMBER_SESSION_REPO],
];

export const ResolvedRepoProviders = TARGETS.map(([repo, provide, resolved]) => ({
  provide: resolved,
  useFactory: (
    baseRepo: Repository<ObjectLiteral>,
    entity: (new () => ObjectLiteral) | null,
    dataSource: DataSource,
  ): Repository<ObjectLiteral> => (entity ? dataSource.getRepository(entity) : baseRepo),
  inject: [repo, provide, DataSource],
})) as Provider[];
