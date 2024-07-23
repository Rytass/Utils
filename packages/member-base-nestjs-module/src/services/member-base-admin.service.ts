import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { MemberEntity, MemberRepo } from '../models';
import { Repository } from 'typeorm';
import { hash } from 'argon2';

@Injectable()
export class MemberBaseAdminService {
  constructor(
    @Inject(MemberRepo)
    private readonly memberRepo: Repository<MemberEntity>,
  ) {}

  async archiveMember(id: string): Promise<void> {
    const member = await this.memberRepo.findOne({
      where: {
        id,
      },
    });

    if (!member) {
      throw new BadRequestException('Member not found');
    }

    await this.memberRepo.softRemove(member);
  }

  async resetMemberPassword(
    id: string,
    newPassword: string,
  ): Promise<MemberEntity> {
    const member = await this.memberRepo.findOne({
      where: {
        id,
      },
    });

    if (!member) {
      throw new BadRequestException('Member not found');
    }

    member.password = await hash(newPassword);
    member.passwordChangedAt = new Date();

    await this.memberRepo.save(member);

    return member;
  }
}
