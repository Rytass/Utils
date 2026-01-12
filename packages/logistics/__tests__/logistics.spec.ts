import { LogisticsError, ErrorCode } from '../src/errors/errors';

describe('Logistics Package', () => {
  describe('LogisticsError', () => {
    it('should create error with code only', () => {
      const error = new LogisticsError(ErrorCode.NOT_FOUND_ERROR);

      expect(error.code).toBe(ErrorCode.NOT_FOUND_ERROR);
      expect(error.message).toBeUndefined();
    });

    it('should create error with code and message', () => {
      const error = new LogisticsError(ErrorCode.INVALID_PARAMETER, 'Invalid tracking number');

      expect(error.code).toBe(ErrorCode.INVALID_PARAMETER);
      expect(error.message).toBe('Invalid tracking number');
    });

    it('should implement LogisticsErrorInterface', () => {
      const error = new LogisticsError(ErrorCode.PERMISSION_DENIED, 'Access denied');

      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
    });
  });

  describe('ErrorCode', () => {
    it('should have NOT_IMPLEMENTED code', () => {
      expect(ErrorCode.NOT_IMPLEMENTED).toBe('999');
    });

    it('should have NOT_FOUND_ERROR code', () => {
      expect(ErrorCode.NOT_FOUND_ERROR).toBe('101');
    });

    it('should have PERMISSION_DENIED code', () => {
      expect(ErrorCode.PERMISSION_DENIED).toBe('102');
    });

    it('should have INVALID_PARAMETER code', () => {
      expect(ErrorCode.INVALID_PARAMETER).toBe('103');
    });

    it('should have exactly 4 error codes', () => {
      // String enums don't have reverse mappings, so keys.length equals the actual count
      const codeCount = Object.keys(ErrorCode).length;

      expect(codeCount).toBe(4);
    });
  });
});
