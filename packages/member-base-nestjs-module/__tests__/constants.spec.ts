import { DEFAULT_CASBIN_DOMAIN } from '../src/constants/default-casbin-domain';

describe('Constants', () => {
  describe('DEFAULT_CASBIN_DOMAIN', () => {
    it('should be defined', () => {
      expect(DEFAULT_CASBIN_DOMAIN).toBeDefined();
    });

    it('should be ::DEFAULT::', () => {
      expect(DEFAULT_CASBIN_DOMAIN).toBe('::DEFAULT::');
    });

    it('should be a string', () => {
      expect(typeof DEFAULT_CASBIN_DOMAIN).toBe('string');
    });
  });
});
