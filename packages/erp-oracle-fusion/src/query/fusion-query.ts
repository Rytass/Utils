/**
 * Query string construction for Fusion REST resources.
 *
 * Fusion's query syntax is well defined but fiddly: `q` conditions are joined with `;`, finders
 * carry their own parameters, and the escaping rules differ between the two. Hand-assembling these
 * strings at every call site is where mistakes happen — a wrong field name or a missing escape
 * surfaces as a generic 400 that says nothing about which parameter was wrong.
 */

/** Values accepted in query conditions and parameters. */
export type FusionQueryValue = string | number | boolean;

/**
 * Finder invocation. Fusion finders take the form `finder=FinderName;param=value,param2=value2` —
 * a semicolon separates the finder name from its parameters, and commas separate the parameters
 * from each other.
 */
export interface FusionFinder {
  readonly name: string;
  readonly params?: Readonly<Record<string, FusionQueryValue>>;
}

export interface FusionQueryOptions {
  /**
   * `q` filter. An object becomes `Field=Value;Field2=Value2` (AND semantics); pass a string to
   * use raw Fusion query syntax, for example `Name LIKE 'ACME%'`.
   */
  readonly q?: string | Readonly<Record<string, FusionQueryValue>>;
  /** Finder invocation; mutually usable with the other options. */
  readonly finder?: string | FusionFinder;
  /** Maximum number of rows returned. */
  readonly limit?: number;
  /** Zero-based row offset. */
  readonly offset?: number;
  /** Restricts the attributes returned. */
  readonly fields?: readonly string[];
  /** Expands child resources. */
  readonly expand?: string | readonly string[];
  /** Sort order, for example `['CreationDate:desc']`. */
  readonly orderBy?: string | readonly string[];
  /** Returns only the `items` payload without links. */
  readonly onlyData?: boolean;
  /** Includes the total row count in the response. */
  readonly totalResults?: boolean;
  /** Any additional parameters not covered above. */
  readonly params?: Readonly<Record<string, FusionQueryValue>>;
}

function conditionsToString(conditions: Readonly<Record<string, FusionQueryValue>>): string {
  return Object.entries(conditions)
    .map(([field, value]) => `${field}=${String(value)}`)
    .join(';');
}

/**
 * Builds the query string (without the leading `?`).
 *
 * Escaping follows what Fusion is known to accept: the whole `q` value is percent-encoded, while
 * a finder keeps its `;` separators and encodes only the parameter values.
 */
export function buildFusionQuery(options: FusionQueryOptions): string {
  const parts: string[] = [];

  if (options.q !== undefined) {
    const raw = typeof options.q === 'string' ? options.q : conditionsToString(options.q);

    if (raw) parts.push(`q=${encodeURIComponent(raw)}`);
  }

  if (options.finder !== undefined) {
    if (typeof options.finder === 'string') {
      parts.push(`finder=${options.finder}`);
    } else {
      const params = Object.entries(options.finder.params ?? {}).map(
        ([key, value]) => `${key}=${encodeURIComponent(String(value))}`,
      );

      parts.push(`finder=${options.finder.name}${params.length > 0 ? `;${params.join(',')}` : ''}`);
    }
  }

  if (options.limit !== undefined) parts.push(`limit=${options.limit}`);

  if (options.offset !== undefined) parts.push(`offset=${options.offset}`);

  if (options.fields?.length) parts.push(`fields=${options.fields.join(',')}`);

  if (options.expand !== undefined) {
    const expand = typeof options.expand === 'string' ? options.expand : options.expand.join(',');

    if (expand) parts.push(`expand=${expand}`);
  }

  if (options.orderBy !== undefined) {
    const orderBy = typeof options.orderBy === 'string' ? options.orderBy : options.orderBy.join(',');

    if (orderBy) parts.push(`orderBy=${orderBy}`);
  }

  if (options.onlyData !== undefined) parts.push(`onlyData=${options.onlyData}`);

  if (options.totalResults !== undefined) parts.push(`totalResults=${options.totalResults}`);

  for (const [key, value] of Object.entries(options.params ?? {})) {
    parts.push(`${key}=${encodeURIComponent(String(value))}`);
  }

  return parts.join('&');
}

/**
 * Appends a query string to a resource path, preserving any query the path already carries.
 *
 * ```ts
 * withFusionQuery('ledgersLOV', { limit: 5 });
 * // 'ledgersLOV?limit=5'
 *
 * withFusionQuery('accountingPeriodStatusLOV', {
 *   q: { LedgerId: 300000002498206, PeriodNameId: 'Jul-26', ApplicationId: 101 },
 * });
 * // 'accountingPeriodStatusLOV?q=LedgerId%3D300000002498206%3BPeriodNameId%3DJul-26%3BApplicationId%3D101'
 * ```
 */
export function withFusionQuery(path: string, options: FusionQueryOptions): string {
  const query = buildFusionQuery(options);

  if (!query) return path;

  return `${path}${path.includes('?') ? '&' : '?'}${query}`;
}
