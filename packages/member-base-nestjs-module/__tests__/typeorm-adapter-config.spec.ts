import { toTypeORMAdapterConfig } from '../src/constants/typeorm-adapter-config';
import type { MemberBaseModuleOptionsDTO } from '../src/typings/member-base-module-options.dto';

class CustomCasbinRule {
  id!: number;
  ptype!: string;
  v0!: string;
}

/**
 * typeorm-adapter reads the table name off the entity it is handed, so this is
 * the only axis on which two applications sharing one database can keep their
 * policies apart without also splitting the schema.
 */
describe('typeorm adapter config', () => {
  describe('when casbinRuleEntity is not set', () => {
    it.each([
      ['no options at all', undefined],
      ['an empty options object', {}],
      ['options that configure the adapter but not the entity', { casbinAdapterOptions: { type: 'postgres' } }],
    ])('should stay undefined for %s', (_label, options) => {
      expect(toTypeORMAdapterConfig(options as MemberBaseModuleOptionsDTO | undefined)).toBeUndefined();
    });
  });

  describe('when casbinRuleEntity is set', () => {
    it('should hand the entity to typeorm-adapter as customCasbinRuleEntity', () => {
      const options = { casbinRuleEntity: CustomCasbinRule } as unknown as MemberBaseModuleOptionsDTO;

      expect(toTypeORMAdapterConfig(options)).toEqual({ customCasbinRuleEntity: CustomCasbinRule });
    });

    it('should pass the constructor itself, not a copy of it', () => {
      const options = { casbinRuleEntity: CustomCasbinRule } as unknown as MemberBaseModuleOptionsDTO;

      expect(toTypeORMAdapterConfig(options)?.customCasbinRuleEntity).toBe(CustomCasbinRule);
    });
  });
});
