import {
  FUSION_AR_APPLICATION_ID,
  FUSION_GL_APPLICATION_ID,
  FusionAccountingPeriodService,
  FusionRestClient,
} from '@rytass/erp-oracle-fusion';

/** 會計期間狀態查詢：查詢條件必帶 ApplicationId，查無資料回 null。 */

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function buildService(fetchMock: jest.Mock): FusionAccountingPeriodService {
  return new FusionAccountingPeriodService(
    new FusionRestClient({
      baseUrl: 'https://pod.example.com',
      auth: { type: 'basic', username: 'u', password: 'p' },
      retryBaseDelayMs: 0,
      fetchImpl: fetchMock as unknown as typeof fetch,
    }),
  );
}

describe('FusionAccountingPeriodService.getStatus', () => {
  it('以 LedgerId／PeriodNameId／ApplicationId 查詢並回傳狀態', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ items: [{ ClosingStatus: 'O', StartDate: '2026-09-01', EndDate: '2026-09-30' }] }),
      );

    const status = await buildService(fetchMock).getStatus({
      ledgerId: '300000002498206',
      periodName: 'Sep-26',
      applicationId: FUSION_AR_APPLICATION_ID,
    });

    expect(status).toEqual({
      ledgerId: '300000002498206',
      periodName: 'Sep-26',
      applicationId: 222,
      closingStatus: 'O',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://pod.example.com/fscmRestApi/resources/11.13.18.05/accountingPeriodStatusLOV' +
        `?q=${encodeURIComponent('LedgerId=300000002498206;PeriodNameId=Sep-26;ApplicationId=222')}` +
        '&limit=1&onlyData=true',
    );
  });

  it.each([
    'Sep-26;ApplicationId=101',
    "Sep-26' OR 'a'='a",
    'Sep-26&limit=500',
    'Sep-26 or ApplicationId is not null',
    'Sep-26\n',
    '',
  ])('期間名含查詢語法字元（%s）時拋錯且不送出請求', async periodName => {
    const fetchMock = jest.fn();

    await expect(
      buildService(fetchMock).getStatus({ ledgerId: 1, periodName, applicationId: FUSION_AR_APPLICATION_ID }),
    ).rejects.toThrow(/Invalid periodName/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ledgerId 含查詢語法字元時拋錯', async () => {
    await expect(
      buildService(jest.fn()).getStatus({ ledgerId: '1;LedgerId=2', periodName: 'Sep-26', applicationId: 101 }),
    ).rejects.toThrow(/Invalid ledgerId/);

    await expect(
      buildService(jest.fn()).getStatus({ ledgerId: '1 or 1', periodName: 'Sep-26', applicationId: 101 }),
    ).rejects.toThrow(/Invalid ledgerId/);
  });

  it('查無此期間回傳 null', async () => {
    const service = buildService(jest.fn().mockResolvedValue(jsonResponse({ items: [] })));

    await expect(
      service.getStatus({ ledgerId: 1, periodName: 'Xxx-99', applicationId: FUSION_GL_APPLICATION_ID }),
    ).resolves.toBeNull();
  });
});
