import { Injectable } from '@nestjs/common';
import { BaseMemberEntity } from '@rytass/member-base-nestjs-module';
import DataLoader from 'dataloader';
import { LRUCache } from 'lru-cache';
import { DataSource } from 'typeorm';

@Injectable()
export class MemberDataLoader {
  constructor(private readonly dataSource: DataSource) {}

  readonly loader = new DataLoader<string, BaseMemberEntity | null>(
    async (ids): Promise<(BaseMemberEntity | null)[]> => {
      const members = await this.dataSource
        .getRepository(BaseMemberEntity)
        .createQueryBuilder('members')
        .where('members.id IN (:...ids)', { ids })
        .getMany();

      const memberMap = new Map(members.map((member) => [member.id, member]));

      return ids.map((id) => memberMap.get(id) ?? null);
    },
    {
      maxBatchSize: 20,
      cache: true,
      cacheMap: new LRUCache<string, Promise<BaseMemberEntity | null>>({
        ttl: 1000 * 60, // 1 minute
        ttlAutopurge: true,
        max: 100,
      }),
    },
  );
}
