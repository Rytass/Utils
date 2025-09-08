/**
 * Base type for CMS entities to replace Repository<any>
 * TypeORM requires ObjectLiteral constraint, so using any with proper eslint disable
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CmsEntity = any;
