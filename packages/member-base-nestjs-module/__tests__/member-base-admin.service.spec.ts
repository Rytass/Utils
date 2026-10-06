import { hash } from 'argon2';
import { Repository } from 'typeorm';
import { MemberBaseAdminService } from '../src/services/member-base-admin.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import { PasswordValidatorService } from '../src/services/password-validator.service';
import { MemberPasswordHistoryEntity } from '../src/models/member-password-history.entity';
import { asSessionService, createFakeSessionService } from './__utils__/fake-session-service';

const createMemberRepo = (member: BaseMemberEntity): Repository<BaseMemberEntity> =>
  ({
    findOne: jest.fn(async () => member),
    save: jest.fn(async (entity: BaseMemberEntity) => entity),
  }) as unknown as Repository<BaseMemberEntity>;

const createHistoryRepo = (): Repository<MemberPasswordHistoryEntity> =>
  ({
    create: jest.fn((entity: MemberPasswordHistoryEntity) => entity),
    save: jest.fn(async (entity: MemberPasswordHistoryEntity) => entity),
  }) as unknown as Repository<MemberPasswordHistoryEntity>;

describe('MemberBaseAdminService.resetMemberPassword', () => {
  it('should clear the login failure counter when an admin force-resets the password', async () => {
    const member = new BaseMemberEntity();

    member.id = '00000000-0000-0000-0000-000000000002';
    member.account = 'locked-user';
    member.password = await hash('OldPassw0rd!');
    member.passwordChangedAt = new Date('2020-01-01T00:00:00.000Z');
    member.loginFailedCounter = 5;

    const passwordValidatorService = {
      validatePassword: jest.fn(async () => true),
    } as unknown as PasswordValidatorService;

    const sessions = createFakeSessionService();

    const service = new MemberBaseAdminService(
      createMemberRepo(member),
      passwordValidatorService,
      createHistoryRepo(),
      {},
      asSessionService(sessions),
    );

    await service.resetMemberPassword(member.id, 'BrandNewPassw0rd!');

    expect(member.loginFailedCounter).toBe(0);

    // The member did not choose this password: every session it had ends.
    expect(sessions.revokeAllSessions).toHaveBeenCalledTimes(1);
    expect(sessions.revokeAllSessions).toHaveBeenCalledWith(member.id, { reason: 'admin' });
  });
});
