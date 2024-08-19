import { Inject, Injectable } from '@nestjs/common';
import { BaseMemberEntity } from '../models';
import { Repository } from 'typeorm';
import { hash } from 'argon2';
import { RESOLVED_MEMBER_REPO } from '../typings/member-base-providers';
import { PasswordValidatorService } from './password-validator.service';
import {
  MemberPasswordHistoryEntity,
  MemberPasswordHistoryRepo,
} from '../models/member-password-history.entity';
import {
  MemberNotFoundError,
  PasswordDoesNotMeetPolicyError,
} from '../constants/errors/base.error';

@Injectable()
export class MemberBaseAdminService<
  MemberEntity extends BaseMemberEntity = BaseMemberEntity,
> {
  constructor(
    @Inject(RESOLVED_MEMBER_REPO)
    private readonly baseMemberRepo: Repository<BaseMemberEntity>,
    @Inject(PasswordValidatorService)
    private readonly passwordValidatorService: PasswordValidatorService,
    @Inject(MemberPasswordHistoryRepo)
    private readonly memberPasswordHistoryRepo: Repository<MemberPasswordHistoryEntity>,
  ) {}

  async archiveMember(id: string): Promise<void> {
    const member = await this.baseMemberRepo.findOne({
      where: {
        id,
      },
    });

    if (!member) {
      throw new MemberNotFoundError();
    }

    await this.baseMemberRepo.softRemove(member);
  }

  async resetMemberPassword<T extends MemberEntity = MemberEntity>(
    id: string,
    newPassword: string,
    ignorePasswordPolicy = false,
  ): Promise<T> {
    if (
      !ignorePasswordPolicy &&
      !(await this.passwordValidatorService.validatePassword(newPassword))
    ) {
      throw new PasswordDoesNotMeetPolicyError();
    }

    const member = await this.baseMemberRepo.findOne({
      where: {
        id,
      },
    });

    if (!member) {
      throw new MemberNotFoundError();
    }

    member.password = await hash(newPassword);
    member.passwordChangedAt = new Date();

    await this.baseMemberRepo.save(member);

    await this.memberPasswordHistoryRepo.save(
      this.memberPasswordHistoryRepo.create({
        memberId: member.id,
        password: member.password,
      }),
    );

    return member as T;
  }
}
