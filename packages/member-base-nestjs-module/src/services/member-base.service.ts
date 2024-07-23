import { BadRequestException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { hash, verify } from 'argon2';
import { MemberEntity, MemberRepo } from '../models';
import { LOGIN_FAILED_BAN_THRESHOLD } from '../typings/member-base-providers';

@Injectable()
export class MemberBaseService {
  constructor(
    @Inject(MemberRepo)
    private readonly memberRepo: Repository<MemberEntity>,
    @Inject(LOGIN_FAILED_BAN_THRESHOLD)
    private readonly loginFailedBanThreshold: number,
  ) {}

  async register(account: string, password: string): Promise<MemberEntity> {
    const member = this.memberRepo.create({ account });

    member.password = await hash(password);

    try {
      await this.memberRepo.save(member);
    } catch (ex) {
      if (/unique/.test((ex as QueryFailedError).message)) {
        throw new BadRequestException('Member already exists');
      }
    }

    return member;
  }

  async login(account: string, password: string): Promise<MemberEntity | null> {
    const member = await this.memberRepo.findOne({
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

        await this.memberRepo.save(member);

        return member;
      } else {
        member.loginFailedCounter += 1;

        await this.memberRepo.save(member);

        throw new BadRequestException('Invalid password');
      }
    } catch (err) {
      throw new InternalServerErrorException('Password validation error');
    }
  }

  async resetLoginFailedCounter(id: string): Promise<MemberEntity> {
    const member = await this.memberRepo.findOne({ where: { id } });

    if (!member) {
      throw new BadRequestException('Member not found');
    }

    member.loginFailedCounter = 0;

    await this.memberRepo.save(member);

    return member;
  }
}
