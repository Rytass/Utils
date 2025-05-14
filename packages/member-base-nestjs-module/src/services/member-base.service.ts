import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { DeepPartial, QueryFailedError, Repository } from 'typeorm';
import { hash, verify } from 'argon2';
import { BaseMemberEntity } from '../models/base-member.entity';
import {
  ACCESS_TOKEN_EXPIRATION,
  ACCESS_TOKEN_SECRET,
  CUSTOMIZED_JWT_PAYLOAD,
  FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED,
  LOGIN_FAILED_AUTO_UNLOCK_SECONDS,
  LOGIN_FAILED_BAN_THRESHOLD,
  MEMBER_BASE_MODULE_OPTIONS,
  ONLY_RESET_REFRESH_TOKEN_EXPIRATION_BY_PASSWORD,
  PASSWORD_AGE_LIMIT_IN_DAYS,
  REFRESH_TOKEN_EXPIRATION,
  REFRESH_TOKEN_SECRET,
  RESET_PASSWORD_TOKEN_EXPIRATION,
  RESET_PASSWORD_TOKEN_SECRET,
  RESOLVED_MEMBER_REPO,
} from '../typings/member-base-providers';
import { sign, verify as verifyJWT } from 'jsonwebtoken';
import {
  MemberLoginLogEntity,
  MemberLoginLogRepo,
} from '../models/member-login-log.entity';
import { TokenPairDto } from '../dto/token-pair.dto';
import { MemberBaseModuleOptionsDto } from '../typings/member-base-module-options.dto';
import { PasswordValidatorService } from './password-validator.service';
import {
  MemberPasswordHistoryEntity,
  MemberPasswordHistoryRepo,
} from '../models/member-password-history.entity';
import {
  InvalidPasswordError,
  InvalidToken,
  MemberAlreadyExistedError,
  MemberBannedError,
  MemberNotFoundError,
  PasswordChangedError,
  PasswordDoesNotMeetPolicyError,
  PasswordExpiredError,
  PasswordShouldUpdatePasswordError,
  PasswordValidationError,
} from '../constants/errors/base.error';

@Injectable()
export class MemberBaseService<
  MemberEntity extends BaseMemberEntity = BaseMemberEntity,
