import { resolveReturnTo, resolveReturnToTarget } from '../src/utils/resolve-return-to';

const FALLBACK = '/home';

describe('resolveReturnTo', () => {
  it('should ignore returnTo entirely when no allowlist is configured', () => {
    expect(resolveReturnTo('https://app.example.com/dashboard', [], FALLBACK)).toBe(FALLBACK);
  });

  it('should fall back when nothing was asked for', () => {
    expect(resolveReturnTo(undefined, ['https://app.example.com'], FALLBACK)).toBe(FALLBACK);
    expect(resolveReturnTo('', ['https://app.example.com'], FALLBACK)).toBe(FALLBACK);
  });

  it('should allow any path on a listed origin', () => {
    const allowed = ['https://app.example.com'];

    expect(resolveReturnTo('https://app.example.com/dashboard', allowed, FALLBACK)).toBe(
      'https://app.example.com/dashboard',
    );

    expect(resolveReturnTo('https://app.example.com/', allowed, FALLBACK)).toBe('https://app.example.com/');
  });

  it('should refuse a different host, scheme or port', () => {
    const allowed = ['https://app.example.com'];

    expect(resolveReturnTo('https://evil.example.com/', allowed, FALLBACK)).toBe(FALLBACK);
    expect(resolveReturnTo('http://app.example.com/', allowed, FALLBACK)).toBe(FALLBACK);
    expect(resolveReturnTo('https://app.example.com:8443/', allowed, FALLBACK)).toBe(FALLBACK);
  });

  it('should refuse a host that merely starts with an allowed one', () => {
    // The classic prefix-matching hole: `app.example.com.evil.test` starts with
    // the allowed string and is a completely different site.
    expect(resolveReturnTo('https://app.example.com.evil.test/', ['https://app.example.com'], FALLBACK)).toBe(FALLBACK);
  });

  it('should treat a listed path as a directory boundary, not a string prefix', () => {
    const allowed = ['https://app.example.com/admin'];

    expect(resolveReturnTo('https://app.example.com/admin', allowed, FALLBACK)).toBe('https://app.example.com/admin');
    expect(resolveReturnTo('https://app.example.com/admin/users', allowed, FALLBACK)).toBe(
      'https://app.example.com/admin/users',
    );

    expect(resolveReturnTo('https://app.example.com/administrator', allowed, FALLBACK)).toBe(FALLBACK);
  });

  it('should allow a relative path under a listed relative entry', () => {
    const allowed = ['/dashboard'];

    expect(resolveReturnTo('/dashboard', allowed, FALLBACK)).toBe('/dashboard');
    expect(resolveReturnTo('/dashboard/reports?range=30d', allowed, FALLBACK)).toBe('/dashboard/reports?range=30d');
    expect(resolveReturnTo('/settings', allowed, FALLBACK)).toBe(FALLBACK);
  });

  it('should refuse a protocol-relative url disguised as a path', () => {
    // Both are read by browsers as absolute urls to another host, and both are
    // what an allowlist that only checks the leading slash lets through.
    expect(resolveReturnTo('//evil.example.com/', ['/'], FALLBACK)).toBe(FALLBACK);
    expect(resolveReturnTo('/\\evil.example.com/', ['/'], FALLBACK)).toBe(FALLBACK);
  });

  it('should refuse an absolute url against a relative allowlist entry', () => {
    expect(resolveReturnTo('https://evil.example.com/dashboard', ['/dashboard'], FALLBACK)).toBe(FALLBACK);
  });

  it('should allow a native app custom scheme', () => {
    const allowed = ['myapp://auth'];

    expect(resolveReturnTo('myapp://auth/callback', allowed, FALLBACK)).toBe('myapp://auth/callback');
    expect(resolveReturnTo('myapp://auth', allowed, FALLBACK)).toBe('myapp://auth');
    expect(resolveReturnTo('otherapp://auth/callback', allowed, FALLBACK)).toBe(FALLBACK);
  });

  it('should refuse an unparseable candidate', () => {
    expect(resolveReturnTo('::::', ['https://app.example.com'], FALLBACK)).toBe(FALLBACK);
  });

  it('should accept a candidate matching any one entry', () => {
    const allowed = ['https://app.example.com', 'myapp://auth'];

    expect(resolveReturnTo('myapp://auth/done', allowed, FALLBACK)).toBe('myapp://auth/done');
  });

  describe('parser-versus-browser divergence', () => {
    // WHATWG URL strips ASCII tab, LF and CR *before* parsing. A check on the
    // raw string therefore sees a path where the browser sees a protocol-
    // relative url, which is a live open redirect whenever the allowlist holds
    // a relative entry — and the README recommends exactly such an entry.
    const CONTROL_BYPASSES = ['\t', '\n', '\r'].flatMap(control => [
      `/${control}/evil.test/dashboard`,
      `/${control}\\evil.test/dashboard`,
      `/${control}${control}/evil.test/dashboard`,
    ]);

    it.each(CONTROL_BYPASSES)('should reject %j against a relative allowlist entry', candidate => {
      expect(resolveReturnTo(candidate, ['/dashboard'], FALLBACK)).toBe(FALLBACK);
    });

    it.each(CONTROL_BYPASSES)('should not resolve %j to another origin', candidate => {
      const resolved = new URL(resolveReturnTo(candidate, ['/dashboard'], FALLBACK), 'https://app.example.com');

      expect(resolved.host).toBe('app.example.com');
    });

    it('should reject a control character against a root allowlist entry', () => {
      expect(resolveReturnTo('/\t/evil.test', ['/'], FALLBACK)).toBe(FALLBACK);
    });

    it('should reject every C0 control, space and DEL rather than only the three that parse', () => {
      const controls = [...Array(0x21).keys(), 0x7f].map(code => String.fromCharCode(code));

      controls.forEach(control => {
        expect(resolveReturnTo(`/dashboard${control}x`, ['/dashboard'], FALLBACK)).toBe(FALLBACK);
      });
    });
  });

  describe('per-destination delivery', () => {
    const MIXED = ['https://app.example.com', { url: 'myapp://auth', delivery: 'fragment' as const }];

    it('should report cookie delivery for a bare string entry', () => {
      // The shape every entry had before the option existed.
      expect(resolveReturnToTarget('https://app.example.com/dash', MIXED, FALLBACK)).toEqual({
        url: 'https://app.example.com/dash',
        delivery: 'cookie',
      });
    });

    it('should report the delivery an object entry declares', () => {
      expect(resolveReturnToTarget('myapp://auth/cb', MIXED, FALLBACK)).toEqual({
        url: 'myapp://auth/cb',
        delivery: 'fragment',
      });
    });

    it('should default an object entry without delivery to cookie', () => {
      expect(resolveReturnToTarget('myapp://auth/cb', [{ url: 'myapp://auth' }], FALLBACK).delivery).toBe('cookie');
    });

    it('should never deliver by fragment to the fallback', () => {
      // The fallback is not an allowlist entry, so nothing has declared it a
      // place tokens may be put — and it is reached precisely when the
      // requested destination was refused.
      expect(resolveReturnToTarget('https://evil.example.com/x', MIXED, FALLBACK)).toEqual({
        url: FALLBACK,
        delivery: 'cookie',
      });

      expect(resolveReturnToTarget(undefined, MIXED, FALLBACK).delivery).toBe('cookie');
      expect(resolveReturnToTarget('/\t/evil.test', MIXED, FALLBACK).delivery).toBe('cookie');
    });

    it('should let the first matching entry decide', () => {
      const ordered = [
        { url: 'https://app.example.com', delivery: 'cookie' as const },
        { url: 'https://app.example.com/native', delivery: 'fragment' as const },
      ];

      expect(resolveReturnToTarget('https://app.example.com/native/cb', ordered, FALLBACK).delivery).toBe('cookie');
      expect(
        resolveReturnToTarget('https://app.example.com/native/cb', [...ordered].reverse(), FALLBACK).delivery,
      ).toBe('fragment');
    });

    it('should apply every rejection rule to object entries too', () => {
      const native = [{ url: 'myapp://auth', delivery: 'fragment' as const }];

      expect(resolveReturnToTarget('otherapp://auth/cb', native, FALLBACK).url).toBe(FALLBACK);
      expect(resolveReturnToTarget('myapp://evil/cb', native, FALLBACK).url).toBe(FALLBACK);
      expect(resolveReturnToTarget(`myapp://auth/${'a'.repeat(2000)}`, native, FALLBACK).url).toBe(FALLBACK);
    });

    it('should keep resolveReturnTo returning a bare string for existing callers', () => {
      expect(resolveReturnTo('myapp://auth/cb', MIXED, FALLBACK)).toBe('myapp://auth/cb');
      expect(typeof resolveReturnTo('https://app.example.com/x', MIXED, FALLBACK)).toBe('string');
    });
  });

  describe('input that is not a string', () => {
    // Express hands back an array for a repeated query parameter and an object
    // for a bracketed one. The declared type says string; the wire does not
    // have to agree, and every string method here would throw on either.
    it.each([
      [['/dashboard', '/dashboard'], 'repeated query parameter'],
      [{ x: '/dashboard' }, 'bracketed query parameter'],
      [42, 'number'],
      [null, 'null'],
      [['/dashboard'], 'single-element array'],
    ])('should fall back rather than throw on %s (%s)', value => {
      expect(() => resolveReturnTo(value as unknown as string, ['/dashboard'], FALLBACK)).not.toThrow();
      expect(resolveReturnTo(value as unknown as string, ['/dashboard'], FALLBACK)).toBe(FALLBACK);
    });
  });

  describe('what the returned url may not carry', () => {
    it('should strip credentials it never inspected', () => {
      // matches() compares protocol, host and path only, so userinfo is never
      // looked at — emitting it would put uninspected attacker text into a
      // Location header in the shape browsers flag as phishing.
      expect(resolveReturnTo('https://user:pw@app.example.com/x', ['https://app.example.com'], FALLBACK)).toBe(
        'https://app.example.com/x',
      );
    });

    it('should still refuse a host smuggled through userinfo', () => {
      expect(resolveReturnTo('https://app.example.com@evil.test/x', ['https://app.example.com'], FALLBACK)).toBe(
        FALLBACK,
      );
    });

    it('should fold host case for a custom scheme, which WHATWG does not', () => {
      // A native app entry differing only in case would otherwise fall back.
      expect(resolveReturnTo('myapp://AUTH/cb', ['myapp://auth'], FALLBACK)).toBe('myapp://AUTH/cb');
      expect(resolveReturnTo('myapp://auth/cb', ['myapp://AUTH'], FALLBACK)).toBe('myapp://auth/cb');
      // Folding case must not fold different hosts together.
      expect(resolveReturnTo('myapp://evil/cb', ['myapp://auth'], FALLBACK)).toBe(FALLBACK);
    });

    it('should refuse a destination too long to survive the transaction cookie', () => {
      const overlong = `https://app.example.com/x?q=${'a'.repeat(4096)}`;

      // Allowlist-valid, but the browser silently drops the oversize cookie and
      // the login ends in a puzzling 400 — a one-link denial of service.
      expect(resolveReturnTo(overlong, ['https://app.example.com'], FALLBACK)).toBe(FALLBACK);
    });
  });

  describe('normalisation of what is returned', () => {
    it('should return the re-serialised url, never the caller original', () => {
      // The structural fix: only what was actually parsed and inspected is
      // emitted, so a future parser divergence cannot become a bypass.
      expect(resolveReturnTo('https://app.example.com', ['https://app.example.com'], FALLBACK)).toBe(
        'https://app.example.com/',
      );
    });

    it('should keep a same-origin destination relative', () => {
      // The placeholder parsing base must never leak into the redirect.
      expect(resolveReturnTo('/dashboard/reports?range=30d#top', ['/dashboard'], FALLBACK)).toBe(
        '/dashboard/reports?range=30d#top',
      );
    });

    it('should preserve a custom scheme unchanged', () => {
      expect(resolveReturnTo('myapp://auth/cb?x=1#f', ['myapp://auth'], FALLBACK)).toBe('myapp://auth/cb?x=1#f');
    });
  });
});
