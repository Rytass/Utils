import { BaseAction } from '../src/constants/enum/base-action.enum';
import { BaseResource } from '../src/constants/enum/base-resource.enum';

describe('CMS GraphQL Enums', () => {
  describe('BaseAction', () => {
    it('should have LIST action', () => {
      expect(BaseAction.LIST).toBe('LIST');
    });

    it('should have READ action', () => {
      expect(BaseAction.READ).toBe('READ');
    });

    it('should have CREATE action', () => {
      expect(BaseAction.CREATE).toBe('CREATE');
    });

    it('should have UPDATE action', () => {
      expect(BaseAction.UPDATE).toBe('UPDATE');
    });

    it('should have DELETE action', () => {
      expect(BaseAction.DELETE).toBe('DELETE');
    });

    it('should have DELETE_VERSION action', () => {
      expect(BaseAction.DELETE_VERSION).toBe('DELETE_VERSION');
    });

    it('should have SUBMIT action', () => {
      expect(BaseAction.SUBMIT).toBe('SUBMIT');
    });

    it('should have PUT_BACK action', () => {
      expect(BaseAction.PUT_BACK).toBe('PUT_BACK');
    });

    it('should have APPROVE action', () => {
      expect(BaseAction.APPROVE).toBe('APPROVE');
    });

    it('should have REJECT action', () => {
      expect(BaseAction.REJECT).toBe('REJECT');
    });

    it('should have RELEASE action', () => {
      expect(BaseAction.RELEASE).toBe('RELEASE');
    });

    it('should have WITHDRAW action', () => {
      expect(BaseAction.WITHDRAW).toBe('WITHDRAW');
    });

    it('should have exactly 12 actions', () => {
      const actionCount = Object.keys(BaseAction).length;

      expect(actionCount).toBe(12);
    });
  });

  describe('BaseResource', () => {
    it('should have ARTICLE resource', () => {
      expect(BaseResource.ARTICLE).toBe('ARTICLE');
    });

    it('should have CATEGORY resource', () => {
      expect(BaseResource.CATEGORY).toBe('CATEGORY');
    });

    it('should have exactly 2 resources', () => {
      const resourceCount = Object.keys(BaseResource).length;

      expect(resourceCount).toBe(2);
    });
  });
});
