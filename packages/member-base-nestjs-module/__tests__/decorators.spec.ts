import 'reflect-metadata';
import { IS_ROUTE_PUBLIC, IsPublic } from '../src/decorators/is-public.decorator';
import { IS_ROUTE_ONLY_AUTHENTICATED, Authenticated } from '../src/decorators/authenticated.decorator';
import { AllowActions } from '../src/decorators/action.decorator';
import { Account } from '../src/decorators/account.decorator';
import { MemberId } from '../src/decorators/member-id.decorator';
import { HasPermission } from '../src/decorators/has-permission.decorator';

describe('Decorators', () => {
  describe('IsPublic', () => {
    it('should export IS_ROUTE_PUBLIC constant', () => {
      expect(IS_ROUTE_PUBLIC).toBe('IS_ROUTE_PUBLIC');
    });

    it('should set metadata when applied to a method', () => {
      class TestController {
        @IsPublic()
        testMethod(): void {}
      }

      const metadata = Reflect.getMetadata(IS_ROUTE_PUBLIC, TestController.prototype.testMethod);

      expect(metadata).toBe(true);
    });
  });

  describe('Authenticated', () => {
    it('should export IS_ROUTE_ONLY_AUTHENTICATED constant', () => {
      expect(IS_ROUTE_ONLY_AUTHENTICATED).toBe('IS_ROUTE_ONLY_AUTHENTICATED');
    });

    it('should set metadata when applied to a method', () => {
      class TestController {
        @Authenticated()
        testMethod(): void {}
      }

      const metadata = Reflect.getMetadata(IS_ROUTE_ONLY_AUTHENTICATED, TestController.prototype.testMethod);

      expect(metadata).toBe(true);
    });
  });

  describe('AllowActions', () => {
    it('should be defined', () => {
      expect(AllowActions).toBeDefined();
    });

    it('should be a reflector decorator', () => {
      expect(AllowActions.KEY).toBeDefined();
    });

    it('should set metadata when applied to a method', () => {
      class TestController {
        @AllowActions([['resource', 'read']])
        testMethod(): void {}
      }

      const metadata = Reflect.getMetadata(AllowActions.KEY, TestController.prototype.testMethod);

      expect(metadata).toEqual([['resource', 'read']]);
    });

    it('should support multiple actions', () => {
      class TestController {
        @AllowActions([
          ['resource1', 'read'],
          ['resource2', 'write'],
        ])
        testMethod(): void {}
      }

      const metadata = Reflect.getMetadata(AllowActions.KEY, TestController.prototype.testMethod);

      expect(metadata).toEqual([
        ['resource1', 'read'],
        ['resource2', 'write'],
      ]);
    });
  });

  describe('Account', () => {
    it('should be defined as a param decorator', () => {
      expect(Account).toBeDefined();
    });
  });

  describe('MemberId', () => {
    it('should be defined as a param decorator', () => {
      expect(MemberId).toBeDefined();
    });
  });

  describe('HasPermission', () => {
    it('should be defined as a param decorator', () => {
      expect(HasPermission).toBeDefined();
    });
  });
});
