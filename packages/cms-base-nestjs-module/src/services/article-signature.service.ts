import {
  BadRequestException,
  Inject,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  ENABLE_SIGNATURE_MODE,
  RESOLVED_SIGNATURE_LEVEL_REPO,
  SIGNATURE_LEVELS,
} from '../typings/cms-base-providers';
import { BaseSignatureLevelEntity } from '../models/base-signature-level.entity';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  ArticleSignatureEntity,
  ArticleSignatureRepo,
} from '../models/base-article-signature.entity';
import { BaseArticleVersionEntity } from '../models/base-article-version.entity';
import { SignatureInfoDto } from '../typings/signature-info.dto';
import { ArticleSignatureResult } from '../typings/article-signature-result.enum';

@Injectable()
export class ArticleSignatureService<
  SignatureLevelEntity extends
    BaseSignatureLevelEntity = BaseSignatureLevelEntity,
  ArticleVersionEntity extends
    BaseArticleVersionEntity = BaseArticleVersionEntity,
> implements OnApplicationBootstrap
{
  constructor(
    @Inject(ENABLE_SIGNATURE_MODE)
    private readonly signatureMode: boolean,
    @Inject(SIGNATURE_LEVELS)
    private readonly signatureLevels: string[] | SignatureLevelEntity[],
    @Inject(RESOLVED_SIGNATURE_LEVEL_REPO)
    private readonly signatureLevelRepo: Repository<SignatureLevelEntity>,
    @Inject(ArticleSignatureRepo)
    private readonly articleSignatureRepo: Repository<ArticleSignatureEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private signatureLevelsCache: SignatureLevelEntity[] = [];

  async approveVersion(
    articleVersion: ArticleVersionEntity,
    signatureInfo?: SignatureInfoDto<SignatureLevelEntity>,
  ): Promise<ArticleSignatureEntity> {
    const targetLevelIndex = signatureInfo?.signatureLevel
      ? this.signatureLevelsCache.findIndex((level) =>
          signatureInfo.signatureLevel instanceof BaseSignatureLevelEntity
            ? level.id === signatureInfo.signatureLevel.id
            : level.name === signatureInfo.signatureLevel,
        )
      : Number.NaN;

    if (
      signatureInfo?.signatureLevel &&
      (targetLevelIndex === -1 || Number.isNaN(targetLevelIndex))
    ) {
      throw new Error('Invalid signature level');
    }

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      const qb = runner.manager.createQueryBuilder(
        ArticleSignatureEntity,
        'signatures',
      );

      qb.andWhere('signatures.articleId = :articleId', {
        articleId: articleVersion.articleId,
      });
      qb.andWhere('signatures.version = :version', {
        version: articleVersion.version,
      });
      qb.setLock('pessimistic_write');

      const signatures = await qb.getMany();

      if (!Number.isNaN(targetLevelIndex)) {
        const signatureMap = new Map(
          signatures.map((signature) => [
            signature.signatureLevelId,
            signature,
          ]),
        );
        const needSignTargets = this.signatureLevelsCache
          .slice(0, targetLevelIndex + 1)
          .map((level) => signatureMap.get(level.id) ?? null);

        const targetSignature = needSignTargets[targetLevelIndex];

        if (targetSignature) {
          if (targetSignature.result === ArticleSignatureResult.REJECTED) {
            await this.articleSignatureRepo.softDelete(targetSignature.id);
          } else {
            throw new BadRequestException('Already signed');
          }
        }

        if (targetLevelIndex > 0) {
          const previousSignature = needSignTargets[targetLevelIndex - 1];
          const previousRequiredSignatureLevels = this.signatureLevelsCache
            .slice(0, targetLevelIndex)
            .filter((level) => level.required);

          const latestRequireSignatureLevel =
            previousRequiredSignatureLevels[
              previousRequiredSignatureLevels.length - 1
            ];

          if (
            previousSignature &&
            previousSignature.result !== ArticleSignatureResult.APPROVED
          ) {
            throw new BadRequestException('Previous valid signature not found');
          }

          const latestRequireSignature = signatureMap.get(
            latestRequireSignatureLevel.id,
          );

          if (!latestRequireSignature) {
            throw new BadRequestException('Previous valid signature not found');
          }
        }

        const signature = this.articleSignatureRepo.create({
          articleId: articleVersion.articleId,
          version: articleVersion.version,
          signatureLevelId: this.signatureLevelsCache[targetLevelIndex].id,
          result: ArticleSignatureResult.APPROVED,
          signerId: signatureInfo?.signerId ?? null,
        });

        await runner.manager.save(signature);

        return signature;
      } else if (signatures.length) {
        throw new BadRequestException('Already signed');
      }

      const signature = this.articleSignatureRepo.create({
        articleId: articleVersion.articleId,
        version: articleVersion.version,
        result: ArticleSignatureResult.APPROVED,
        signerId: signatureInfo?.signerId ?? null,
      });

      await runner.manager.save(signature);

      return signature;
    } catch (ex) {
      await runner.rollbackTransaction();

      throw ex;
    } finally {
      await runner.release();
    }
  }

  async refreshSignatureLevelsCache(): Promise<void> {
    this.signatureLevelsCache = (await (
      this.signatureLevelRepo as Repository<BaseSignatureLevelEntity>
    ).find({
      order: { sequence: 'ASC' },
    })) as SignatureLevelEntity[];
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.signatureMode && this.signatureLevels.length) {
      const signatureLevels = await this.signatureLevelRepo.find();

      const existedMap = new Map(
        signatureLevels.map((level) => [level.name, level]),
      );
      const usedSet = new Set<SignatureLevelEntity>();

      const runner = this.dataSource.createQueryRunner();

      await runner.connect();
      await runner.startTransaction();

      try {
        this.signatureLevelsCache = await this.signatureLevels
          .map((level, index) => async (levels: SignatureLevelEntity[]) => {
            if (level instanceof BaseSignatureLevelEntity) {
              level.sequence = index;
              level.required = true;

              await runner.manager.save(level);

              usedSet.add(level);

              return [...levels, level];
            }

            if (existedMap.has(level)) {
              const existedLevel = existedMap.get(
                level,
              ) as SignatureLevelEntity;

              existedLevel.sequence = index;
              existedLevel.required = true;

              await runner.manager.save(existedLevel);

              usedSet.add(existedLevel);

              return [
                ...levels,
                existedMap.get(level),
              ] as SignatureLevelEntity[];
            }

            const newLevel = (
              this.signatureLevelRepo as Repository<BaseSignatureLevelEntity>
            ).create({
              name: level,
              required: true,
              sequence: index,
            });

            await runner.manager.save(newLevel);

            usedSet.add(newLevel as SignatureLevelEntity);

            return levels;
          })
          .reduce(
            (prev, next) => prev.then(next),
            Promise.resolve([] as SignatureLevelEntity[]),
          );

        await signatureLevels
          .filter((level) => !usedSet.has(level))
          .map((level) => async () => {
            await runner.manager.delete(ArticleSignatureEntity, {
              signatureLevel: level,
            });
          })
          .reduce((prev, next) => prev.then(next), Promise.resolve());

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
