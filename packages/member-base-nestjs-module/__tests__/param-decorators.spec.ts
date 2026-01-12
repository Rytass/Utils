import 'reflect-metadata';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Account } from '../src/decorators/account.decorator';
import { MemberId } from '../src/decorators/member-id.decorator';
import { HasPermission } from '../src/decorators/has-permission.decorator';

// Helper to get the factory function from a param decorator
function getParamDecoratorFactory(
  decorator: (...args: unknown[]) => ParameterDecorator,
): (data: unknown, ctx: unknown) => unknown {
  class TestClass {
    testMethod(@decorator() _value: unknown): void {}
  }

  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestClass, 'testMethod');
  const key = Object.keys(metadata)[0];

  return metadata[key].factory;
}

// Helper to get the factory function from a param decorator with data
function getParamDecoratorFactoryWithData(
  decorator: (data: unknown) => ParameterDecorator,
  data: unknown,
): (data: unknown, ctx: unknown) => unknown {
  class TestClass {
    testMethod(@decorator(data) _value: unknown): void {}
  }

  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestClass, 'testMethod');
  const key = Object.keys(metadata)[0];

  return metadata[key].factory;
}

// Mock getRequestFromContext
jest.mock('../src/utils/get-request-from-context', () => ({
  getRequestFromContext: jest.fn(),
}));

import { getRequestFromContext } from '../src/utils/get-request-from-context';

const mockGetRequestFromContext = getRequestFromContext as jest.MockedFunction<typeof getRequestFromContext>;

describe('Param Decorators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Account', () => {
    it('should return account from request payload', () => {
      const mockRequest = {
        payload: {
          account: 'test-account@example.com',
          id: 'user-123',
        },
      };

      mockGetRequestFromContext.mockReturnValue(mockRequest as ReturnType<typeof getRequestFromContext>);

      const factory = getParamDecoratorFactory(Account);
      const result = factory(undefined, {});

      expect(result).toBe('test-account@example.com');
    });

    it('should return null when payload is missing', () => {
      const mockRequest = {};

      mockGetRequestFromContext.mockReturnValue(mockRequest as ReturnType<typeof getRequestFromContext>);

      const factory = getParamDecoratorFactory(Account);
      const result = factory(undefined, {});

      expect(result).toBeNull();
    });

    it('should return null when account is missing from payload', () => {
      const mockRequest = {
        payload: {
          id: 'user-123',
        },
      };

      mockGetRequestFromContext.mockReturnValue(mockRequest as ReturnType<typeof getRequestFromContext>);

      const factory = getParamDecoratorFactory(Account);
      const result = factory(undefined, {});

      expect(result).toBeNull();
    });
  });

  describe('MemberId', () => {
    it('should return id from request payload', () => {
      const mockRequest = {
        payload: {
          id: 'member-456',
          account: 'user@example.com',
        },
      };

      mockGetRequestFromContext.mockReturnValue(mockRequest as ReturnType<typeof getRequestFromContext>);

      const factory = getParamDecoratorFactory(MemberId);
      const result = factory(undefined, {});

      expect(result).toBe('member-456');
    });

    it('should return null when payload is missing', () => {
      const mockRequest = {};

      mockGetRequestFromContext.mockReturnValue(mockRequest as ReturnType<typeof getRequestFromContext>);

      const factory = getParamDecoratorFactory(MemberId);
      const result = factory(undefined, {});

      expect(result).toBeNull();
    });

    it('should return null when id is missing from payload', () => {
      const mockRequest = {
        payload: {
          account: 'user@example.com',
        },
      };

      mockGetRequestFromContext.mockReturnValue(mockRequest as ReturnType<typeof getRequestFromContext>);

      const factory = getParamDecoratorFactory(MemberId);
      const result = factory(undefined, {});

      expect(result).toBeNull();
    });
  });

  describe('HasPermission', () => {
    it('should return false when payload is missing', () => {
      const mockRequest = {};

      mockGetRequestFromContext.mockReturnValue(mockRequest as ReturnType<typeof getRequestFromContext>);

      const factory = getParamDecoratorFactoryWithData(HasPermission, ['resource', 'read']);
      const result = factory(['resource', 'read'], {});

      expect(result).toBe(false);
    });

    it('should return false when enforcer is missing', () => {
      const mockRequest = {
        payload: { id: 'user-123' },
      };

      mockGetRequestFromContext.mockReturnValue(mockRequest as ReturnType<typeof getRequestFromContext>);

      const factory = getParamDecoratorFactoryWithData(HasPermission, ['resource', 'read']);
      const result = factory(['resource', 'read'], {});

      expect(result).toBe(false);
    });

    it('should return false when casbinPermissionChecker is missing', () => {
      const mockRequest = {
        payload: { id: 'user-123' },
        enforcer: {},
      };

      mockGetRequestFromContext.mockReturnValue(mockRequest as ReturnType<typeof getRequestFromContext>);

      const factory = getParamDecoratorFactoryWithData(HasPermission, ['resource', 'read']);
      const result = factory(['resource', 'read'], {});

      expect(result).toBe(false);
    });

    it('should call casbinPermissionChecker with correct parameters', () => {
      const mockPermissionChecker = jest.fn().mockReturnValue(true);
      const mockEnforcer = { enforce: jest.fn() };
      const mockPayload = { id: 'user-123', account: 'user@example.com' };

      const mockRequest = {
        payload: mockPayload,
        enforcer: mockEnforcer,
        casbinPermissionChecker: mockPermissionChecker,
      };

      mockGetRequestFromContext.mockReturnValue(mockRequest as ReturnType<typeof getRequestFromContext>);

      const factory = getParamDecoratorFactoryWithData(HasPermission, ['resource', 'write']);
      const result = factory(['resource', 'write'], {});

      expect(mockPermissionChecker).toHaveBeenCalledWith({
        enforcer: mockEnforcer,
        payload: mockPayload,
        actions: [['resource', 'write']],
      });

      expect(result).toBe(true);
    });

    it('should return false when permission is denied', () => {
      const mockPermissionChecker = jest.fn().mockReturnValue(false);
      const mockRequest = {
        payload: { id: 'user-123' },
        enforcer: {},
        casbinPermissionChecker: mockPermissionChecker,
      };

      mockGetRequestFromContext.mockReturnValue(mockRequest as ReturnType<typeof getRequestFromContext>);

      const factory = getParamDecoratorFactoryWithData(HasPermission, ['admin', 'delete']);
      const result = factory(['admin', 'delete'], {});

      expect(result).toBe(false);
    });
  });
});
