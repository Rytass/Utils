import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { BaseMemberEntity } from '../models';
import { Repository } from 'typeorm';
import { hash } from 'argon2';
import { BaseMemberRepo } from '../models/base-member.entity';

@Injectable()
export class MemberBaseAdminService {
  constructor(
    @Inject(BaseMemberRepo)
    private readonly baseMemberRepo: Repository<BaseMemberEntity>,
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
  ): Promise<BaseMemberEntity> {
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

    return member;
  }
}