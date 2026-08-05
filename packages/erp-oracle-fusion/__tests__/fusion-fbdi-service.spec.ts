import {
  FusionFbdiService,
  FusionRestClient,
  GL_JOURNAL_TEMPLATE,
  buildGlJournalContent,
  buildGlJournalRows,
  buildJournalImportParameterList,
  deriveGroupId,
} from '@rytass/erp-oracle-fusion';
import { zipFiles } from '@rytass/erp-oracle-fusion';
import type { EssJobStatus } from '@rytass/erp-oracle-fusion';

/** FBDI 高階流程：匯入送出、ESS 狀態查詢與輪詢、執行記錄下載。全數注入假 fetch。 */

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function buildService(fetchMock: jest.Mock): FusionFbdiService {
  return new FusionFbdiService(
    new FusionRestClient({
      baseUrl: 'https://pod.example.com',
      auth: { type: 'basic', username: 'u', password: 'p' },
      retryBaseDelayMs: 0,
      fetchImpl: fetchMock as unknown as typeof fetch,
    }),
  );
}

const GROUP_ID = deriveGroupId('voucher-1');

const CONTENT = buildGlJournalContent(
  buildGlJournalRows(
    { sourceKey: 'voucher-1', accountingDate: '2026-06-30', currencyCode: 'TWD', description: 'test' },
    [{ accountCode: '759000000', departmentCode: '00000', debit: 0, credit: 1 }],
    {
      ledgerId: '300000002498206',
      journalSource: 'Manual',
      journalCategory: 'Adjustment',
      periodName: 'Jun-26',
      groupId: GROUP_ID,
      companySegmentDefault: '01',
      extraSegmentDefaults: ['0000', '0000'],
    },
  ),
);

const PARAMETER_LIST = buildJournalImportParameterList({
  journalSource: 'Manual',
  ledgerId: '300000002498206',
  groupId: GROUP_ID,
});

describe('FusionFbdiService.import', () => {
  it('送出 importBulkData 並回傳父 ESS request id', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ ReqstId: '198867' }));
    const service = buildService(fetchMock);

    const result = await service.import(GL_JOURNAL_TEMPLATE, [CONTENT], PARAMETER_LIST);

    expect(result.requestId).toBe('198867');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.OperationName).toBe('importBulkData');
    expect(body.DocumentAccount).toBe('fin$/journal$/import');
    expect(body.JobName).toContain('JournalImportLauncher');
    expect(body.ParameterList).toBe(PARAMETER_LIST);
    expect(Buffer.from(body.DocumentContent, 'base64').subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('回應缺 ReqstId 時明確報錯（否則後續無法追蹤）', async () => {
    const service = buildService(jest.fn().mockResolvedValue(jsonResponse({})));

    await expect(service.import(GL_JOURNAL_TEMPLATE, [CONTENT], PARAMETER_LIST)).rejects.toThrow('no ReqstId');
  });

  it('ReqstId=-1 代表提交失敗，不可當成有效 request id', async () => {
    const service = buildService(jest.fn().mockResolvedValue(jsonResponse({ ReqstId: '-1' })));

    await expect(service.import(GL_JOURNAL_TEMPLATE, [CONTENT], PARAMETER_LIST)).rejects.toThrow('was not scheduled');
  });

  it('submitEssJob 同樣拒絕 ReqstId=-1', async () => {
    const service = buildService(jest.fn().mockResolvedValue(jsonResponse({ ReqstId: -1 })));

    await expect(
      service.submitEssJob({ jobPackageName: '/p/', jobDefName: 'Missing', parameters: '' }),
    ).rejects.toThrow('was not scheduled');
  });

  it('數字型 ReqstId 也正確轉為字串', async () => {
    const service = buildService(jest.fn().mockResolvedValue(jsonResponse({ ReqstId: 198867 })));

    await expect(service.import(GL_JOURNAL_TEMPLATE, [CONTENT], PARAMETER_LIST)).resolves.toEqual({
      requestId: '198867',
    });
  });
});

