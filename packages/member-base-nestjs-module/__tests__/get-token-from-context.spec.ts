import { ExecutionContext } from '@nestjs/common';
import { getTokenFromContext } from '../src/utils/get-token-from-context';
import * as getRequestModule from '../src/utils/get-request-from-context';

jest.mock('../src/utils/get-request-from-context');

describe('getTokenFromContext', () => {
  const mockGetRequestFromContext = getRequestModule.getRequestFromContext as jest.MockedFunction<
    typeof getRequestModule.getRequestFromContext
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authorization header token', () => {
    it('should extract token from Bearer authorization header', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer context-token-123',
        },
        cookies: {},
      };

      mockGetRequestFromContext.mockResolvedValue(mockRequest as never);

      const mockContext = {} as ExecutionContext;
      const result = await getTokenFromContext(mockContext);

      expect(result).toBe('context-token-123');
      expect(mockGetRequestFromContext).toHaveBeenCalledWith(mockContext);
    });

    it('should extract token from lowercase bearer authorization header', async () => {
      const mockRequest = {
        headers: {
          authorization: 'bearer lowercase-token',
        },
        cookies: {},
      };

      mockGetRequestFromContext.mockResolvedValue(mockRequest as never);

      const mockContext = {} as ExecutionContext;
      const result = await getTokenFromContext(mockContext);

      expect(result).toBe('lowercase-token');
    });

    it('should return null when authorization header is empty', async () => {
      const mockRequest = {
        headers: {
          authorization: '',
        },
        cookies: {},
      };

      mockGetRequestFromContext.mockResolvedValue(mockRequest as never);

      const mockContext = {} as ExecutionContext;
      const result = await getTokenFromContext(mockContext);

      expect(result).toBeNull();
    });

    it('should return null when authorization header is missing', async () => {
      const mockRequest = {
        headers: {},
        cookies: {},
      };

      mockGetRequestFromContext.mockResolvedValue(mockRequest as never);

      const mockContext = {} as ExecutionContext;
      const result = await getTokenFromContext(mockContext);

      expect(result).toBeNull();
    });

    it('should trim whitespace from token', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer   trimmed-token   ',
        },
        cookies: {},
      };

      mockGetRequestFromContext.mockResolvedValue(mockRequest as never);

      const mockContext = {} as ExecutionContext;
      const result = await getTokenFromContext(mockContext);

      expect(result).toBe('trimmed-token');
    });
  });

  describe('Cookie mode', () => {
    it('should not check cookies when cookieMode is false (default)', async () => {
      const mockRequest = {
        headers: {},
        cookies: {
          access_token: 'cookie-token',
        },
      };

      mockGetRequestFromContext.mockResolvedValue(mockRequest as never);

      const mockContext = {} as ExecutionContext;
      const result = await getTokenFromContext(mockContext);

      expect(result).toBeNull();
    });

    it('should extract token from default cookie when cookieMode is true', async () => {
      const mockRequest = {
        headers: {},
        cookies: {
          access_token: 'cookie-token-from-context',
        },
      };

      mockGetRequestFromContext.mockResolvedValue(mockRequest as never);

      const mockContext = {} as ExecutionContext;
      const result = await getTokenFromContext(mockContext, true);

      expect(result).toBe('cookie-token-from-context');
    });

    it('should extract token from custom cookie name', async () => {
      const mockRequest = {
        headers: {},
        cookies: {
          my_custom_cookie: 'custom-cookie-token',
        },
      };

      mockGetRequestFromContext.mockResolvedValue(mockRequest as never);

      const mockContext = {} as ExecutionContext;
      const result = await getTokenFromContext(mockContext, true, 'my_custom_cookie');

      expect(result).toBe('custom-cookie-token');
    });

    it('should return null when cookie is missing in cookie mode', async () => {
      const mockRequest = {
        headers: {},
        cookies: {},
      };

      mockGetRequestFromContext.mockResolvedValue(mockRequest as never);

      const mockContext = {} as ExecutionContext;
      const result = await getTokenFromContext(mockContext, true);

      expect(result).toBeNull();
    });

    it('should return null when cookies object is undefined', async () => {
      const mockRequest = {
        headers: {},
        cookies: undefined,
      };

      mockGetRequestFromContext.mockResolvedValue(mockRequest as never);

      const mockContext = {} as ExecutionContext;
      const result = await getTokenFromContext(mockContext, true);

      expect(result).toBeNull();
    });

    it('should prefer header token over cookie token', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer header-priority-token',
        },
        cookies: {
          access_token: 'cookie-fallback-token',
        },
      };

      mockGetRequestFromContext.mockResolvedValue(mockRequest as never);

      const mockContext = {} as ExecutionContext;
      const result = await getTokenFromContext(mockContext, true);

      expect(result).toBe('header-priority-token');
    });

    it('should fallback to cookie when header is empty', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer ',
        },
        cookies: {
          access_token: 'fallback-token',
        },
      };

      mockGetRequestFromContext.mockResolvedValue(mockRequest as never);

      const mockContext = {} as ExecutionContext;
      const result = await getTokenFromContext(mockContext, true);

      expect(result).toBe('fallback-token');
    });
  });
});