> implements OnApplicationBootstrap
{
  constructor(
    @Inject(MEMBER_BASE_MODULE_OPTIONS)
    private readonly originalProvidedOptions:
      | MemberBaseModuleOptionsDto
      | undefined,
    @Inject(RESOLVED_MEMBER_REPO)
    private readonly baseMemberRepo: Repository<BaseMemberEntity>,
    @Inject(MemberLoginLogRepo)
    private readonly memberLoginLogRepo: Repository<MemberLoginLogEntity>,
    @Inject(LOGIN_FAILED_BAN_THRESHOLD)
    private readonly loginFailedBanThreshold: number,
    @Inject(RESET_PASSWORD_TOKEN_EXPIRATION)
    private readonly resetPasswordTokenExpiration: number,
    @Inject(RESET_PASSWORD_TOKEN_SECRET)
    private readonly resetPasswordTokenSecret: string,
    @Inject(ACCESS_TOKEN_SECRET)
    private readonly accessTokenSecret: string,
    @Inject(ACCESS_TOKEN_EXPIRATION)
    private readonly accessTokenExpiration: number,
    @Inject(REFRESH_TOKEN_SECRET)
    private readonly refreshTokenSecret: string,
    @Inject(REFRESH_TOKEN_EXPIRATION)
    private readonly refreshTokenExpiration: number,
    @Inject(ONLY_RESET_REFRESH_TOKEN_EXPIRATION_BY_PASSWORD)
    private readonly onlyResetRefreshTokenExpirationByPassword: boolean,
    @Inject(MemberPasswordHistoryRepo)
    private readonly memberPasswordHistoryRepo: Repository<MemberPasswordHistoryEntity>,
    @Inject(PASSWORD_AGE_LIMIT_IN_DAYS)
    private readonly passwordAgeLimitInDays: number | undefined,
    @Inject(FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED)
    private readonly forceRejectLoginOnPasswordExpired: boolean,
    @Inject(PasswordValidatorService)
    private readonly passwordValidatorService: PasswordValidatorService,
    @Inject(CUSTOMIZED_JWT_PAYLOAD)
    private readonly customizedJwtPayload: (
      member: BaseMemberEntity,
    ) => Pick<BaseMemberEntity, 'id' | 'account'>,
    @Inject(LOGIN_FAILED_AUTO_UNLOCK_SECONDS)
    private readonly loginFailedAutoUnlockSeconds: number | null,
  ) {}

  private readonly logger = new Logger(MemberBaseService.name);

  onApplicationBootstrap(): void {
    if (
      !this.originalProvidedOptions?.accessTokenSecret ||
      !this.originalProvidedOptions?.refreshTokenSecret
    ) {
      this.logger.warn(
        'No access token secret or refresh token secret provided, using random secret',
      );
    }
  }

  signRefreshToken(member: BaseMemberEntity): string {
    return sign(
      {
        ...this.customizedJwtPayload(member),
        passwordChangedAt: member.passwordChangedAt?.getTime() ?? null,
      },
      this.refreshTokenSecret,
      {
        expiresIn: this.validateExpiration(
          this.refreshTokenExpiration,
          'REFRESH_TOKEN_EXPIRATION',
        ),
      },
    );
  }

  signAccessToken(member: BaseMemberEntity): string {
    return sign(
      {
        ...this.customizedJwtPayload(member),
      },
      this.accessTokenSecret,
      {
        expiresIn: this.validateExpiration(
          this.accessTokenExpiration,
          'ACCESS_TOKEN_EXPIRATION',
        ),
      },
    );
  }

  async getResetPasswordToken(account: string): Promise<string> {
    const member = await this.baseMemberRepo.findOne({
      where: { account },
    });

    if (!member) {
      throw new MemberNotFoundError();
    }

    const requestedOn = new Date();

    member.resetPasswordRequestedAt = requestedOn;

    await this.baseMemberRepo.save(member);

    const token = sign(
      {
        id: member.id,
        requestedOn: requestedOn.getTime(),
      },
      this.resetPasswordTokenSecret,
      {
        expiresIn: this.validateExpiration(
          this.resetPasswordTokenExpiration,
          'RESET_PASSWORD_TOKEN_EXPIRATION',
        ),
      },
    );

    return token;
  }

  async changePassword<T extends MemberEntity = MemberEntity>(
    id: string,
    originPassword: string,
    newPassword: string,
  ): Promise<T> {
    if (
      !(await this.passwordValidatorService.validatePassword(newPassword, id))
    ) {
      throw new PasswordDoesNotMeetPolicyError();
    }

    const member = await this.baseMemberRepo.findOne({ where: { id } });

    if (!member) {
      throw new MemberNotFoundError();
    }

    try {
      if (await verify(member.password, originPassword)) {
        member.password = await hash(newPassword);
        member.passwordChangedAt = new Date();
        member.shouldUpdatePassword = false;

        await this.baseMemberRepo.save(member);

        await this.memberPasswordHistoryRepo.save(
          this.memberPasswordHistoryRepo.create({
            memberId: member.id,
            password: member.password,
          }),
        );

        return member as T;
      } else {
        throw new InvalidPasswordError();
      }
    } catch (err) {
      throw new PasswordValidationError();
    }
  }

  async changePasswordWithToken<T extends MemberEntity = MemberEntity>(
    token: string,
    newPassword: string,
  ): Promise<T> {
    try {
      const { id, requestedOn } = verifyJWT(
        token,
        this.resetPasswordTokenSecret,
      ) as { id: string; requestedOn: number };

      if (
        !(await this.passwordValidatorService.validatePassword(newPassword, id))
      ) {
        throw new PasswordDoesNotMeetPolicyError();
      }

      const member = await this.baseMemberRepo.findOne({
        where: {
          id,
          resetPasswordRequestedAt: new Date(requestedOn),
        },
      });

      if (!member) {
        throw new InvalidToken();
      }

      member.password = await hash(newPassword);
      member.passwordChangedAt = new Date();
      member.shouldUpdatePassword = false;
      member.resetPasswordRequestedAt = null;

      await this.baseMemberRepo.save(member);

      await this.memberPasswordHistoryRepo.save(
        this.memberPasswordHistoryRepo.create({
          memberId: member.id,
          password: member.password,
        }),
      );

      return member as T;
    } catch (ex) {
      throw new InvalidToken();
    }
  }

  async register<T extends MemberEntity = MemberEntity>(
    account: string,
    password: string,
    memberOptions?: DeepPartial<Omit<T, 'account' | 'password'>>,
  ): Promise<T> {
    if (!(await this.passwordValidatorService.validatePassword(password))) {
      throw new PasswordDoesNotMeetPolicyError();
    }

    let member = this.baseMemberRepo.create({ account });

    member.password = await hash(password);

    try {
      member = await this.baseMemberRepo.save({
        ...memberOptions,
        account: member.account,
        password: member.password,
      });

      await this.memberPasswordHistoryRepo.save(
        this.memberPasswordHistoryRepo.create({
          memberId: member.id,
          password: member.password,
        }),
      );
    } catch (ex) {
      if (/unique/.test((ex as QueryFailedError).message)) {
        throw new MemberAlreadyExistedError();
      }
    }

    return member as T;
  }

  async registerWithoutPassword<T extends MemberEntity = MemberEntity>(
    account: string,
    memberOptions?: DeepPartial<Omit<T, 'account' | 'password'>>,
  ): Promise<[T, string]> {
    const password = this.passwordValidatorService.generateValidPassword();

    let member = this.baseMemberRepo.create({ account });

    member.password = await hash(password);

    try {
      member = await this.baseMemberRepo.save({
        shouldUpdatePassword: true,
        ...memberOptions,
        account: member.account,
        password: member.password,
      });

      await this.memberPasswordHistoryRepo.save(
        this.memberPasswordHistoryRepo.create({
          memberId: member.id,
          password: member.password,
        }),
      );
    } catch (ex) {
      if (/unique/.test((ex as QueryFailedError).message)) {
        throw new MemberAlreadyExistedError();
      }
    }

    return [member as T, password];
  }

  async refreshToken(refreshToken: string): Promise<TokenPairDto> {
    try {
      const { id, account, passwordChangedAt, exp } = verifyJWT(
        refreshToken,
        this.refreshTokenSecret,
      ) as {
        id: string;
        account: string;
        passwordChangedAt: number | null;
        exp: number;
      };

      const member = await this.baseMemberRepo.findOne({
        where: { id, account },
      });

      if (!member) {
        throw new MemberNotFoundError();
      }

      if (member.passwordChangedAt?.getTime() !== passwordChangedAt) {
        throw new PasswordChangedError();
      }

      return {
        accessToken: this.signAccessToken(member),
        refreshToken: this.signRefreshToken(member),
      };
    } catch (ex) {
      if (ex instanceof BadRequestException) throw ex;

      throw new InvalidToken();
    }
  }

  async login(
    account: string,
    password: string,
    ip?: string,
  ): Promise<TokenPairDto> {
    const member = await this.baseMemberRepo.findOne({
      where: { account },
    });

    if (!member) {
      throw new MemberNotFoundError();
    }

    if (member.loginFailedCounter >= this.loginFailedBanThreshold) {
      if (this.loginFailedAutoUnlockSeconds) {
        const latestFailedRecord = await this.memberLoginLogRepo.findOne({
          order: {
            createdAt: 'DESC',
          },
          where: {
            memberId: member.id,
            success: false,
          },
        });

        if (
          !latestFailedRecord ||
          latestFailedRecord.createdAt.getTime() +
            this.loginFailedAutoUnlockSeconds * 1000 >
            Date.now()
        ) {
          throw new MemberBannedError();
        }
      } else {
        throw new MemberBannedError();
      }
    }

    const isPasswordExpired = this.passwordAgeLimitInDays
      ? this.passwordValidatorService.shouldUpdatePassword(member)
      : false;

    if (isPasswordExpired && this.forceRejectLoginOnPasswordExpired) {
      throw new PasswordExpiredError();
    }

    try {
      if (await verify(member.password, password)) {
        if (member.shouldUpdatePassword) {
          throw new PasswordShouldUpdatePasswordError();
        }

        member.loginFailedCounter = 0;

        await this.baseMemberRepo.save(member);

        // async log
        this.memberLoginLogRepo.save({
          memberId: member.id,
          success: true,
          ip: ip ? `${ip}/32` : null,
        });

        return {
          accessToken: this.signAccessToken(member),
          refreshToken: this.signRefreshToken(member),
          ...(this.passwordAgeLimitInDays
            ? {
                shouldUpdatePassword: isPasswordExpired,
                passwordChangedAt: member.passwordChangedAt?.toISOString(),
              }
            : {}),
        };
      }

      member.loginFailedCounter += 1;

      await this.baseMemberRepo.save(member);

      // async log
      this.memberLoginLogRepo.save({
        memberId: member.id,
        success: false,
        ip: ip ? `${ip}/32` : null,
      });

      throw new InvalidPasswordError();
    } catch (err) {
      if (err instanceof BadRequestException) throw err;

      throw new PasswordValidationError();
    }
  }

  async resetLoginFailedCounter<T extends MemberEntity = MemberEntity>(
    id: string,
  ): Promise<T> {
    const member = await this.baseMemberRepo.findOne({ where: { id } });

    if (!member) {
      throw new MemberNotFoundError();
    }

    member.loginFailedCounter = 0;

    await this.baseMemberRepo.save(member);

    return member as T;
  }

  private validateExpiration(source: unknown, tokenName: string): number {
    if (typeof source !== 'number' || Number.isNaN(source)) {
      throw new BadRequestException(
        `[${tokenName}] must be a number (in seconds), but got: ${source}`,
      );
    }

    return source;
  }
}
