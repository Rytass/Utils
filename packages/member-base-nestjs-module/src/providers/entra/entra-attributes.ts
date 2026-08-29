/** A directory object reference as Graph returns it inside `memberOf`. */
export type EntraDirectoryObjectRef = {
  id?: string;
  displayName?: string | null;
  '@odata.type'?: string;
  [attribute: string]: unknown;
};

/**
 * A raw Graph user, as returned by `/users`.
 *
 * Written as a type alias with an index signature rather than an interface for
 * two reasons: `extraAttributes` puts arbitrary extra properties on the object,
 * and only an index-signature type is assignable to `DirectoryEntry`.
 */
export type EntraDirectoryEntry = {
  id?: string;
  userPrincipalName?: string | null;
  onPremisesSamAccountName?: string | null;
  displayName?: string | null;
  mail?: string | null;
  accountEnabled?: boolean | null;
  jobTitle?: string | null;
  department?: string | null;
  memberOf?: EntraDirectoryObjectRef[];
  /** Present only on `/users/delta` responses, for entries that left the scope. */
  '@removed'?: { reason?: string };
  [attribute: string]: unknown;
};

/** Which attribute is treated as the human-facing account name. */
export type EntraAccountAttribute = 'userPrincipalName' | 'onPremisesSamAccountName';

/**
 * The `$select` every query asks for.
 *
 * Graph returns a small default projection that omits most of these, so the
 * list is not an optimisation — without it `accountEnabled`, `department` and
 * `onPremisesSamAccountName` simply are not in the response.
 */
export const DEFAULT_ENTRA_ATTRIBUTES = [
  'id',
  'userPrincipalName',
  'onPremisesSamAccountName',
  'displayName',
  'mail',
  'accountEnabled',
  'jobTitle',
  'department',
];

/** Deduplicated `$select`, defaults first so the order stays stable in tests. */
export const buildSelect = (extraAttributes?: string[]): string =>
  [...new Set([...DEFAULT_ENTRA_ATTRIBUTES, ...(extraAttributes ?? [])])].join(',');

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

/** The `@odata.type` annotation that marks a directory object as a group. */
export const GROUP_ODATA_TYPE = '#microsoft.graph.group';

/**
 * Group display names, mirroring what the LDAP provider derives from the CN of
 * each `memberOf` DN.
 *
 * **Fails closed.** Directory roles arrive through the same `memberOf`
 * collection, and letting "Global Administrator" reach a list that a group
 * membership check reads is an authorization bug — so an entry is counted only
 * when it says it is a group, never merely because it does not say otherwise.
 * An untyped entry is dropped.
 *
 * `EntraDirectoryProvider` reads memberships through the
 * `/memberOf/microsoft.graph.group` cast, which filters at the source, and
 * stamps the annotation on what it stores so this check has something to read.
 */
export const extractGroupNames = (memberOf: unknown): string[] | undefined => {
  // Absent is not empty: a delta entry without memberships means "not reported
  // here", and answering `[]` would read as "belongs to no group".
  if (memberOf === undefined) return undefined;

  if (!Array.isArray(memberOf)) return [];

  return memberOf.reduce<string[]>((accumulator, candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return accumulator;

    const reference = candidate as EntraDirectoryObjectRef;

    if (asString(reference['@odata.type']) !== GROUP_ODATA_TYPE) return accumulator;

    const name = asString(reference.displayName);

    return name ? [...accumulator, name] : accumulator;
  }, []);
};

/**
 * The account name, from whichever attribute the tenant is keyed on.
 *
 * A hybrid tenant synchronised from on-premises AD leaves
 * `onPremisesSamAccountName` populated, and an existing system that already
 * stores `sAMAccountName` as its account key needs that value rather than the
 * UPN — otherwise every member has to be re-keyed to adopt Entra.
 */
export const readAccount = (
  entry: EntraDirectoryEntry,
  accountAttribute: EntraAccountAttribute,
): string | undefined => {
  const preferred = asString(entry[accountAttribute]);

  if (preferred) return preferred;

  // Falling back keeps a cloud-only account usable in a tenant configured for
  // sAMAccountName: such accounts were never synchronised and have none.
  return asString(entry.userPrincipalName);
};

/**
 * Whether the tenant considers the account disabled, or `undefined` when the
 * entry does not say.
 *
 * Genuinely tri-state, and the third state is not "enabled". A `/users/delta`
 * entry carries the id plus *at least* the changed properties, so
 * `accountEnabled` is simply absent from most delta pages — and collapsing that
 * into `false` would let a reconciliation job re-enable a suspended member on
 * every unrelated change to their record. Fail closed by refusing to answer.
 */
export const isAccountDisabled = (entry: EntraDirectoryEntry): boolean | undefined => {
  if (entry.accountEnabled === false) return true;

  if (entry.accountEnabled === true) return false;

  return undefined;
};

/** The `@removed.reason` values Graph documents for `/users/delta`. */
export type EntraRemovalReason = 'changed' | 'deleted';

/**
 * How an entry left the delta scope.
 *
 * `changed` means soft-deleted into the recycle bin, from which the object can
 * still be restored; `deleted` means permanently gone. They are surfaced
 * separately rather than collapsed into a boolean because an application may
 * well suspend a member for the first and erase the binding for the second.
 */
export const readRemovalReason = (entry: EntraDirectoryEntry): EntraRemovalReason | null => {
  const removed = entry['@removed'];

  if (!removed || typeof removed !== 'object') return null;

  return removed.reason === 'deleted' ? 'deleted' : 'changed';
};
