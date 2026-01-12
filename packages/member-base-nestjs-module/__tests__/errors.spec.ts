import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import {
  MemberNotFoundError,
  PasswordDoesNotMeetPolicyError,
  InvalidPasswordError,
  PasswordValidationError,
  InvalidToken,
  MemberAlreadyExistedError,
  PasswordChangedError,
  MemberBannedError,
  PasswordExpiredError,
  PasswordShouldUpdatePasswordError,
  PasswordInHistoryError,
} from '../src/constants/errors/base.error';

describe('Member Base Errors', () => {
  describe('MemberNotFoundError', () => {
    it('should be an instance of BadRequestException', () => {
      const error = new MemberNotFoundError();

      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('should have correct message', () => {
      const error = new MemberNotFoundError();

      expect(error.message).toBe('Member not found');
    });

    it('should have code 100', () => {
      const error = new MemberNotFoundError();

      expect(error.code).toBe(100);
    });
  });

  describe('PasswordDoesNotMeetPolicyError', () => {
    it('should be an instance of BadRequestException', () => {
      const error = new PasswordDoesNotMeetPolicyError();

      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('should have correct message', () => {
      const error = new PasswordDoesNotMeetPolicyError();

      expect(error.message).toBe('Password does not meet the policy');
    });

    it('should have code 101', () => {
      const error = new PasswordDoesNotMeetPolicyError();

      expect(error.code).toBe(101);
    });
  });

  describe('InvalidPasswordError', () => {
    it('should be an instance of BadRequestException', () => {
      const error = new InvalidPasswordError();

      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('should have correct message', () => {
      const error = new InvalidPasswordError();

      expect(error.message).toBe('Invalid password');
    });

    it('should have code 102', () => {
      const error = new InvalidPasswordError();

      expect(error.code).toBe(102);
    });
  });

  describe('PasswordValidationError', () => {
    it('should be an instance of InternalServerErrorException', () => {
      const error = new PasswordValidationError();

      expect(error).toBeInstanceOf(InternalServerErrorException);
    });

    it('should have correct message', () => {
      const error = new PasswordValidationError();

      expect(error.message).toBe('Password validation error');
    });

    it('should have code 103', () => {
      const error = new PasswordValidationError();

      expect(error.code).toBe(103);
    });
  });

  describe('InvalidToken', () => {
    it('should be an instance of BadRequestException', () => {
      const error = new InvalidToken();

      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('should have correct message', () => {
      const error = new InvalidToken();

      expect(error.message).toBe('Invalid token');
    });

    it('should have code 104', () => {
      const error = new InvalidToken();

      expect(error.code).toBe(104);
    });
  });

  describe('MemberAlreadyExistedError', () => {
    it('should be an instance of BadRequestException', () => {
      const error = new MemberAlreadyExistedError();

      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('should have correct message', () => {
      const error = new MemberAlreadyExistedError();

      expect(error.message).toBe('Member already existed');
    });

    it('should have code 105', () => {
      const error = new MemberAlreadyExistedError();

      expect(error.code).toBe(105);
    });
  });

  describe('PasswordChangedError', () => {
    it('should be an instance of BadRequestException', () => {
      const error = new PasswordChangedError();

      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('should have correct message', () => {
      const error = new PasswordChangedError();

      expect(error.message).toBe('Password changed, please sign in again');
    });

    it('should have code 106', () => {
      const error = new PasswordChangedError();

      expect(error.code).toBe(106);
    });
  });

  describe('MemberBannedError', () => {
    it('should be an instance of BadRequestException', () => {
      const error = new MemberBannedError();

      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('should have correct message', () => {
      const error = new MemberBannedError();

      expect(error.message).toBe('Member banned');
    });

    it('should have code 107', () => {
      const error = new MemberBannedError();

      expect(error.code).toBe(107);
    });
  });

  describe('PasswordExpiredError', () => {
    it('should be an instance of BadRequestException', () => {
      const error = new PasswordExpiredError();

      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('should have correct message', () => {
      const error = new PasswordExpiredError();

      expect(error.message).toBe('Password expired, please update password');
    });

    it('should have code 108', () => {
      const error = new PasswordExpiredError();

      expect(error.code).toBe(108);
    });
  });

  describe('PasswordShouldUpdatePasswordError', () => {
    it('should be an instance of BadRequestException', () => {
      const error = new PasswordShouldUpdatePasswordError();

      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('should have correct message', () => {
      const error = new PasswordShouldUpdatePasswordError();

      expect(error.message).toBe('Member should update password before login');
    });

    it('should have code 109', () => {
      const error = new PasswordShouldUpdatePasswordError();

      expect(error.code).toBe(109);
    });
  });

  describe('PasswordInHistoryError', () => {
    it('should be an instance of BadRequestException', () => {
      const error = new PasswordInHistoryError();

      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('should have correct message', () => {
      const error = new PasswordInHistoryError();

      expect(error.message).toBe('Password is in history');
    });

    it('should have code 110', () => {
      const error = new PasswordInHistoryError();

      expect(error.code).toBe(110);
    });
  });
});
