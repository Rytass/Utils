import {
  buildEssStatusPath,
  buildFusionQuery,
  FUSION_FINDERS,
  FUSION_GL_APPLICATION_ID,
  FUSION_RESOURCES,
  FUSION_UCM_ACCOUNTS,
  GL_JOURNAL_TEMPLATE,
  withFusionQuery,
} from '@rytass/erp-oracle-fusion';

/**
 * Query construction and the resource constants the package exposes.
 *
 * The escaping rules mirror what Fusion is known to accept: the whole `q` value is percent-encoded,
 * while finders keep their `;` separators and encode only parameter values.
 */

describe('buildFusionQuery', () => {
  it('joins q conditions with semicolons and encodes the whole value', () => {
    expect(buildFusionQuery({ q: { LedgerId: 300000002498206, ApplicationId: 101 } })).toBe(
      'q=LedgerId%3D300000002498206%3BApplicationId%3D101',
    );
  });

  it('accepts raw q syntax for operators Fusion supports', () => {
    expect(buildFusionQuery({ q: "BatchName LIKE '%990101%'" })).toBe("q=BatchName%20LIKE%20'%25990101%25'");
  });

  it('builds finder invocations, encoding only parameter values', () => {
    expect(buildFusionQuery({ finder: { name: 'ESSJobStatusRF', params: { requestId: '198867' } } })).toBe(
      'finder=ESSJobStatusRF;requestId=198867',
    );
  });

  it('accepts a bare finder name', () => {
    expect(buildFusionQuery({ finder: 'PrimaryKey' })).toBe('finder=PrimaryKey');
  });

  it('supports pagination, field selection, expansion and ordering', () => {
    expect(
      buildFusionQuery({
        limit: 50,
        offset: 100,
        fields: ['LedgerId', 'Name'],
        expand: ['child1', 'child2'],
        orderBy: ['CreationDate:desc'],
        onlyData: true,
        totalResults: true,
      }),
    ).toBe(
      'limit=50&offset=100&fields=LedgerId,Name&expand=child1,child2&orderBy=CreationDate:desc&onlyData=true&totalResults=true',
    );
  });

  it('passes through additional parameters with encoding', () => {
    expect(buildFusionQuery({ params: { effectiveDate: '2026-08-04', note: 'a b' } })).toBe(
      'effectiveDate=2026-08-04&note=a%20b',
    );
  });

  it('returns an empty string when nothing is specified', () => {
    expect(buildFusionQuery({})).toBe('');
    expect(buildFusionQuery({ q: {} })).toBe('');
    expect(buildFusionQuery({ fields: [] })).toBe('');
  });
});

describe('withFusionQuery', () => {
  it('appends with ? when the path has no query yet', () => {
    expect(withFusionQuery(FUSION_RESOURCES.LEDGERS_LOV, { limit: 5 })).toBe('ledgersLOV?limit=5');
  });

  it('appends with & when the path already carries a query', () => {
    expect(withFusionQuery('ledgersLOV?onlyData=true', { limit: 5 })).toBe('ledgersLOV?onlyData=true&limit=5');
  });

  it('leaves the path untouched when the query is empty', () => {
    expect(withFusionQuery('ledgersLOV', {})).toBe('ledgersLOV');
  });

  it('composes the accounting period status query that needs ApplicationId', () => {
    // Omitting ApplicationId returns rows from an arbitrary subledger, which is why the
    // constant exists rather than being spelled out at call sites.
    expect(
      withFusionQuery(FUSION_RESOURCES.ACCOUNTING_PERIOD_STATUS_LOV, {
        q: { LedgerId: '300000002498206', PeriodNameId: 'Jul-26', ApplicationId: FUSION_GL_APPLICATION_ID },
      }),
    ).toBe('accountingPeriodStatusLOV?q=LedgerId%3D300000002498206%3BPeriodNameId%3DJul-26%3BApplicationId%3D101');
  });
});

describe('resource constants', () => {
  it('are used by the package itself rather than duplicated as literals', () => {
    expect(buildEssStatusPath('198867')).toBe(
      `${FUSION_RESOURCES.ERP_INTEGRATIONS}?finder=${FUSION_FINDERS.ESS_JOB_STATUS};requestId=198867`,
    );

    expect(GL_JOURNAL_TEMPLATE.documentAccount).toBe(FUSION_UCM_ACCOUNTS.GL_JOURNAL_IMPORT);
  });

  it('encode request ids that need escaping', () => {
    expect(buildEssStatusPath('a b')).toContain('requestId=a%20b');
  });
});
