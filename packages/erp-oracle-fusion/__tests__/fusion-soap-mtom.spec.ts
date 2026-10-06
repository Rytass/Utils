import {
  extractMtomEnvelope,
  FusionAuthProvider,
  FusionRestClient,
  FusionSoapClient,
  FusionSoapFaultError,
  resolveFusionClientOptions,
  unwrapMtomSoapBody,
} from '@rytass/erp-oracle-fusion';
import type { FusionSoapService } from '@rytass/erp-oracle-fusion';

/**
 * MTOM 回應解包，以及 REST／SOAP client 共用認證供應者。
 *
 * MTOM 的重點在錯誤路徑：fault 埋在 multipart 裡時若沒解包，會被判成可重試的暫時性錯誤。
 */

const SERVICE: FusionSoapService = {
  path: '/fscmService/StandardReceiptService',
  serviceNamespace: 'http://example.com/service/',
  typesNamespace: 'http://example.com/service/types/',
  soapActionNamespace: 'http://example.com/service/',
};

const BOUNDARY = '----=_Part_12_345.678';

function mtom(envelope: string): string {
  return [
    `--${BOUNDARY}`,
    'Content-Type: application/xop+xml;charset=UTF-8;type="text/xml"',
    'Content-Transfer-Encoding: 8bit',
    'Content-ID: <root>',
    '',
    `<?xml version="1.0" encoding="UTF-8" ?>${envelope}`,
    `--${BOUNDARY}--`,
    '',
  ].join('\r\n');
}

const SUCCESS_ENVELOPE =
  '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>' +
  '<ns0:createStandardReceiptResponse xmlns:ns0="http://example.com/service/types/">' +
  '<ns0:result><ns0:StandardReceiptId>300000012345678</ns0:StandardReceiptId></ns0:result>' +
  '</ns0:createStandardReceiptResponse></env:Body></env:Envelope>';

const FAULT_ENVELOPE =
  '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><env:Fault>' +
  '<faultcode>env:Server</faultcode>' +
  '<faultstring>&lt;MESSAGE&gt;&lt;NUMBER&gt;AR-855636&lt;/NUMBER&gt;&lt;TEXT&gt;The transaction type is invalid.&lt;/TEXT&gt;&lt;/MESSAGE&gt;</faultstring>' +
  '</env:Fault></env:Body></env:Envelope>';

function response(body: string, status: number, contentType: string | null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string): string | null => (name.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  } as unknown as Response;
}

function buildClient(fetchMock: jest.Mock): FusionSoapClient {
  return new FusionSoapClient({
    baseUrl: 'https://pod.example.com',
    auth: { type: 'basic', username: 'u', password: 'p' },
    retryBaseDelayMs: 0,
    fetchImpl: fetchMock as unknown as typeof fetch,
  });
}

describe('extractMtomEnvelope', () => {
  it('由 Content-Type 的 boundary 取出 envelope', () => {
    expect(
      extractMtomEnvelope(
        mtom(SUCCESS_ENVELOPE),
        `multipart/related; boundary="${BOUNDARY}"; type="application/xop+xml"`,
      ),
    ).toBe(SUCCESS_ENVELOPE);
  });

  it('沒有標頭時由 body 開頭推得 boundary', () => {
    expect(extractMtomEnvelope(mtom(SUCCESS_ENVELOPE), null)).toBe(SUCCESS_ENVELOPE);
  });

  it('非 multipart 內容原樣回傳', () => {
    expect(extractMtomEnvelope(SUCCESS_ENVELOPE, 'text/xml')).toBeNull();
    expect(unwrapMtomSoapBody(SUCCESS_ENVELOPE, 'text/xml')).toBe(SUCCESS_ENVELOPE);
  });
});

describe('FusionSoapClient 的 MTOM 回應', () => {
  it('成功回應解包後正常解析', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(mtom(SUCCESS_ENVELOPE), 200, `multipart/related; boundary="${BOUNDARY}"`));

    await expect(buildClient(fetchMock).call(SERVICE, 'createStandardReceipt', [])).resolves.toEqual({
      result: { StandardReceiptId: '300000012345678' },
    });
  });

  it('HTTP 500 的 MTOM fault 分類為 SOAP fault（不可重試），訊息保留 Oracle 訊息編號', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(mtom(FAULT_ENVELOPE), 500, `multipart/related; boundary="${BOUNDARY}"`));

    const error = await buildClient(fetchMock)
      .call(SERVICE, 'createStandardReceipt', [], { maxRetries: 3 })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FusionSoapFaultError);
    expect((error as Error).message).toContain('AR-855636 The transaction type is invalid.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('共用 FusionAuthProvider', () => {
  it('REST 與 SOAP client 傳入同一個 provider 時只換發一次 token', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (url === 'https://idcs.example.com/oauth2/v1/token') {
        return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) } as Response;
      }

      if (url.includes('/fscmService/')) return response(SUCCESS_ENVELOPE, 200, 'text/xml');

      return { ok: true, status: 200, json: async () => ({ items: [] }) } as unknown as Response;
    });

    const options = {
      baseUrl: 'https://pod.example.com',
      auth: {
        type: 'oauth2_client_credentials' as const,
        tokenUrl: 'https://idcs.example.com/oauth2/v1/token',
        clientId: 'id',
        clientSecret: 'secret',
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    };

    const authProvider = new FusionAuthProvider(resolveFusionClientOptions(options));
    const rest = new FusionRestClient({ ...options, authProvider });
    const soap = new FusionSoapClient({ ...options, authProvider });

    expect(rest.authProvider).toBe(authProvider);
    expect(soap.authProvider).toBe(authProvider);

    await rest.get('ledgersLOV');
    await soap.call(SERVICE, 'createStandardReceipt', []);

    expect(fetchMock.mock.calls.filter(([url]) => url === 'https://idcs.example.com/oauth2/v1/token')).toHaveLength(1);
  });
});
