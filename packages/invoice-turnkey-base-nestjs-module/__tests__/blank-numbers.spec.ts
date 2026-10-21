import { periodEndsAt, toBlankRanges } from '../src/services/turnkey-invoice-track.service';

describe('toBlankRanges', () => {
  it('merges consecutive numbers into ranges', () => {
    expect(toBlankRanges(['00000001', '00000002', '00000003', '00000007', '00000009', '00000010'])).toEqual([
      { begin: '00000001', end: '00000003' },
      { begin: '00000007', end: '00000007' },
      { begin: '00000009', end: '00000010' },
    ]);
  });

  it('returns no range for no numbers', () => {
    expect(toBlankRanges([])).toEqual([]);
  });
});

describe('periodEndsAt', () => {
  it('ends at the first day of the next period, Taipei midnight', () => {
    expect(periodEndsAt('11510').toISOString()).toBe('2026-10-31T16:00:00.000Z');
    expect(periodEndsAt('11512').toISOString()).toBe('2026-12-31T16:00:00.000Z');
  });
});
