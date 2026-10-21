import { hashIdempotentRequest } from '../src/services/turnkey-idempotency.service';

describe('hashIdempotentRequest', () => {
  it('treats null and missing fields alike so REST and GraphQL payloads match', () => {
    expect(hashIdempotentRequest('issue', { a: 1, remark: null })).toBe(hashIdempotentRequest('issue', { a: 1 }));
  });

  it('distinguishes payloads that only differ in a Date', () => {
    expect(hashIdempotentRequest('issue', { issuedAt: new Date('2026-10-21T00:00:00Z') })).not.toBe(
      hashIdempotentRequest('issue', { issuedAt: new Date('2026-10-22T00:00:00Z') }),
    );
  });

  it('ignores key order', () => {
    expect(hashIdempotentRequest('issue', { a: 1, b: 2 })).toBe(hashIdempotentRequest('issue', { b: 2, a: 1 }));
  });
});
