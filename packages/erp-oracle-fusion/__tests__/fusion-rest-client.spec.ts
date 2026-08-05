import {
  FusionApiOperation,
  FusionApiOutcome,
  FusionAuthError,
  FusionRestClient,
  FusionTransientError,
  FusionValidationError,
} from '@rytass/erp-oracle-fusion';
import type { FusionCallLogEntry, FusionCallLogSink, FusionClientOptions } from '@rytass/erp-oracle-fusion';

/**
 * `FusionRestClient`：URL 組裝（含命名空間覆寫）、冪等 GET 的退避重試、寫入類不重試、
 * 錯誤三分類、逾時與 fetch 注入，以及觀測埋點的內容與「絕不影響原呼叫」契約。
 * 全數注入假的 fetch，不對外連線。
 */

class RecordingSink implements FusionCallLogSink {
  readonly entries: FusionCallLogEntry[] = [];

  async record(entry: FusionCallLogEntry): Promise<void> {
    this.entries.push(entry);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errorResponse(status: number, bodyText: string): Response {
  return {
    ok: false,
    status,
    json: async () => JSON.parse(bodyText),
    text: async () => bodyText,
  } as unknown as Response;
}

function buildClient(overrides: Partial<FusionClientOptions> = {}): {
  client: FusionRestClient;
  sink: RecordingSink;
  fetchMock: jest.Mock;
} {
  const sink = new RecordingSink();
  const fetchMock = (overrides.fetchImpl as unknown as jest.Mock) ?? jest.fn();

  const client = new FusionRestClient({
    baseUrl: 'https://pod.example.com',
    auth: { type: 'basic', username: 'u', password: 'p' },
    retryBaseDelayMs: 0,
    callLogSink: sink,
    ...overrides,
    fetchImpl: fetchMock as unknown as typeof fetch,
  });

  return { client, sink, fetchMock };
}

describe('FusionRestClient', () => {
  describe('URL 組裝', () => {
    it('組出預設命名空間與版本的資源 URL', () => {
      const { client } = buildClient();

      expect(client.resourceUrl('ledgersLOV')).toBe(
        'https://pod.example.com/fscmRestApi/resources/11.13.18.05/ledgersLOV',
      );
    });

    it('可由建構設定或單次呼叫覆寫命名空間', () => {
      const { client } = buildClient({ defaultNamespace: 'crmRestApi' });

      expect(client.resourceUrl('accounts')).toBe('https://pod.example.com/crmRestApi/resources/11.13.18.05/accounts');
      expect(client.resourceUrl('workers', { namespace: 'hcmRestApi' })).toBe(
        'https://pod.example.com/hcmRestApi/resources/11.13.18.05/workers',
      );
    });

    it('以 / 開頭視為 pod 絕對路徑，完整 URL 原樣使用', () => {
      const { client } = buildClient();

      expect(client.resourceUrl('/myApi/v1/things')).toBe('https://pod.example.com/myApi/v1/things');
      expect(client.resourceUrl('https://other.example.com/x')).toBe('https://other.example.com/x');
    });

    it('去除 baseUrl 尾端斜線', () => {
      const { client } = buildClient({ baseUrl: 'https://pod.example.com///' });

      expect(client.resourceUrl('x')).toBe('https://pod.example.com/fscmRestApi/resources/11.13.18.05/x');
    });
  });

  describe('get', () => {
    it('帶 Authorization 標頭並回傳解析後的 JSON', async () => {
      const { client, fetchMock } = buildClient();

      fetchMock.mockResolvedValue(jsonResponse({ items: [{ LedgerId: 1 }] }));

      const result = await client.get<{ items: readonly unknown[] }>('ledgersLOV');

      expect(result.items).toHaveLength(1);
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`);
    });

    it('對 5xx 指數退避重試後成功，且僅落一筆紀錄', async () => {
      const { client, sink, fetchMock } = buildClient();

      fetchMock
        .mockResolvedValueOnce(errorResponse(503, 'unavailable'))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));

      await client.get('ledgersLOV');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sink.entries).toHaveLength(1);
      expect(sink.entries[0].attempt).toBe(2);
    });

    it('400 不重試並保留 Oracle 錯誤碼', async () => {
      const { client, sink, fetchMock } = buildClient();

      fetchMock.mockResolvedValue(errorResponse(400, '{"o:errorCode":"GL-123"}'));

      await expect(client.get('ledgersLOV')).rejects.toBeInstanceOf(FusionValidationError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sink.entries[0].errorCode).toBe('GL-123');
      expect(sink.entries[0].outcome).toBe(FusionApiOutcome.VALIDATION_ERROR);
    });

    it('401 不重試，直接拋出 FusionAuthError', async () => {
      const { client, fetchMock } = buildClient();

      fetchMock.mockResolvedValue(errorResponse(401, 'denied'));

      await expect(client.get('ledgersLOV')).rejects.toBeInstanceOf(FusionAuthError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('網路層錯誤重試後包成 FusionTransientError', async () => {
      const { client, fetchMock } = buildClient({ maxRetries: 2 });

      fetchMock.mockRejectedValue(new Error('ECONNRESET'));

      await expect(client.get('ledgersLOV')).rejects.toBeInstanceOf(FusionTransientError);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('逾時與 fetch 注入', () => {
    it('預設帶入 AbortSignal，timeoutMs=0 則不帶', async () => {
      const withTimeout = buildClient();

      withTimeout.fetchMock.mockResolvedValue(jsonResponse({}));
      await withTimeout.client.get('x');
      expect(withTimeout.fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);

      const without = buildClient({ timeoutMs: 0 });

      without.fetchMock.mockResolvedValue(jsonResponse({}));
      await without.client.get('x');
      expect(without.fetchMock.mock.calls[0][1].signal).toBeUndefined();
    });

    it('逾時被歸類為可重試的暫時性錯誤', async () => {
      const timeoutError = new Error('The operation was aborted due to timeout');

      timeoutError.name = 'TimeoutError';

      const { client, fetchMock } = buildClient({ maxRetries: 1 });

      fetchMock.mockRejectedValue(timeoutError);

      await expect(client.get('x')).rejects.toBeInstanceOf(FusionTransientError);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAll', () => {
    it('依 hasMore 續抓並串接分頁參數', async () => {
      const { client, fetchMock } = buildClient();

      fetchMock
        .mockResolvedValueOnce(jsonResponse({ items: [{ id: 1 }], hasMore: true }))
        .mockResolvedValueOnce(jsonResponse({ items: [{ id: 2 }], hasMore: false }));

      const all = await client.getAll<{ id: number }>('fndTreeNodes?q=x', 1);

      expect(all).toEqual([{ id: 1 }, { id: 2 }]);
      expect(fetchMock.mock.calls[0][0]).toContain('fndTreeNodes?q=x&limit=1&offset=0');
      expect(fetchMock.mock.calls[1][0]).toContain('offset=1');
    });

    it('伺服器回傳的 limit 小於請求值時，以伺服器值前進 offset（否則會跳過資料）', async () => {
      const { client, fetchMock } = buildClient();

      // 請求 500，但伺服器只給 2 筆一頁
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ items: [{ id: 1 }, { id: 2 }], hasMore: true, limit: 2 }))
        .mockResolvedValueOnce(jsonResponse({ items: [{ id: 3 }, { id: 4 }], hasMore: true, limit: 2 }))
        .mockResolvedValueOnce(jsonResponse({ items: [{ id: 5 }], hasMore: false, limit: 2 }));

      const all = await client.getAll<{ id: number }>('bigCollection', 500);

      expect(all.map(item => item.id)).toEqual([1, 2, 3, 4, 5]);
      expect(fetchMock.mock.calls[1][0]).toContain('offset=2');
      expect(fetchMock.mock.calls[2][0]).toContain('offset=4');
    });

    it('回應未帶 hasMore 且本頁已滿時續抓，不靜默截斷', async () => {
      const { client, fetchMock } = buildClient();

      fetchMock
        .mockResolvedValueOnce(jsonResponse({ items: [{ id: 1 }, { id: 2 }] }))
        .mockResolvedValueOnce(jsonResponse({ items: [{ id: 3 }] }));

      const all = await client.getAll<{ id: number }>('customResource', 2);

      expect(all).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('寫入類 method', () => {
    it('post 送出 Oracle ADF content type 且不自動重試', async () => {
      const { client, sink, fetchMock } = buildClient();

      fetchMock.mockResolvedValue(jsonResponse({ ReqstId: '12345' }));

      await client.post('erpintegrations', { OperationName: 'importBulkData' });

      expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBe('application/vnd.oracle.adf.resourceitem+json');
      expect(sink.entries[0].operation).toBe(FusionApiOperation.IMPORT_BULK_DATA);
      expect(sink.entries[0].refs).toEqual({ ReqstId: '12345' });

      fetchMock.mockReset();
      fetchMock.mockResolvedValue(errorResponse(503, 'unavailable'));

      await expect(client.post('erpintegrations', {})).rejects.toBeInstanceOf(FusionTransientError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('delete 允許 204 空 body 並回傳 null', async () => {
      const { client, fetchMock } = buildClient();

      fetchMock.mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => '',
        json: async () => null,
      } as unknown as Response);

      await expect(client.delete('journalBatches/1')).resolves.toBeNull();
    });
  });

  describe('觀測埋點', () => {
    it('去除 endpoint 的 query string 並帶入 correlation context', async () => {
      const { client, sink, fetchMock } = buildClient();

      fetchMock.mockResolvedValue(jsonResponse({ items: [] }));

      await client.get('journalBatches?q=secret=1', {
        context: { correlationType: 'VOUCHER', correlationId: 'v-1' },
      });

      expect(sink.entries[0].endpoint).toBe('journalBatches');
      expect(sink.entries[0].correlationType).toBe('VOUCHER');
      expect(sink.entries[0].correlationId).toBe('v-1');
    });

    it('摘要只含白名單欄位，不含機密或大型欄位', async () => {
      const { client, sink, fetchMock } = buildClient();

      fetchMock.mockResolvedValue(jsonResponse({ ReqstId: '9', DocumentContent: 'BASE64-SECRET', Password: 'x' }));

      await client.post('erpintegrations', {});

      const summary = sink.entries[0].responseSummary ?? '';

      expect(summary).toContain('ReqstId');
      expect(summary).not.toContain('BASE64-SECRET');
      expect(summary).not.toContain('Password');
    });

    it('refs 擷取的欄位可設定，非 GL 模組不必接受 GL 專屬鍵', async () => {
      const { client, sink, fetchMock } = buildClient({ responseRefKeys: ['PersonId'] });

      fetchMock.mockResolvedValue(jsonResponse({ PersonId: 'P-1', ReqstId: '9' }));

      await client.get('workers/1', { namespace: 'hcmRestApi' });

      expect(sink.entries[0].refs).toEqual({ PersonId: 'P-1' });
    });

    it('operationResolver 可回傳非內建 enum 的自訂分類', async () => {
      const { client, sink, fetchMock } = buildClient({ operationResolver: () => 'GET_CRM_ACCOUNT' });

      fetchMock.mockResolvedValue(jsonResponse({}));

      await client.get('accounts/1', { namespace: 'crmRestApi' });

      expect(sink.entries[0].operation).toBe('GET_CRM_ACCOUNT');
    });

    it('sink 拋錯時不影響原呼叫的回傳', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ ok: true }));

      const client = new FusionRestClient({
        baseUrl: 'https://pod.example.com',
        auth: { type: 'basic', username: 'u', password: 'p' },
        fetchImpl: fetchMock as unknown as typeof fetch,
        callLogSink: {
          record: async (): Promise<void> => {
            throw new Error('sink down');
          },
        },
      });

      await expect(client.get<{ ok: boolean }>('x')).resolves.toEqual({ ok: true });
    });

    it('未提供 sink 時完全不落地也不報錯', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ ok: true }));

      const client = new FusionRestClient({
        baseUrl: 'https://pod.example.com',
        auth: { type: 'basic', username: 'u', password: 'p' },
        fetchImpl: fetchMock as unknown as typeof fetch,
      });

      await expect(client.get<{ ok: boolean }>('x')).resolves.toEqual({ ok: true });
    });
  });

  describe('標頭與 framework 版本', () => {
    it('Accept 帶 Oracle 錯誤媒體型別，才能取得結構化 o:errorDetails', async () => {
      const { client, fetchMock } = buildClient();

      fetchMock.mockResolvedValue(jsonResponse({}));
      await client.get('x');

      expect(fetchMock.mock.calls[0][1].headers.Accept).toContain('application/vnd.oracle.adf.error+json');
    });

    it('未設定時不送 REST-Framework-Version（維持 pod 預設）', async () => {
      const { client, fetchMock } = buildClient();

      fetchMock.mockResolvedValue(jsonResponse({}));
      await client.get('x');

      expect(fetchMock.mock.calls[0][1].headers['REST-Framework-Version']).toBeUndefined();
    });

    it('可全域設定或單次覆寫 REST-Framework-Version', async () => {
      const { client, fetchMock } = buildClient({ restFrameworkVersion: 8 });

      fetchMock.mockResolvedValue(jsonResponse({}));

      await client.get('x');
      expect(fetchMock.mock.calls[0][1].headers['REST-Framework-Version']).toBe('8');

      await client.get('x', { restFrameworkVersion: 3 });
      expect(fetchMock.mock.calls[1][1].headers['REST-Framework-Version']).toBe('3');
    });
  });

  describe('錯誤碼擷取', () => {
    it('從巢狀 o:errorDetails 取出 Oracle 錯誤碼', async () => {
      const { client, sink, fetchMock } = buildClient();

      fetchMock.mockResolvedValue(
        errorResponse(
          400,
          JSON.stringify({
            title: 'Bad Request',
            status: '400',
            'o:errorDetails': [{ detail: 'Unable to parse the provided payload', 'o:errorCode': '27521' }],
          }),
        ),
      );

      await expect(client.get('x')).rejects.toBeInstanceOf(FusionValidationError);
      expect(sink.entries[0].errorCode).toBe('27521');
    });

    it('頂層 o:errorCode 仍優先採用', async () => {
      const { client, sink, fetchMock } = buildClient();

      fetchMock.mockResolvedValue(errorResponse(400, '{"o:errorCode":"GL-782245"}'));

      await expect(client.get('x')).rejects.toBeInstanceOf(FusionValidationError);
      expect(sink.entries[0].errorCode).toBe('GL-782245');
    });
  });

  describe('認證設定', () => {
    it('省略 auth.type 時預設走 OAuth 2.0 client credentials', async () => {
      const fetchMock = jest.fn();

      // 第一次呼叫是換 token，第二次才是資源請求
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'tok', expires_in: 3600 }),
          text: async () => '',
        } as unknown as Response)
        .mockResolvedValueOnce(jsonResponse({ ok: true }));

      const client = new FusionRestClient({
        baseUrl: 'https://pod.example.com',
        auth: { tokenUrl: 'https://idcs/token', clientId: 'a', clientSecret: 'b' },
        fetchImpl: fetchMock as unknown as typeof fetch,
      });

      await client.get('ledgersLOV');

      expect(fetchMock.mock.calls[0][0]).toBe('https://idcs/token');
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tok');
    });
  });

  describe('設定驗證', () => {
    it('缺少 baseUrl 或 auth 時明確報錯', () => {
      expect(
        () =>
          new FusionRestClient({
            baseUrl: '',
            auth: { type: 'basic', username: 'u', password: 'p' },
          }),
      ).toThrow('baseUrl is required');
    });
  });
});
