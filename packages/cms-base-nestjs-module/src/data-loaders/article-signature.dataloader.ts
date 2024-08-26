import { Inject, Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { ArticleSignatureEntity } from '../models/base-article-signature.entity';
import { LRUCache } from 'lru-cache';
import { Brackets, Repository } from 'typeorm';
import { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import { RESOLVED_ARTICLE_VERSION_REPO } from '../typings/cms-base-providers';

@Injectable()
export class ArticleSignatureDataLoader {
  constructor(
    @Inject(RESOLVED_ARTICLE_VERSION_REPO)
    private readonly articleVersionRepo: Repository<BaseArticleVersionEntity>,
  ) {}

  readonly versionSignaturesLoader = new DataLoader<
    string,
    ArticleSignatureEntity[]
  >(
    async (ids: readonly string[]) => {
      const pairs = ids.map((token) => {
        const [id, version] = token.split('|');

        const nVersion = Number(version);

        if (!id || Number.isNaN(nVersion) || nVersion < 0) {
          throw new Error(
            `Invalid id: ${token}, please use format: id|version`,
          );
        }

        return { id, version: Number(version) };
      });

      const qb = this.articleVersionRepo.createQueryBuilder('articleVersions');

      qb.leftJoinAndSelect('articleVersions.signatures', 'signatures');
      qb.leftJoinAndSelect('signatures.signatureLevel', 'signatureLevel');

      pairs.forEach((pair) => {
        qb.orWhere(
          new Brackets((subQb) => {
            subQb.andWhere('articleVersions.id = :id', { id: pair.id });
            subQb.andWhere('articleVersions.version = :version', {
              version: pair.version,
            });

            return subQb;
          }),
        );
      });

      const versions = await qb.getMany();

      const versionMap = new Map(
        versions.map((version) => [
          `${version.articleId}|${version.version}`,
          version,
        ]),
      );

      return ids.map((id) => versionMap.get(id)?.signatures ?? []);
    },
    {
      cacheMap: new LRUCache<string, Promise<ArticleSignatureEntity[]>>({
        max: 100,
        ttl: 1000 * 15, // 15 seconds
        ttlAutopurge: true,
      }),
    },
  );
}
