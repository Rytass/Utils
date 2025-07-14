import { Inject, Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { ArticleSignatureEntity } from '../models/article-signature.entity';
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
    { id: string; version: number },
    ArticleSignatureEntity[],
    string
  >(
    async (args: readonly { id: string; version: number }[]) => {
      const qb = this.articleVersionRepo.createQueryBuilder('articleVersions');

      qb.leftJoinAndSelect('articleVersions.signatures', 'signatures');
      qb.leftJoinAndSelect('signatures.signatureLevel', 'signatureLevel');

      args.forEach(({ id, version }, index) => {
        qb.orWhere(
          new Brackets((subQb) => {
            subQb.andWhere(`articleVersions.articleId = :id_${index}`, {
              [`id_${index}`]: id,
            });

            subQb.andWhere(`articleVersions.version = :version_${index}`, {
              [`version_${index}`]: version,
            });

            return subQb;
          }),
        );
      });

      qb.addOrderBy('signatures.signedAt', 'DESC');

      const versions = await qb.getMany();

      const versionMap = new Map(
        versions.map((version) => [
          `${version.articleId}|${version.version}`,
          version,
        ]),
      );

      return args.map(
        ({ id, version }) =>
          versionMap.get(`${id}|${version}`)?.signatures ?? [],
      );
    },
    {
      cache: true,
      cacheMap: new LRUCache<string, Promise<ArticleSignatureEntity[]>>({
        max: 100,
        ttl: 1000 * 15, // 15 seconds
        ttlAutopurge: true,
      }),
      cacheKeyFn: (args: { id: string; version: number }) =>
        `${args.id}|${args.version}`,
    },
  );
}
