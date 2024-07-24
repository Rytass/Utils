import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { hash, verify } from 'argon2';
import { BaseMemberEntity } from '../models';
import {
  LOGIN_FAILED_BAN_THRESHOLD,
  RESET_PASSWORD_TOKEN_EXPIRATION,
  RESET_PASSWORD_TOKEN_SECRET,
} from '../typings/member-base-providers';
import { sign, verify as verifyJWT } from 'jsonwebtoken';
import {
  MemberLoginLogEntity,
  MemberLoginLogRepo,
} from '../models/member-login-log.entity';
import { BaseMemberRepo } from '../models/base-member.entity';

@Injectable()
export class MemberBaseService {
  constructor(
    @Inject(BaseMemberRepo)
    private readonly baseMemberRepo: Repository<BaseMemberEntity>,
    @Inject(MemberLoginLogRepo)
    private readonly memberLoginLogRepo: Repository<MemberLoginLogEntity>,
    @Inject(LOGIN_FAILED_BAN_THRESHOLD)
    private readonly loginFailedBanThreshold: number,
    @Inject(RESET_PASSWORD_TOKEN_EXPIRATION)
    private readonly resetPasswordTokenExpiration: number,
    @Inject(RESET_PASSWORD_TOKEN_SECRET)
    private readonly resetPasswordTokenSecret: string,
  ) {}

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

  async changePasswordWithToken(
    token: string,
    newPassword: string,
  ): Promise<BaseMemberEntity> {
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

      await this.baseMemberRepo.save(member);

      return member;
    } catch (ex) {
      throw new BadRequestException('Invalid token');
    }
  }

  async register(account: string, password: string): Promise<BaseMemberEntity> {
    const member = this.baseMemberRepo.create({ account });

    member.password = await hash(password);

    try {
      await this.baseMemberRepo.save(member);
    } catch (ex) {
      if (/unique/.test((ex as QueryFailedError).message)) {
        throw new BadRequestException('Member already exists');
      }
    }

    return member;
  }

  async login(
    account: string,
    password: string,
    ip?: string,
  ): Promise<BaseMemberEntity | null> {
    const member = await this.baseMemberRepo.findOne({
      where: { account },
    });

    if (!member) {
      throw new BadRequestException('Member not found');
    }

    if (member.loginFailedCounter >= this.loginFailedBanThreshold) {
      throw new BadRequestException('Member is banned');
    }

    try {
      if (await verify(member.password, password)) {
        member.loginFailedCounter = 0;

        await this.baseMemberRepo.save(member);

        // async log
        this.memberLoginLogRepo.save({
          memberId: member.id,
          success: true,
          ip: ip ? `${ip}/32` : null,
        });

        return member;
      } else {
        member.loginFailedCounter += 1;

        await this.baseMemberRepo.save(member);

        // async log
        this.memberLoginLogRepo.save({
          memberId: member.id,
          success: false,
          ip: ip ? `${ip}/32` : null,
        });

        throw new BadRequestException('Invalid password');
      }
    } catch (err) {
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
