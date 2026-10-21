import { openSecret, sealSecret } from '../src/utils/secret-box';

describe('secret box', () => {
  it('round-trips and uses a fresh IV each time', () => {
    const a = sealSecret('6647A889B4B5912BECB5D01065CCD670', 'k');
    const b = sealSecret('6647A889B4B5912BECB5D01065CCD670', 'k');

    expect(a).not.toBe(b);
    expect(openSecret(a, 'k')).toBe('6647A889B4B5912BECB5D01065CCD670');
  });

  it('rejects a truncated auth tag', () => {
    const [version, iv, tag, encrypted] = sealSecret('x', 'k').split(':');
    const truncated = Buffer.from(tag, 'base64').subarray(0, 4).toString('base64');

    expect(() => openSecret([version, iv, truncated, encrypted].join(':'), 'k')).toThrow(
      'Unsupported sealed secret format',
    );
  });

  it('rejects a wrong secret', () => {
    expect(() => openSecret(sealSecret('x', 'k1'), 'k2')).toThrow();
  });
});