describe('FusionFbdiService ESS', () => {
  it('查詢狀態走 ESSJobStatusRF finder', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ items: [{ RequestStatus: 'SUCCEEDED' }] }));
    const service = buildService(fetchMock);

    const status = await service.getEssStatus('198867');

    expect(status.state).toBe('SUCCEEDED');
    expect(fetchMock.mock.calls[0][0]).toContain('finder=ESSJobStatusRF;requestId=198867');
  });

  it('submitEssJob 送出 submitESSJobRequest', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ ReqstId: '200001' }));
    const service = buildService(fetchMock);

    const result = await service.submitEssJob({
      jobPackageName: '/oracle/apps/ess/financials/generalLedger/programs/common/',
      jobDefName: 'AutomaticPosting',
      parameters: '300000001',
    });

    expect(result.requestId).toBe('200001');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.OperationName).toBe('submitESSJobRequest');
    expect(body.JobDefName).toBe('AutomaticPosting');
    expect(body.ESSParameters).toBe('300000001');
  });

  it('waitForEss 輪詢至終態，PAUSED 視為進行中', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [{ RequestStatus: 'RUNNING' }] }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ RequestStatus: 'PAUSED' }] }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ RequestStatus: 'SUCCEEDED' }] }));

    const seen: EssJobStatus[] = [];
    const status = await buildService(fetchMock).waitForEss('198867', {
      intervalMs: 0,
      onPoll: s => seen.push(s),
    });

    expect(status.state).toBe('SUCCEEDED');
    expect(seen.map(s => s.state)).toEqual(['IN_PROGRESS', 'IN_PROGRESS', 'SUCCEEDED']);
  });

  it('waitForEss 超過時間上限時拋錯並帶出最後狀態', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ items: [{ RequestStatus: 'RUNNING' }] }));

    await expect(buildService(fetchMock).waitForEss('198867', { intervalMs: 10, timeoutMs: 5 })).rejects.toThrow(
      'did not reach a terminal state',
    );
  });

  it('downloadEssLog 回傳解碼後的位元組，並用 PascalCase 欄位名', async () => {
    // 實測：Fusion 期望 ReqstId / FileType；requestId / fileType 會回 400
    const archive = zipFiles([{ name: '198867.log', content: Buffer.from('GL-98765: invalid account segment') }]);
    const withLog = jest.fn().mockResolvedValue(jsonResponse({ DocumentContent: archive.toString('base64') }));

    const raw = await buildService(withLog).downloadEssLog('198867');

    expect(raw).toBeInstanceOf(Buffer);
    expect(raw?.subarray(0, 2).toString('latin1')).toBe('PK');

    const body = JSON.parse(withLog.mock.calls[0][1].body);

    expect(body.OperationName).toBe('downloadESSJobExecutionDetails');
    expect(body.ReqstId).toBe('198867');
    expect(body.FileType).toBe('log');
    expect(body.requestId).toBeUndefined();

    await expect(buildService(jest.fn().mockResolvedValue(jsonResponse({}))).downloadEssLog('1')).resolves.toBeNull();
  });

  it('downloadEssLogText 解開 Fusion 回傳的封存檔（log 實際是 zip）', async () => {
    const archive = zipFiles([{ name: '198867.log', content: Buffer.from('import completed') }]);
    const service = buildService(
      jest.fn().mockResolvedValue(jsonResponse({ DocumentContent: archive.toString('base64') })),
    );

    await expect(service.downloadEssLogText('198867')).resolves.toBe('import completed');
  });

  it('downloadEssLogText 對非封存內容退回直接解碼', async () => {
    const service = buildService(
      jest.fn().mockResolvedValue(jsonResponse({ DocumentContent: Buffer.from('plain text').toString('base64') })),
    );

    await expect(service.downloadEssLogText('1')).resolves.toBe('plain text');
  });
});
