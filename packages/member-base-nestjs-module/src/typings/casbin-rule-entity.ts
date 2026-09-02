import type { CasbinMongoRule, CasbinRule } from 'typeorm-adapter';

/**
 * A replacement for typeorm-adapter's own `CasbinRule` entity.
 *
 * The constructor shape mirrors typeorm-adapter's internal `CasbinRuleConstructor`
 * so a subclass of the exported `CasbinRule` (or `CasbinMongoRule`, on MongoDB)
 * carrying `@Entity('another_table')` satisfies it directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CasbinRuleEntity = new (...args: any[]) => CasbinRule | CasbinMongoRule;
