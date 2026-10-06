import {
  buildSchedulerSubmitPayload,
  classifySchedulerState,
  extractSchedulerRequestId,
  FusionEssSchedulerService,
  FusionFbdiService,
  FusionRestClient,
  toErpIntegrationsParameters,
  toSchedulerParameters,
  zipFiles,
} from '@rytass/erp-oracle-fusion';
import type { EssPositionalArguments } from '@rytass/erp-oracle-fusion';
import { deflateRawSync } from 'zlib';

/** 單一 DEFLATE entry 的最小 ZIP，用來製造高壓縮比的內容。 */
function deflatedArchive(name: string, content: Buffer): Buffer {
  const data = deflateRawSync(content);
  const nameBytes = Buffer.from(name, 'utf-8');
  const local = Buffer.alloc(30);

  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);

  const central = Buffer.alloc(46);

  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);

  const end = Buffer.alloc(22);
  const centralOffset = local.length + nameBytes.length + data.length;

  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, nameBytes, data, central, nameBytes, end]);
}

/** ESS Scheduler REST：位置參數序列化、request id 擷取、狀態分類，以及合併的執行記錄下載。 */

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function buildClient(fetchMock: jest.Mock): FusionRestClient {
  return new FusionRestClient({
    baseUrl: 'https://pod.example.com',
    auth: { type: 'basic', username: 'u', password: 'p' },
    retryBaseDelayMs: 0,
    fetchImpl: fetchMock as unknown as typeof fetch,
  });
}

const ARGS: EssPositionalArguments = new Map([
  [4, 'D'],
  [1, 'A'],
  [3, ''],
]);

describe('ESS 位置參數', () => {
  it('Scheduler REST：依位置排序、略過空字串、名稱為 submit.argumentN', () => {
    expect(toSchedulerParameters(ARGS)).toEqual([
      { name: 'submit.argument1', paramType: 'STRING', value: 'A' },
      { name: 'submit.argument4', paramType: 'STRING', value: 'D' },
    ]);
  });

  it('erpintegrations：空位保留、尾端補到指定長度', () => {
    expect(toErpIntegrationsParameters(ARGS, 6)).toBe('A,,,D,,');
  });
});

describe('ESS 位置參數的防呆', () => {
  it('erpintegrations：值含逗號時拋錯，不送出錯位的參數', () => {
    expect(() => toErpIntegrationsParameters(new Map([[2, 'a,b']]), 4)).toThrow(/comma/);
  });

  it('erpintegrations：位置超出參數總數時拋錯', () => {
    expect(() => toErpIntegrationsParameters(new Map([[5, 'x']]), 4)).toThrow(/outside 1\.\.4/);
    expect(() => toErpIntegrationsParameters(new Map([[0, 'x']]), 4)).toThrow(/outside 1\.\.4/);
  });

  it('Scheduler：位置不是正整數時拋錯', () => {
    expect(() => buildSchedulerSubmitPayload({ jobDefinitionPath: 'a/Job', arguments: new Map([[0, 'x']]) })).toThrow(
      /positive integer/,
    );
  });
});

describe('extractSchedulerRequestId', () => {
  it('優先取 requestId 欄位', () => {
    expect(extractSchedulerRequestId({ requestId: 371474 })).toBe('371474');
  });

  it('沒有 requestId 時由 links 的 /requests/{id} 取出', () => {
    expect(
      extractSchedulerRequestId({
        links: [{ href: 'https://pod.example.com/ess/rest/scheduler/v1/requests/371474' }],
      }),
    ).toBe('371474');
  });

  it('兩者皆無回傳 null', () => {
    expect(extractSchedulerRequestId({ links: [{ href: 'https://pod.example.com/other' }] })).toBeNull();
    expect(extractSchedulerRequestId(null)).toBeNull();
  });
});

describe('classifySchedulerState', () => {
  it('WARNING 是獨立的終態，不併入失敗', () => {
    expect(classifySchedulerState('WARNING')).toBe('WARNING');
    expect(classifySchedulerState('succeeded')).toBe('SUCCEEDED');
  });

  it.each(['ERROR', 'CANCELLED', 'EXPIRED', 'ERROR_MANUAL_RECOVERY', 'FINISHED_WITH_ERRORS', 'VALIDATION_FAILED'])(
    '%s 為失敗',
    state => {
      expect(classifySchedulerState(state)).toBe('FAILED');
    },
  );

  it.each(['PAUSED', 'WAIT', 'RUNNING', '', 'SOMETHING_NEW'])('%s 視為進行中', state => {
    expect(classifySchedulerState(state)).toBeNull();
  });
});

