import { hash } from 'argon2';
import { Repository } from 'typeorm';
import { PasswordValidatorService } from '../src/services/password-validator.service';
import { MemberPasswordHistoryEntity } from '../src/models/member-password-history.entity';

interface ValidatorOptions {
  special?: boolean;
  regexp?: RegExp;
  historyLimit?: number;
  histories?: string[];
}

const createValidator = ({
  special = false,
  regexp,
  historyLimit,
  histories = [],
}: ValidatorOptions = {}): PasswordValidatorService => {
  const qb = {
    andWhere: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(histories.map(password => ({ password }))),
  };

  const repo = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  } as unknown as Repository<MemberPasswordHistoryEntity>;

  return new PasswordValidatorService(false, false, false, special, 8, regexp, historyLimit, repo, undefined);
};

describe('PasswordValidatorService custom regexp together with password history', () => {
  it('should reject when the regexp fails, whatever the history says', async () => {
    const validator = createValidator({ regexp: /^\d{8,}$/, historyLimit: 3 });

    await expect(validator.validatePassword('notdigits')).resolves.toBe(false);
  });

  it('should accept when the regexp passes and the password is new', async () => {
    const validator = createValidator({
      regexp: /^\d{8,}$/,
      historyLimit: 3,
      histories: [await hash('11111111')],
    });

    await expect(validator.validatePassword('22222222')).resolves.toBe(true);
  });

  it('should reject when the regexp passes but the password is in the history', async () => {
    const validator = createValidator({
      regexp: /^\d{8,}$/,
      historyLimit: 3,
      histories: [await hash('11111111'), await hash('22222222')],
    });

    await expect(validator.validatePassword('22222222', 'member-1')).resolves.toBe(false);
  });
});
