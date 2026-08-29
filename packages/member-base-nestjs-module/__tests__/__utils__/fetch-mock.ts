/**
 * A `fetch` stand-in for the Entra specs.
 *
 * Every Graph call goes through Node's built-in `fetch`, which is the whole
 * point of the implementation — no SDK, no transport to inject. So the seam the
 * tests use is the global itself, and this keeps that ugly enough to be
 * obvious and small enough to be shared.
 */

export interface StubbedResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface RecordedCall {
  url: string;
  init?: RequestInit;
}

export interface FetchMock {
  calls: RecordedCall[];
  /** Delays passed to setTimeout, in call order — the observed backoff. */
  delays: number[];
  restore: () => void;
}

const toResponse = (stub: StubbedResponse): Response => {
  const status = stub.status ?? 200;
  const headers = new Headers(stub.headers ?? {});

  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: async (): Promise<unknown> => {
      if (stub.body === undefined) throw new SyntaxError('Unexpected end of JSON input');

      return stub.body;
    },
    // The client drains a body it is about to discard so undici can release the
    // connection; the stub has to offer it or every retry path throws.
    arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(0),
  } as unknown as Response;
};

/**
 * Install a routing `fetch` mock and a synchronous `setTimeout`.
 *
 * The handler receives the url and the request init and returns the next
 * response; returning `undefined` fails the test loudly rather than hanging on
 * an unstubbed call.
 */
export const installFetchMock = (
  handler: (url: string, init: RequestInit | undefined, callIndex: number) => StubbedResponse | undefined,
): FetchMock => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;

  const mock: FetchMock = {
    calls: [],
    delays: [],
    restore: (): void => {
      globalThis.fetch = originalFetch;
      globalThis.setTimeout = originalSetTimeout;
    },
  };

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const index = mock.calls.length;

    mock.calls.push({ url, init });

    const stub = handler(url, init, index);

    if (!stub) throw new Error(`Unstubbed fetch call: ${url}`);

    return toResponse(stub);
  }) as typeof fetch;

  // Backoff is observed rather than waited on: the delays are asserted, and the
  // suite still runs in milliseconds.
  globalThis.setTimeout = ((callback: () => void, ms?: number): number => {
    mock.delays.push(ms ?? 0);
    callback();

    return 0;
  }) as unknown as typeof setTimeout;

  return mock;
};

/** Query parameters of a recorded call, decoded. */
export const queryOf = (url: string): URLSearchParams => new URL(url).searchParams;
