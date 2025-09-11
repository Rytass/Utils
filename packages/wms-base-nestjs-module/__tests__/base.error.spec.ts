import { BadRequestException } from '@nestjs/common';
import {
  LocationAlreadyExistedError,
  LocationCannotArchiveError,
  LocationNotFoundError,
  StockQuantityNotEnoughError,
} from '../src/constants/errors/base.error';

describe('Base Errors', () => {
  describe('LocationNotFoundError', () => {
    it('should create error with correct message and code', () => {
      const error = new LocationNotFoundError();

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error).toBeInstanceOf(LocationNotFoundError);
      expect(error.message).toBe('Location not found');
      expect(error.code).toBe(100);
    });

    it('should be throwable', () => {
      expect(() => {
        throw new LocationNotFoundError();
      }).toThrow(LocationNotFoundError);
    });

    it('should maintain error stack trace', () => {
      const error = new LocationNotFoundError();

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });

    it('should be catchable as BadRequestException', () => {
      try {
        throw new LocationNotFoundError();
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error).toBeInstanceOf(LocationNotFoundError);
      }
    });
  });

  describe('LocationCannotArchiveError', () => {
    it('should create error with correct message and code', () => {
      const error = new LocationCannotArchiveError();

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error).toBeInstanceOf(LocationCannotArchiveError);
      expect(error.message).toBe('Location cannot archive, please check if there are stocks in this location');
      expect(error.code).toBe(101);
    });

    it('should be throwable', () => {
      expect(() => {
        throw new LocationCannotArchiveError();
      }).toThrow(LocationCannotArchiveError);
    });

    it('should maintain error stack trace', () => {
      const error = new LocationCannotArchiveError();

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });

    it('should be catchable as BadRequestException', () => {
      try {
        throw new LocationCannotArchiveError();
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error).toBeInstanceOf(LocationCannotArchiveError);
      }
    });

    it('should have different error code from LocationNotFoundError', () => {
      const archiveError = new LocationCannotArchiveError();
      const notFoundError = new LocationNotFoundError();

      expect(archiveError.code).not.toBe(notFoundError.code);
      expect(archiveError.code).toBe(101);
      expect(notFoundError.code).toBe(100);
    });
  });

  describe('LocationAlreadyExistedError', () => {
    it('should create error with correct message and code', () => {
      const error = new LocationAlreadyExistedError();

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error).toBeInstanceOf(LocationAlreadyExistedError);
      expect(error.message).toBe('Location already existed');
      expect(error.code).toBe(102);
    });

    it('should be throwable', () => {
      expect(() => {
        throw new LocationAlreadyExistedError();
      }).toThrow(LocationAlreadyExistedError);
    });

    it('should maintain error stack trace', () => {
      const error = new LocationAlreadyExistedError();

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });

    it('should be catchable as BadRequestException', () => {
      try {
        throw new LocationAlreadyExistedError();
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error).toBeInstanceOf(LocationAlreadyExistedError);
      }
    });

    it('should have unique error code in 100 series', () => {
      const existedError = new LocationAlreadyExistedError();
      const notFoundError = new LocationNotFoundError();
      const cannotArchiveError = new LocationCannotArchiveError();

      expect(existedError.code).toBe(102);
      expect(existedError.code).not.toBe(notFoundError.code);
      expect(existedError.code).not.toBe(cannotArchiveError.code);
    });
  });

  describe('StockQuantityNotEnoughError', () => {
    it('should create error with correct message and code', () => {
      const error = new StockQuantityNotEnoughError();

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error).toBeInstanceOf(StockQuantityNotEnoughError);
      expect(error.message).toBe('Stock quantity not enough');
      expect(error.code).toBe(200);
    });

    it('should be throwable', () => {
      expect(() => {
        throw new StockQuantityNotEnoughError();
      }).toThrow(StockQuantityNotEnoughError);
    });

    it('should maintain error stack trace', () => {
      const error = new StockQuantityNotEnoughError();

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });

    it('should be catchable as BadRequestException', () => {
      try {
        throw new StockQuantityNotEnoughError();
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error).toBeInstanceOf(StockQuantityNotEnoughError);
      }
    });

    it('should have error code in 200 series (different from location errors)', () => {
      const stockError = new StockQuantityNotEnoughError();
      const locationError = new LocationNotFoundError();

      expect(stockError.code).toBe(200);
      expect(stockError.code).not.toBe(locationError.code);

      // Stock errors are in 200 series, location errors are in 100 series
      expect(Math.floor(stockError.code / 100)).toBe(2);
      expect(Math.floor(locationError.code / 100)).toBe(1);
    });
  });

  describe('Error Code Uniqueness', () => {
    it('should have unique error codes for all error types', () => {
      const locationNotFound = new LocationNotFoundError();
      const locationCannotArchive = new LocationCannotArchiveError();
      const locationAlreadyExisted = new LocationAlreadyExistedError();
      const stockQuantityNotEnough = new StockQuantityNotEnoughError();

      const codes = [
        locationNotFound.code,
        locationCannotArchive.code,
        locationAlreadyExisted.code,
        stockQuantityNotEnough.code,
      ];

      const uniqueCodes = [...new Set(codes)];

      expect(uniqueCodes).toHaveLength(codes.length);
    });

    it('should have predictable error code ranges', () => {
      const locationNotFound = new LocationNotFoundError();
      const locationCannotArchive = new LocationCannotArchiveError();
      const locationAlreadyExisted = new LocationAlreadyExistedError();
      const stockQuantityNotEnough = new StockQuantityNotEnoughError();

      // Location errors should be in 100-199 range
      expect(locationNotFound.code).toBeGreaterThanOrEqual(100);
      expect(locationNotFound.code).toBeLessThan(200);

      expect(locationCannotArchive.code).toBeGreaterThanOrEqual(100);
      expect(locationCannotArchive.code).toBeLessThan(200);

      expect(locationAlreadyExisted.code).toBeGreaterThanOrEqual(100);
      expect(locationAlreadyExisted.code).toBeLessThan(200);

      // Stock errors should be in 200-299 range
      expect(stockQuantityNotEnough.code).toBeGreaterThanOrEqual(200);
      expect(stockQuantityNotEnough.code).toBeLessThan(300);
    });
  });

  describe('Error Message Consistency', () => {
    it('should have meaningful error messages', () => {
      const locationNotFound = new LocationNotFoundError();
      const locationCannotArchive = new LocationCannotArchiveError();
      const locationAlreadyExisted = new LocationAlreadyExistedError();
      const stockQuantityNotEnough = new StockQuantityNotEnoughError();

      expect(locationNotFound.message).toContain('Location');
      expect(locationNotFound.message).toContain('not found');

      expect(locationCannotArchive.message).toContain('Location');
      expect(locationCannotArchive.message).toContain('cannot archive');
      expect(locationCannotArchive.message).toContain('stocks');

      expect(locationAlreadyExisted.message).toContain('Location');
      expect(locationAlreadyExisted.message).toContain('already existed');

      expect(stockQuantityNotEnough.message).toContain('Stock');
      expect(stockQuantityNotEnough.message).toContain('quantity');
      expect(stockQuantityNotEnough.message).toContain('not enough');
    });

    it('should have non-empty error messages', () => {
      const errors = [
        new LocationNotFoundError(),
        new LocationCannotArchiveError(),
        new LocationAlreadyExistedError(),
        new StockQuantityNotEnoughError(),
      ];

      errors.forEach(error => {
        expect(error.message).toBeTruthy();
        expect(error.message.length).toBeGreaterThan(0);
        expect(typeof error.message).toBe('string');
      });
    });
  });

  describe('Error Inheritance and Properties', () => {
    it('should inherit all properties from BadRequestException', () => {
      const error = new LocationNotFoundError();
      const _baseError = new BadRequestException('test');

      // Should have all the same properties that BadRequestException has
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('name');
      expect(error).toHaveProperty('stack');

      // Should be instance of Error (base class)
      expect(error).toBeInstanceOf(Error);
    });

    it('should maintain proper prototype chain', () => {
      const error = new LocationNotFoundError();

      expect(Object.getPrototypeOf(error)).toBe(LocationNotFoundError.prototype);
      expect(Object.getPrototypeOf(LocationNotFoundError.prototype)).toBe(BadRequestException.prototype);
    });

    it('should have correct constructor property', () => {
      const error = new LocationNotFoundError();

      expect(error.constructor).toBe(LocationNotFoundError);
    });
  });

  describe('Error Serialization', () => {
    it('should be serializable to JSON', () => {
      const error = new LocationNotFoundError();

      // Should not throw when serializing
      expect(() => JSON.stringify(error)).not.toThrow();

      const serialized = JSON.stringify(error);

      expect(typeof serialized).toBe('string');
    });

    it('should maintain error properties after serialization cycle', () => {
      const original = new StockQuantityNotEnoughError();

      const serialized = JSON.stringify({
        message: original.message,
        code: original.code,
        name: original.name,
      });

      const parsed = JSON.parse(serialized);

      expect(parsed.message).toBe(original.message);
      expect(parsed.code).toBe(original.code);
    });
  });
});
