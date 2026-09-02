import type { MemberBaseModuleOptionsDTO } from '../typings/member-base-module-options.dto';
import type { CasbinRuleEntity } from '../typings/casbin-rule-entity';

/**
 * The second argument of TypeORMAdapter.newAdapter.
 *
 * typeorm-adapter declares this shape as `TypeORMAdapterConfig` but does not
 * re-export it from its entry point, so it is restated here rather than deep
 * imported from `typeorm-adapter/lib/adapter`.
 */
export interface TypeORMAdapterConfig {
  customCasbinRuleEntity?: CasbinRuleEntity;
}

/**
 * Left undefined unless the application actually asked for a custom entity, so
 * that newAdapter is called exactly as it was before this option existed.
 *
 * Built as a standalone function because the CASBIN_ENFORCER provider around it
 * cannot be unit tested: it dynamic-imports typeorm-adapter and then opens a
 * real connection. Same split as load-typeorm-adapter.ts.
 */
export const toTypeORMAdapterConfig = (options?: MemberBaseModuleOptionsDTO): TypeORMAdapterConfig | undefined =>
  options?.casbinRuleEntity ? { customCasbinRuleEntity: options.casbinRuleEntity } : undefined;
