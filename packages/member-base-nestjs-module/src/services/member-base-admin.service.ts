import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { BaseMemberEntity } from '../models';
import { Repository } from 'typeorm';
import { hash } from 'argon2';
import { RESOLVED_MEMBER_REPO } from '../typings/member-base-providers';
import { PasswordValidatorService } from './password-validator.service';
import {
  MemberPasswordHistoryEntity,
  MemberPasswordHistoryRepo,
} from '../models/member-password-history.entity';

@Injectable()
export class MemberBaseAdminService {
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
      throw new BadRequestException('Member not found');
    }

    await this.baseMemberRepo.softRemove(member);
  }

  async resetMemberPassword(
    id: string,
    newPassword: string,
    ignorePasswordPolicy = false,
  ): Promise<BaseMemberEntity> {
    if (
      !ignorePasswordPolicy &&
      !(await this.passwordValidatorService.validatePassword(newPassword))
    ) {
      throw new BadRequestException('Password does not meet the policy');
    }

    const member = await this.baseMemberRepo.findOne({
      where: {
        id,
      },
    });

    if (!member) {
      throw new BadRequestException('Member not found');
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

    return member;
  }
}
