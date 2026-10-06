import { Inject, Injectable, Logger } from '@nestjs/common';
import { BaseMemberEntity } from '../models/base-member.entity';
import { Repository } from 'typeorm';
import { hash } from 'argon2';
import { RESOLVED_MEMBER_REPO } from '../typings/member-base-providers';
import { PasswordValidatorService } from './password-validator.service';
import { MemberPasswordHistoryEntity, MemberPasswordHistoryRepo } from '../models/member-password-history.entity';
import { PASSWORD_HASH_OPTIONS } from '../typings/member-base.tokens';
import type { PasswordHashOptions } from '../typings/password-hash-options';
import { MemberNotFoundError, PasswordDoesNotMeetPolicyError } from '../constants/errors/base.error';
import { MemberSessionService } from './member-session.service';

@Injectable()
export class MemberBaseAdminService<MemberEntity extends BaseMemberEntity = BaseMemberEntity> {
  private readonly logger = new Logger(MemberBaseAdminService.name);

  constructor(
    @Inject(RESOLVED_MEMBER_REPO)
    private readonly baseMemberRepo: Repository<BaseMemberEntity>,
    @Inject(PasswordValidatorService)
    private readonly passwordValidatorService: PasswordValidatorService,
    @Inject(MemberPasswordHistoryRepo)
    private readonly memberPasswordHistoryRepo: Repository<MemberPasswordHistoryEntity>,
    @Inject(PASSWORD_HASH_OPTIONS)
    private readonly passwordHashOptions: PasswordHashOptions,
    @Inject(MemberSessionService)
    private readonly memberSessionService: MemberSessionService,
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

    // First, so that a failure leaves the member active rather than archived
    // with sessions that a later restore would bring back to life.
    await this.memberSessionService.revokeAllSessions(member.id, { reason: 'admin' });

    await this.baseMemberRepo.softRemove(member);

    // And again: a login that completed between the two statements above
    // opened a session the first pass could not see. The member is archived
    // by now, so this one is logged rather than undone if it fails.
    await this.memberSessionService.revokeAllSessions(member.id, { reason: 'admin' }).catch((error: unknown) => {
      this.logger.error(
        `Member ${member.id} was archived but a session opened during archiving could not be revoked: ${
          error instanceof Error ? error.message : error
        }`,
      );
    });
  }

  async resetMemberPassword<T extends MemberEntity = MemberEntity>(
    id: string,
    newPassword: string,
    ignorePasswordPolicy = false,
  ): Promise<T> {
    if (!ignorePasswordPolicy && !(await this.passwordValidatorService.validatePassword(newPassword, id))) {
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

    member.password = await hash(newPassword, this.passwordHashOptions);
    member.passwordChangedAt = new Date();
    // An admin-forced password reset is expected to also unlock the account,
    // mirroring the self-service reset flow (changePasswordWithToken).
    member.loginFailedCounter = 0;

    await this.baseMemberRepo.save(member);

    await this.memberPasswordHistoryRepo.save(
      this.memberPasswordHistoryRepo.create({
        memberId: member.id,
        password: member.password,
      }),
    );

    // The member did not choose this password and may not know it yet; every
    // session opened under the old one ends here. The password has been written
    // by now, so a failure is logged, not thrown — the same as a member's own
    // password change. Refresh tokens issued before it embed the old
    // passwordChangedAt and are refused on that alone.
    await this.memberSessionService.revokeAllSessions(member.id, { reason: 'admin' }).catch((error: unknown) => {
      this.logger.error(
        `Password of member ${member.id} was reset but its sessions could not be revoked; their refresh tokens are ` +
          `still refused by the passwordChangedAt check. ${error instanceof Error ? error.message : error}`,
      );
    });

    return member as T;
  }
}
