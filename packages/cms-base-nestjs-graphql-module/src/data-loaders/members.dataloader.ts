import { Inject, Injectable } from '@nestjs/common';
import { BaseMemberEntity, RESOLVED_MEMBER_REPO } from '@rytass/member-base-nestjs-module';
import DataLoader from 'dataloader';
import { LRUCache } from 'lru-cache';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class MemberDataLoader {
  constructor(
    @Inject(RESOLVED_MEMBER_REPO)
    private readonly memberRepo: Repository<BaseMemberEntity>,
  ) {}

  readonly loader = new DataLoader<string, BaseMemberEntity | null>(
    async (ids): Promise<(BaseMemberEntity | null)[]> => {
      const qb = this.memberRepo.createQueryBuilder('members');

      qb.withDeleted();
      qb.andWhere('members.id IN (:...ids)', { ids });

      const users = await qb.getMany();

      const userMap = new Map(users.map(user => [user.id, user]));

      return ids.map(id => userMap.get(id) ?? null);
    },
    {
      cache: true,
      cacheMap: new LRUCache<string, Promise<BaseMemberEntity | null>>({
        ttl: 1000 * 60 * 10, // 10 minutes
        ttlAutopurge: true,
        max: 1000,
      }),
    },
  );
}
