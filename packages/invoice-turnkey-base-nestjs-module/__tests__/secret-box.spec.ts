import { openSecret, sealSecret } from '../src/utils/secret-box';

describe('secret box', () => {
  it('round-trips and uses a fresh IV each time', () => {
    const a = sealSecret('6647A889B4B5912BECB5D01065CCD670', 'k');
    const b = sealSecret('6647A889B4B5912BECB5D01065CCD670', 'k');

    expect(a).not.toBe(b);
    expect(openSecret(a, 'k')).toBe('6647A889B4B5912BECB5D01065CCD670');
  });

  it('rejects a wrong secret', () => {
    expect(() => openSecret(sealSecret('x', 'k1'), 'k2')).toThrow();
  });
});
