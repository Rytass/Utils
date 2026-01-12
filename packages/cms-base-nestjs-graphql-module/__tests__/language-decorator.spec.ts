import { LANGUAGE_HEADER_KEY } from '../src/decorators/language.decorator';

describe('Language Decorator', () => {
  describe('LANGUAGE_HEADER_KEY', () => {
    it('should be defined', () => {
      expect(LANGUAGE_HEADER_KEY).toBeDefined();
    });

    it('should have the correct value', () => {
      expect(LANGUAGE_HEADER_KEY).toBe('x-language');
    });

    it('should be a string', () => {
      expect(typeof LANGUAGE_HEADER_KEY).toBe('string');
    });
  });
});
