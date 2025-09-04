import { Inject, Injectable } from '@nestjs/common';
import { RESOLVED_SIGNATURE_LEVEL_REPO, SIGNATURE_LEVELS } from '../typings/cms-base-providers';
import { BaseSignatureLevelEntity } from '../models/base-signature-level.entity';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { ArticleSignatureEntity, ArticleSignatureRepo } from '../models/article-signature.entity';

@Injectable()
export class SignatureService<SignatureLevelEntity extends BaseSignatureLevelEntity = BaseSignatureLevelEntity> {
  constructor(
    @Inject(SIGNATURE_LEVELS)
    private readonly signatureLevels: string[] | SignatureLevelEntity[],
    @Inject(RESOLVED_SIGNATURE_LEVEL_REPO)
    private readonly signatureLevelRepo: Repository<BaseSignatureLevelEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(ArticleSignatureRepo)
    private readonly articleSignatureRepo: Repository<ArticleSignatureEntity>,
  ) {}

  get signatureEnabled(): boolean {
    return this.signatureLevels.length > 0;
  }

  signatureLevelsCache: BaseSignatureLevelEntity[] = [];

  get finalSignatureLevel(): SignatureLevelEntity | null {
    return (this.signatureLevelsCache[this.signatureLevelsCache.length - 1] ?? null) as SignatureLevelEntity | null;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.signatureEnabled) {
      const signatureLevels = await this.signatureLevelRepo.find();

      const existedMap = new Map(signatureLevels.map(level => [level.name, level]));

      const usedSet = new Set<BaseSignatureLevelEntity>();
      const targetLevelNames = new Set(
        this.signatureLevels.map(level => (level instanceof BaseSignatureLevelEntity ? level.name : level)),
      );

      const runner = this.dataSource.createQueryRunner();

      await runner.connect();
      await runner.startTransaction();

      try {
        await signatureLevels
          .filter(level => !targetLevelNames.has(level.name))
          .map(level => async () => {
            await runner.manager.delete(this.articleSignatureRepo.metadata.tableName, {
              signatureLevelId: level.id,
            });

            await runner.manager.softDelete(this.signatureLevelRepo.metadata.tableName, {
              id: level.id,
            });
          })
          .reduce((prev, next) => prev.then(next), Promise.resolve());

        this.signatureLevelsCache = await this.signatureLevels
          .map((level, index) => async (levels: BaseSignatureLevelEntity[]) => {
            if (level instanceof BaseSignatureLevelEntity) {
              level.sequence = index;
              level.required = true;

              await runner.manager.save(level);

              usedSet.add(level);

              return [...levels, level];
            }

            if (existedMap.has(level)) {
              const existedLevel = existedMap.get(level) as BaseSignatureLevelEntity;

              existedLevel.sequence = index;
              existedLevel.required = true;

              await runner.manager.save(existedLevel);

              usedSet.add(existedLevel);

              return [...levels, existedLevel];
            }

            const newLevel = this.signatureLevelRepo.create({
              name: level,
              required: true,
              sequence: index,
            });

            await runner.manager.save(newLevel);

            usedSet.add(newLevel);

            return levels;
          })
          .reduce((prev, next) => prev.then(next), Promise.resolve([] as BaseSignatureLevelEntity[]));

        await runner.commitTransaction();
      } catch (ex) {
        await runner.rollbackTransaction();

        throw ex;
      } finally {
        await runner.release();
      }
    }
  }
}
