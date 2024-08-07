import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { hash, verify } from 'argon2';
import { BaseMemberEntity } from '../models/base-member.entity';
import {
  ACCESS_TOKEN_EXPIRATION,
  ACCESS_TOKEN_SECRET,
  FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED,
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

@Injectable()
export class MemberBaseService implements OnApplicationBootstrap {
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
    private readonly passwordValidatorService: PasswordValidatorService,
    @Inject(MemberPasswordHistoryRepo)
    private readonly memberPasswordHistoryRepo: Repository<MemberPasswordHistoryEntity>,
    @Inject(PASSWORD_AGE_LIMIT_IN_DAYS)
    private readonly passwordAgeLimitInDays: number | undefined,
    @Inject(FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED)
    private readonly forceRejectLoginOnPasswordExpired: boolean,
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

  async getResetPasswordToken(account: string): Promise<string> {
    const member = await this.baseMemberRepo.findOne({
      where: { account },
    });

    if (!member) {
      throw new BadRequestException('Member not found');
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
        expiresIn: this.resetPasswordTokenExpiration,
      },
    );

    return token;
  }

  async changePassword(
    id: string,
    originPassword: string,
    newPassword: string,
  ): Promise<BaseMemberEntity> {
    if (!(await this.passwordValidatorService.validatePassword(newPassword))) {
      throw new BadRequestException('Password does not meet the policy');
    }

    const member = await this.baseMemberRepo.findOne({ where: { id } });

    if (!member) {
      throw new BadRequestException('Member not found');
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

        return member;
      } else {
        throw new BadRequestException('Invalid password');
      }
    } catch (err) {
      throw new InternalServerErrorException('Password validation error');
    }
  }

  async changePasswordWithToken(
    token: string,
    newPassword: string,
  ): Promise<BaseMemberEntity> {
    if (!(await this.passwordValidatorService.validatePassword(newPassword))) {
      throw new BadRequestException('Password does not meet the policy');
    }

    try {
      const { id, requestedOn } = verifyJWT(
        token,
        this.resetPasswordTokenSecret,
      ) as { id: string; requestedOn: number };

      const member = await this.baseMemberRepo.findOne({
        where: {
          id,
          resetPasswordRequestedAt: new Date(requestedOn),
        },
      });

      if (!member) {
        throw new BadRequestException('Invalid token');
      }

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

      return member;
    } catch (ex) {
      throw new BadRequestException('Invalid token');
    }
  }

  async register(account: string, password: string): Promise<BaseMemberEntity> {
    if (!(await this.passwordValidatorService.validatePassword(password))) {
      throw new BadRequestException('Password does not meet the policy');
    }

    const member = this.baseMemberRepo.create({ account });

    member.password = await hash(password);

    try {
      await this.baseMemberRepo.save(member);

      await this.memberPasswordHistoryRepo.save(
        this.memberPasswordHistoryRepo.create({
          memberId: member.id,
          password: member.password,
        }),
      );
    } catch (ex) {
      if (/unique/.test((ex as QueryFailedError).message)) {
        throw new BadRequestException('Member already exists');
      }
    }

    return member;
  }

  async registerWithoutPassword(
    account: string,
  ): Promise<[BaseMemberEntity, string]> {
    const password = this.passwordValidatorService.generateValidPassword();

    const member = this.baseMemberRepo.create({ account });

    member.password = await hash(password);
    member.shouldUpdatePassword = true;

    try {
      await this.baseMemberRepo.save(member);

      await this.memberPasswordHistoryRepo.save(
        this.memberPasswordHistoryRepo.create({
          memberId: member.id,
          password: member.password,
        }),
      );
    } catch (ex) {
      if (/unique/.test((ex as QueryFailedError).message)) {
        throw new BadRequestException('Member already exists');
      }
    }

    return [member, password];
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
        throw new BadRequestException('Member not found');
      }

      if (member.passwordChangedAt?.getTime() !== passwordChangedAt) {
        throw new BadRequestException('Password changed, please sign in again');
      }

      return {
        accessToken: sign(
          {
            id: member.id,
            account: member.account,
          },
          this.accessTokenSecret,
          { expiresIn: this.accessTokenExpiration },
        ),
        refreshToken: sign(
          {
            id: member.id,
            account: member.account,
            passwordChangedAt: member.passwordChangedAt?.getTime() ?? null,
          },
          this.refreshTokenSecret,
          {
            expiresIn: this.onlyResetRefreshTokenExpirationByPassword
              ? Math.round((exp * 1000 - Date.now()) / 1000)
              : this.refreshTokenExpiration,
          },
        ),
      };
    } catch (ex) {
      if (ex instanceof BadRequestException) throw ex;

      throw new BadRequestException('Invalid token');
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
      throw new BadRequestException('Member not found');
    }

    if (member.loginFailedCounter >= this.loginFailedBanThreshold) {
      throw new BadRequestException('Member is banned');
    }

    const isPasswordExpired = this.passwordAgeLimitInDays
      ? this.passwordValidatorService.shouldUpdatePassword(member)
      : false;

    if (isPasswordExpired && this.forceRejectLoginOnPasswordExpired) {
      throw new BadRequestException('Password expired, please update password');
    }

    try {
      if (await verify(member.password, password)) {
        if (member.shouldUpdatePassword) {
          throw new BadRequestException(
            'Member should update password before login',
          );
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
          accessToken: sign(
            {
              id: member.id,
              account: member.account,
            },
            this.accessTokenSecret,
            {
              expiresIn: this.accessTokenExpiration,
            },
          ),
          refreshToken: sign(
            {
              id: member.id,
              account: member.account,
              passwordChangedAt: member.passwordChangedAt?.getTime() ?? null,
            },
            this.refreshTokenSecret,
            {
              expiresIn: this.refreshTokenExpiration,
            },
          ),
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

      throw new BadRequestException('Invalid password');
    } catch (err) {
      if (err instanceof BadRequestException) throw err;

      throw new InternalServerErrorException('Password validation error');
    }
  }

  async resetLoginFailedCounter(id: string): Promise<BaseMemberEntity> {
    const member = await this.baseMemberRepo.findOne({ where: { id } });

    if (!member) {
      throw new BadRequestException('Member not found');
    }

    member.loginFailedCounter = 0;

    await this.baseMemberRepo.save(member);

    return member;
  }
}