describe('FusionEssSchedulerService', () => {
  it('submit 送到 scheduler 路徑，retries 預設 0，回傳由 links 取出的 request id', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ links: [{ href: 'https://pod.example.com/ess/rest/scheduler/v1/requests/9001' }] }),
      );

    const service = new FusionEssSchedulerService(buildClient(fetchMock));

    const result = await service.submit({
      jobDefinitionPath: '/oracle/apps/ess/financials/receivables/Job',
      arguments: ARGS,
      product: 'AR',
      description: 'test',
    });

    expect(result.requestId).toBe('9001');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe('https://pod.example.com/ess/rest/scheduler/v1/requests');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      jobDefinitionId: 'JobDefinition:/oracle/apps/ess/financials/receivables/Job',
      application: 'FscmEss',
      product: 'AR',
      description: 'test',
      retries: 0,
      requestParameters: toSchedulerParameters(ARGS),
    });
  });

  it('回應取不到 request id 時拋錯，而不是回傳無法追蹤的結果', async () => {
    const service = new FusionEssSchedulerService(buildClient(jest.fn().mockResolvedValue(jsonResponse({}))));

    await expect(service.submit({ jobDefinitionPath: 'a/Job', arguments: new Map() })).rejects.toThrow(/no request id/);
  });

  it('getStatus 解析 state 與訊息', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ state: 'ERROR', errorWarningMessage: 'bad parameter' }));

    const service = new FusionEssSchedulerService(buildClient(fetchMock));

    await expect(service.getStatus('9001')).resolves.toEqual({
      rawState: 'ERROR',
      terminal: 'FAILED',
      message: 'bad parameter',
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://pod.example.com/ess/rest/scheduler/v1/requests/9001?fields=state,errorWarningMessage',
    );
  });

  it('buildSchedulerSubmitPayload 未指定 product／description 時不送出這兩欄', () => {
    expect(buildSchedulerSubmitPayload({ jobDefinitionPath: 'a/Job', arguments: new Map() })).toEqual({
      jobDefinitionId: 'JobDefinition:/a/Job',
      application: 'FscmEss',
      retries: 0,
      requestParameters: [],
    });
  });
});

describe('FusionFbdiService.downloadEssExecutionText', () => {
  const archive = (name: string, text: string): string =>
    zipFiles([{ name, content: Buffer.from(text, 'utf-8') }]).toString('base64');

  it('合併 log 與 out', async () => {
    const fetchMock = jest.fn(async (_url: string, init: RequestInit) => {
      const fileType = JSON.parse(init.body as string).FileType as string;

      return jsonResponse({ DocumentContent: archive(`1.${fileType}`, fileType === 'log' ? 'LOG' : 'OUT') });
    });

    const service = new FusionFbdiService(buildClient(fetchMock as unknown as jest.Mock));

    await expect(service.downloadEssExecutionText('1')).resolves.toEqual({
      text: 'LOG\nOUT',
      downloadFailed: false,
      incomplete: false,
    });
  });

  it('解壓後超過 maxBytes 時拋錯，而不是回傳截斷內容或壓縮位元組', async () => {
    const big = deflatedArchive('1.log', Buffer.alloc(1024 * 1024, 0x41));

    expect(big.length).toBeLessThan(8 * 1024);

    const service = new FusionFbdiService(
      buildClient(jest.fn().mockResolvedValue(jsonResponse({ DocumentContent: big.toString('base64') }))),
    );

    await expect(service.downloadEssLogText('1', 'log', { maxBytes: 64 * 1024 })).rejects.toThrow(
      /exceed the 65536-byte limit/,
    );

    await expect(service.downloadEssLogText('1', 'log')).resolves.toHaveLength(1024 * 1024);
  });

  it('開頭是 ZIP 但已截斷或損毀時拋錯，不把壓縮位元組當文字回傳', async () => {
    const truncated = deflatedArchive('1.log', Buffer.from('some log text')).subarray(0, 40);
    const service = new FusionFbdiService(
      buildClient(jest.fn().mockResolvedValue(jsonResponse({ DocumentContent: truncated.toString('base64') }))),
    );

    await expect(service.downloadEssLogText('1')).rejects.toThrow(/ZIP/);
  });

  it('純文字內容即使含 ZIP 結尾簽章的位元組也照文字讀', async () => {
    const text = Buffer.concat([Buffer.from('line 1 '), Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.from(' line 2')]);
    const service = new FusionFbdiService(
      buildClient(jest.fn().mockResolvedValue(jsonResponse({ DocumentContent: text.toString('base64') }))),
    );

    await expect(service.downloadEssLogText('1')).resolves.toBe(text.toString('utf-8'));
  });

  it('其中一份超過大小上限時標記 incomplete，不讓呼叫端誤以為內容完整', async () => {
    const big = deflatedArchive('1.log', Buffer.alloc(1024 * 1024, 0x41));
    const fetchMock = jest.fn(async (_url: string, init: RequestInit) =>
      (JSON.parse(init.body as string).FileType as string) === 'log'
        ? jsonResponse({ DocumentContent: big.toString('base64') })
        : jsonResponse({ DocumentContent: archive('1.out', 'OUT') }),
    );

    const service = new FusionFbdiService(buildClient(fetchMock as unknown as jest.Mock));

    await expect(service.downloadEssExecutionText('1', { maxBytes: 64 * 1024 })).resolves.toEqual({
      text: 'OUT',
      downloadFailed: false,
      incomplete: true,
    });
  });

  it('只有一份失敗時仍回傳另一份，且不標記 downloadFailed', async () => {
    const fetchMock = jest.fn(async (_url: string, init: RequestInit) => {
      if ((JSON.parse(init.body as string).FileType as string) === 'out') throw new Error('network');

      return jsonResponse({ DocumentContent: archive('1.log', 'LOG') });
    });

    const service = new FusionFbdiService(buildClient(fetchMock as unknown as jest.Mock));

    await expect(service.downloadEssExecutionText('1')).resolves.toEqual({
      text: 'LOG',
      downloadFailed: false,
      incomplete: true,
    });
  });

  it('兩份都取不到時標記 downloadFailed，與「內容為空」區分', async () => {
    const failing = new FusionFbdiService(buildClient(jest.fn().mockRejectedValue(new Error('network'))));
    const empty = new FusionFbdiService(buildClient(jest.fn().mockResolvedValue(jsonResponse({}))));

    await expect(failing.downloadEssExecutionText('1')).resolves.toEqual({
      text: null,
      downloadFailed: true,
      incomplete: true,
    });

    await expect(empty.downloadEssExecutionText('1')).resolves.toEqual({
      text: null,
      downloadFailed: false,
      incomplete: false,
    });
  });
});
