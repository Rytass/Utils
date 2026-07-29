/**
 * Semantic aliases for the external identity binding table.
 *
 * The table was introduced for OAuth2 only, but its shape (a channel plus an
 * identifier owned by that channel) applies to every external source the
 * authentication gateway supports — LDAP directories and upstream OIDC issuers
 * included. These aliases let call sites read correctly without a migration;
 * the original names remain exported and are not deprecated.
 */
export {
  MemberOAuthRecordEntity as MemberExternalIdentityEntity,
  MemberOAuthRecordRepo as MemberExternalIdentityRepo,
} from './member-oauth-record.entity';
