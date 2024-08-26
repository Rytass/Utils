import {
  BadRequestException,
  Inject,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  ENABLE_SIGNATURE_MODE,
  RESOLVED_ARTICLE_VERSION_REPO,
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
> implements OnApplicationBootstrap
{
  constructor(
    @Inject(RESOLVED_ARTICLE_VERSION_REPO)
    private readonly articleVersionRepo: Repository<BaseArticleVersionEntity>,
    @Inject(ENABLE_SIGNATURE_MODE)
    private readonly signatureMode: boolean,
    @Inject(SIGNATURE_LEVELS)
    private readonly signatureLevels: string[] | SignatureLevelEntity[],
    @Inject(RESOLVED_SIGNATURE_LEVEL_REPO)
    private readonly signatureLevelRepo: Repository<BaseSignatureLevelEntity>,
    @Inject(ArticleSignatureRepo)
    private readonly articleSignatureRepo: Repository<ArticleSignatureEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private signatureLevelsCache: BaseSignatureLevelEntity[] = [];

  get finalSignatureLevel(): SignatureLevelEntity | null {
    return (this.signatureLevelsCache[this.signatureLevelsCache.length - 1] ??
      null) as SignatureLevelEntity | null;
  }

  rejectVersion(
    articleVersion: {
      id: string;
      version: number;
    },
    signatureInfo?: SignatureInfoDto<SignatureLevelEntity> & {
      reason?: string | null;
    },
  ): Promise<ArticleSignatureEntity> {
    return this.signature(
      ArticleSignatureResult.REJECTED,
      articleVersion,
      signatureInfo,
    );
  }

  approveVersion(
    articleVersion: {
      id: string;
      version: number;
    },
    signatureInfo?: SignatureInfoDto<SignatureLevelEntity>,
  ): Promise<ArticleSignatureEntity> {
    return this.signature(
      ArticleSignatureResult.APPROVED,
      articleVersion,
      signatureInfo,
    );
  }

  private async signature(
    result: ArticleSignatureResult,
    articleVersion: {
      id: string;
      version: number;
    },
    signatureInfo?: SignatureInfoDto<SignatureLevelEntity> & {
      reason?: string | null;
    },
  ): Promise<ArticleSignatureEntity> {
    if (
      !(await this.articleVersionRepo.exists({
        where: {
          articleId: articleVersion.id,
          version: articleVersion.version,
        },
      }))
    ) {
      throw new BadRequestException('Invalid article version');
    }

    if (this.signatureLevelsCache.length && !signatureInfo?.signatureLevel) {
      throw new BadRequestException('Signature level is required');
    }

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
        articleId: articleVersion.id,
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
            await runner.manager.softDelete(ArticleSignatureEntity, {
              id: targetSignature.id,
            });
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
          articleId: articleVersion.id,
          version: articleVersion.version,
          signatureLevelId: this.signatureLevelsCache[targetLevelIndex].id,
          result,
          signerId: signatureInfo?.signerId ?? null,
          rejectReason:
            result === ArticleSignatureResult.REJECTED
              ? (signatureInfo?.reason ?? null)
              : null,
        });

        await runner.manager.save(signature);

        await runner.commitTransaction();

        return signature;
      } else if (signatures.length) {
        throw new BadRequestException('Already signed');
      }

      const signature = this.articleSignatureRepo.create({
        articleId: articleVersion.id,
        version: articleVersion.version,
        result,
        signerId: signatureInfo?.signerId ?? null,
        rejectReason:
          result === ArticleSignatureResult.REJECTED
            ? (signatureInfo?.reason ?? null)
            : null,
      });

      await runner.manager.save(signature);

      await runner.commitTransaction();

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

      const usedSet = new Set<BaseSignatureLevelEntity>();
      const targetLevelNames = new Set(
        this.signatureLevels.map((level) =>
          level instanceof BaseSignatureLevelEntity ? level.name : level,
        ),
      );

      const runner = this.dataSource.createQueryRunner();

      await runner.connect();
      await runner.startTransaction();

      try {
        await signatureLevels
          .filter((level) => !targetLevelNames.has(level.name))
          .map((level) => async () => {
            await runner.manager.delete(ArticleSignatureEntity, {
              signatureLevelId: level.id,
            });

            await runner.manager.softDelete(BaseSignatureLevelEntity, {
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
              const existedLevel = existedMap.get(
                level,
              ) as BaseSignatureLevelEntity;

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
          .reduce(
            (prev, next) => prev.then(next),
            Promise.resolve([] as BaseSignatureLevelEntity[]),
          );

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
