import { Request } from 'express';
import { getTokenFromRequest } from '../src/utils/get-token-from-request';

describe('getTokenFromRequest', () => {
  describe('Authorization header token', () => {
    it('should extract token from Bearer authorization header', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer test-token-123',
        },
        cookies: {},
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest);

      expect(result).toBe('test-token-123');
    });

    it('should extract token from lowercase bearer authorization header', async () => {
      const mockRequest = {
        headers: {
          authorization: 'bearer test-token-456',
        },
        cookies: {},
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest);

      expect(result).toBe('test-token-456');
    });

    it('should extract token from BEARER authorization header (case insensitive)', async () => {
      const mockRequest = {
        headers: {
          authorization: 'BEARER uppercase-token',
        },
        cookies: {},
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest);

      expect(result).toBe('uppercase-token');
    });

    it('should trim whitespace from token', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer   spaced-token   ',
        },
        cookies: {},
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest);

      expect(result).toBe('spaced-token');
    });

    it('should return null for empty authorization header', async () => {
      const mockRequest = {
        headers: {
          authorization: '',
        },
        cookies: {},
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest);

      expect(result).toBeNull();
    });

    it('should return null when authorization header is missing', async () => {
      const mockRequest = {
        headers: {},
        cookies: {},
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest);

      expect(result).toBeNull();
    });

    it('should handle authorization header with only Bearer prefix', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer ',
        },
        cookies: {},
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest);

      expect(result).toBeNull();
    });
  });

  describe('Cookie mode', () => {
    it('should not check cookies when cookieMode is false (default)', async () => {
      const mockRequest = {
        headers: {},
        cookies: {
          access_token: 'cookie-token',
        },
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest);

      expect(result).toBeNull();
    });

    it('should extract token from default cookie when cookieMode is true', async () => {
      const mockRequest = {
        headers: {},
        cookies: {
          access_token: 'cookie-token-123',
        },
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest, true);

      expect(result).toBe('cookie-token-123');
    });

    it('should extract token from custom cookie name', async () => {
      const mockRequest = {
        headers: {},
        cookies: {
          custom_token: 'custom-cookie-token',
        },
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest, true, 'custom_token');

      expect(result).toBe('custom-cookie-token');
    });

    it('should return null when cookie is missing in cookie mode', async () => {
      const mockRequest = {
        headers: {},
        cookies: {},
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest, true);

      expect(result).toBeNull();
    });

    it('should return null when cookies object is undefined', async () => {
      const mockRequest = {
        headers: {},
        cookies: undefined,
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest, true);

      expect(result).toBeNull();
    });

    it('should prefer header token over cookie token', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer header-token',
        },
        cookies: {
          access_token: 'cookie-token',
        },
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest, true);

      expect(result).toBe('header-token');
    });

    it('should fallback to cookie when header is empty', async () => {
      const mockRequest = {
        headers: {
          authorization: '',
        },
        cookies: {
          access_token: 'fallback-cookie-token',
        },
      } as unknown as Request;

      const result = await getTokenFromRequest(mockRequest, true);

      expect(result).toBe('fallback-cookie-token');
    });
  });
});
