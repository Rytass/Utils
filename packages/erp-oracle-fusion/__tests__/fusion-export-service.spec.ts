import {
  buildDocumentIdsPath,
  buildExportBulkDataPayload,
  buildExportFilePrefix,
  buildGetDocumentPayload,
  buildUploadFilePayload,
  FUSION_EXTRACT_FILE_TYPES,
  FUSION_NULL_VALUE,
  FusionExportService,
  FusionRestClient,
} from '@rytass/erp-oracle-fusion';

/** Export payload construction and the three-step extraction flow. All fetches are stubbed. */

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function buildService(fetchMock: jest.Mock): FusionExportService {
  return new FusionExportService(
    new FusionRestClient({
      baseUrl: 'https://pod.example.com',
      auth: { type: 'basic', username: 'u', password: 'p' },
      retryBaseDelayMs: 0,
      fetchImpl: fetchMock as unknown as typeof fetch,
    }),
  );
}

describe('export payloads', () => {
  it('builds exportBulkData with job options and callback', () => {
    const payload = buildExportBulkDataPayload({
      jobName: '/oracle/apps/ess/financials/receivables/...,BillingHistoryExtract',
      parameterList: '2026-01-01,2026-01-31',
      extractFileType: FUSION_EXTRACT_FILE_TYPES.CSV,
      callbackUrl: 'https://my-service/callback',
    });

    expect(payload.OperationName).toBe('exportBulkData');
    expect(payload.JobOptions).toBe('ExtractFileType=CSV');
    expect(payload.CallbackURL).toBe('https://my-service/callback');
  });

  it('joins multiple extract file types with semicolons', () => {
    expect(
      buildExportBulkDataPayload({
        jobName: 'pkg,Job',
        parameterList: '',
        extractFileType: [FUSION_EXTRACT_FILE_TYPES.CSV, FUSION_EXTRACT_FILE_TYPES.LOG],
      }).JobOptions,
    ).toBe('ExtractFileType=CSV;LOG');
  });

  it('omits callback unless requested, and sends #NULL when explicitly disabled', () => {
    expect(buildExportBulkDataPayload({ jobName: 'p,J', parameterList: '' }).CallbackURL).toBeUndefined();
    expect(buildExportBulkDataPayload({ jobName: 'p,J', parameterList: '', callbackUrl: null }).CallbackURL).toBe(
      FUSION_NULL_VALUE,
    );
  });

  it('derives the output file prefix from the job definition name', () => {
    expect(buildExportFilePrefix('BillingHistoryExtract', '198867')).toBe(
      'ExportBulkData_BillingHistoryExtract_198867',
    );
  });

  it('resolves document ids through a GET finder, sending #NULL for unused parameters', () => {
    const path = buildDocumentIdsPath('ExportBulkData_Job_1');

    // Finder parameters are comma-separated, unlike the semicolon that follows the finder name
    expect(path).toBe(
      'erpintegrations?finder=DocumentIdsByFilePrefixRF;filePrefix=ExportBulkData_Job_1,docAccount=%23NULL,comment=%23NULL',
    );
  });

  it('honours document account and comment filters when supplied', () => {
    expect(buildDocumentIdsPath('prefix', { documentAccount: 'fin$/journal$/import' })).toContain(
      'docAccount=fin%24%2Fjournal%24%2Fimport',
    );
  });

  it('builds document download and upload payloads', () => {
    expect(buildGetDocumentPayload('233799')).toEqual({
      OperationName: 'getDocumentForDocumentId',
      DocumentId: '233799',
    });

    const upload = buildUploadFilePayload(Buffer.from('hello'), {
      fileName: 'Test.zip',
      documentAccount: 'fin$/journal$/import',
    });

    expect(upload.OperationName).toBe('uploadFileToUCM');
    expect(upload.ContentType).toBe('zip');
    expect(Buffer.from(upload.DocumentContent, 'base64').toString()).toBe('hello');
  });
});

