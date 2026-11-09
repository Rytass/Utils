import { periodEndsAt, toBlankRanges } from '../src/services/turnkey-invoice-track.service';

describe('toBlankRanges', () => {
  it('merges consecutive numbers into ranges', () => {
    expect(toBlankRanges(['00000001', '00000002', '00000003', '00000007', '00000009', '00000010'])).toEqual([
      { begin: '00000001', end: '00000003' },
      { begin: '00000007', end: '00000007' },
      { begin: '00000009', end: '00000010' },
    ]);
  });

  it('splits consecutive numbers at booklet boundaries (50 numbers per booklet)', () => {
    expect(toBlankRanges(['12345648', '12345649', '12345650', '12345651', '12345652'])).toEqual([
      { begin: '12345648', end: '12345649' },
      { begin: '12345650', end: '12345652' },
    ]);
  });

  it('splits a range spanning three booklets into one range per booklet', () => {
    const numbers = Array.from({ length: 149 }, (_, index) => String(12345651 + index));

    expect(toBlankRanges(numbers)).toEqual([
      { begin: '12345651', end: '12345699' },
      { begin: '12345700', end: '12345749' },
      { begin: '12345750', end: '12345799' },
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