describe('FusionExportService', () => {
  it('submitExport returns the request id and the prefix its output will use', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ ReqstId: 198867 }));

    const result = await buildService(fetchMock).submitExport({
      jobName: '/oracle/apps/ess/financials/receivables/x,BillingHistoryExtract',
      parameterList: 'p1,p2',
    });

    expect(result).toEqual({ requestId: '198867', filePrefix: 'ExportBulkData_BillingHistoryExtract_198867' });
  });

  it('submitExport fails loudly when the response carries no ReqstId', async () => {
    await expect(
      buildService(jest.fn().mockResolvedValue(jsonResponse({}))).submitExport({ jobName: 'p,J', parameterList: '' }),
    ).rejects.toThrow('no ReqstId');
  });

  it('submitExport rejects ReqstId=-1 (Fusion answers 200 even when the job does not exist)', async () => {
    // Verified against a live pod: submitting an unknown job path returns HTTP 200 with ReqstId "-1".
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ OperationName: 'exportBulkData', ReqstId: '-1' }));

    await expect(
      buildService(fetchMock).submitExport({ jobName: '/oracle/apps/ess/custom/nope,Missing', parameterList: '' }),
    ).rejects.toThrow('was not scheduled');
  });

  it('findDocumentIds returns an empty array while output is still being produced', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ items: [] }));

    await expect(buildService(fetchMock).findDocumentIds('prefix')).resolves.toEqual([]);
  });

  it('findDocumentIds normalises numeric ids to strings', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ items: [{ DocumentId: 233799 }, { DocumentId: '233800' }] }));

    await expect(buildService(fetchMock).findDocumentIds('prefix')).resolves.toEqual(['233799', '233800']);
  });

  it('downloadDocument decodes base64 content', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        DocumentContent: Buffer.from('csv,data').toString('base64'),
        FileName: 'ExportBulkData_Job_1.zip',
      }),
    );

    const doc = await buildService(fetchMock).downloadDocument('233799');

    expect(doc.content.toString()).toBe('csv,data');
    expect(doc.fileName).toBe('ExportBulkData_Job_1.zip');
  });

  it('downloadDocument fails when Fusion returns no content', async () => {
    await expect(buildService(jest.fn().mockResolvedValue(jsonResponse({}))).downloadDocument('1')).rejects.toThrow(
      'no DocumentContent',
    );
  });

  it('waitForDocuments polls until the output appears', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ DocumentId: '1' }] }));

    const polls: boolean[] = [];
    const ids = await buildService(fetchMock).waitForDocuments('prefix', {
      intervalMs: 0,
      onPoll: found => polls.push(found),
    });

    expect(ids).toEqual(['1']);
    expect(polls).toEqual([false, false, true]);
  });

  it('waitForDocuments gives up with a clear message', async () => {
    await expect(
      buildService(jest.fn().mockResolvedValue(jsonResponse({ items: [] }))).waitForDocuments('prefix', {
        intervalMs: 10,
        timeoutMs: 5,
      }),
    ).rejects.toThrow('did not appear within');
  });

  it('runExport performs submit, wait and download in one call', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ReqstId: '1' }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ DocumentId: '99' }] }))
      .mockResolvedValueOnce(jsonResponse({ DocumentContent: Buffer.from('out').toString('base64') }));

    const docs = await buildService(fetchMock).runExport({
      jobName: 'pkg,Job',
      parameterList: '',
      wait: { intervalMs: 0 },
    });

    expect(docs).toHaveLength(1);
    expect(docs[0].content.toString()).toBe('out');
  });

  it('uploadFile stages a file and returns its document id', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ DocumentId: 500123 }));

    await expect(
      buildService(fetchMock).uploadFile(Buffer.from('zip'), {
        fileName: 'Staged.zip',
        documentAccount: 'fin$/journal$/import',
      }),
    ).resolves.toBe('500123');
  });
});
