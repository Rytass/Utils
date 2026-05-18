/**
 * @jest-environment node
 */

import axios from 'axios';
import { AddressInfo } from 'net';
import http, { createServer } from 'http';
import {
  ECPayIssueType,
  ECPayPrintType,
  ECPayTicketCallbackError,
  ECPayTicketEvents,
  ECPayTicketGateway,
  ECPayTicketIssueOutcome,
  ECPayTicketRefundNotification,
  ECPayTicketUseStatus,
  ECPayTicketUseStatusNotification,
} from '../src';
import {
  ECPayTicketIssueResponseDecrypted,
  ECPayTicketQueryIssueResultResponseDecrypted,
  ECPayTicketQueryOrderInfoResponseDecrypted,
} from '../src/ecpay-ticket-typings';
import {
  buildTicketResponseEnvelope,
  computeTicketCheckMacValue,
  encryptTicketData,
} from '../__utils__/ticket-envelope';

describe('ECPayTicketGateway', () => {
  // 強制 built-in server 綁定到隨機可用 port，避免 3000 被占用或多測試衝突
  const originCreateServer = createServer;
  const mockedCreateServer = jest.spyOn(http, 'createServer');

  mockedCreateServer.mockImplementation(requestHandler => {
    const mockServer = originCreateServer(requestHandler);

    const mockedListen = jest.spyOn(mockServer, 'listen');

    mockedListen.mockImplementationOnce((_port?: number, _hostname?: string, listeningListener?: () => void) => {
      mockServer.listen(0, listeningListener);

      return mockServer;
    });

    return mockServer;
  });

  afterAll(() => {
    mockedCreateServer.mockRestore();
  });

  describe('constructor validation', () => {
    it('throws when hashKey is not exactly 16 bytes', () => {
      expect(() => new ECPayTicketGateway({ hashKey: 'tooShort' })).toThrow(/hashKey must be exactly 16 bytes/);
      expect(() => new ECPayTicketGateway({ hashKey: 'a'.repeat(17) })).toThrow(/hashKey must be exactly 16 bytes/);
    });

    it('throws when hashIv is not exactly 16 bytes', () => {
      expect(() => new ECPayTicketGateway({ hashIv: 'tooShort' })).toThrow(/hashIv must be exactly 16 bytes/);
    });

    it('throws when hashKey contains multibyte characters that exceed 16 bytes', () => {
      // '中' is 3 bytes in UTF-8; 8 of them = 24 bytes > 16
      expect(() => new ECPayTicketGateway({ hashKey: '中'.repeat(8) })).toThrow(/hashKey must be exactly 16 bytes/);
    });
  });

  describe('encrypt/decrypt symmetry', () => {
    it('roundtrip preserves payload exactly', () => {
      const gateway = new ECPayTicketGateway();
      const original = { ItemName: '中文 Name', Amount: 100, Nested: { Foo: 'bar' } };
      const encrypted = encryptTicketData(original);
      // @ts-expect-error access private for white-box test
      const decrypted = gateway.decrypt(encrypted);

      expect(decrypted).toEqual(original);
    });
  });

  describe('CheckMacValue calculation', () => {
    it('produces deterministic SHA256 uppercase output', () => {
      const macA = computeTicketCheckMacValue('AAAA');
      const macB = computeTicketCheckMacValue('AAAA');

      expect(macA).toBe(macB);
      expect(macA).toMatch(/^[0-9A-F]{64}$/);
    });

    it('changes when Data changes', () => {
      expect(computeTicketCheckMacValue('AAAA')).not.toBe(computeTicketCheckMacValue('BBBB'));
    });
  });

  describe('issue()', () => {
    let post: jest.SpyInstance;

    beforeEach(() => {
      post = jest.spyOn(axios, 'post');
    });

    afterEach(() => {
      post.mockRestore();
    });

    it('rejects when no merchantTradeNo / freeTradeNo provided', async () => {
      const gateway = new ECPayTicketGateway();

      await expect(
        gateway.issue({
          issueType: ECPayIssueType.SERIAL_ONLY,
          operator: 'Test',
          tickets: [{ ticketAmount: 1, itemName: 'X', ticketPrice: 100 }],
        }),
      ).rejects.toThrow(/merchantTradeNo or freeTradeNo/);
    });

    it('rejects when tickets array empty', async () => {
      const gateway = new ECPayTicketGateway();

      await expect(
        gateway.issue({
          merchantTradeNo: 'M1',
          issueType: ECPayIssueType.CVS,
          operator: 'Test',
          tickets: [],
        }),
      ).rejects.toThrow(/At least one ticket/);
    });

    it('posts a valid encrypted envelope and returns receipt immediately', async () => {
      const gateway = new ECPayTicketGateway({
        // 把輪詢調得遠大於這個測試的時間範圍，避免背景輪詢觸發 axios
        issuePoll: { intervalMs: 60_000, timeoutMs: 60_000 },
      });

      const decryptedResponse: ECPayTicketIssueResponseDecrypted = {
        RtnCode: 1,
        RtnMsg: 'OK',
        MerchantTradeNo: 'M001',
        TicketTradeNo: 'TT12345678901234',
        TicketData: [{ ItemNo: 'I1', TicketAmount: 2 }],
      };

      post.mockImplementation(async (url: string, body: unknown) => {
        expect(url).toBe('https://ecticket-stage.ecpay.com.tw/api/Ticket/Issue');

        const parsed = JSON.parse(body as string);

        expect(parsed.MerchantID).toBe('2000132');
        expect(parsed.RqHeader.Timestamp).toEqual(expect.any(Number));
        expect(typeof parsed.Data).toBe('string');
        expect(parsed.CheckMacValue).toBe(computeTicketCheckMacValue(parsed.Data));

        return { data: buildTicketResponseEnvelope(decryptedResponse) };
      });

      const result = await gateway.issue({
        merchantTradeNo: 'M001',
        issueType: ECPayIssueType.CVS,
        operator: 'Tester',
        customer: { email: 'a@b.com' },
        tickets: [{ itemNo: 'I1', ticketAmount: 2 }],
      });

      expect(result).toMatchObject({
        merchantTradeNo: 'M001',
        ticketTradeNo: 'TT12345678901234',
        tickets: [{ itemNo: 'I1', ticketAmount: 2 }],
      });
    });

    it('throws on TransCode != 1', async () => {
      const gateway = new ECPayTicketGateway();

      post.mockImplementation(async () => ({
        data: buildTicketResponseEnvelope({ ignored: true }, { transCode: 99, transMsg: 'Bad request' }),
      }));

      await expect(
        gateway.issue({
          merchantTradeNo: 'M001',
          issueType: ECPayIssueType.CVS,
          operator: 'Tester',
          tickets: [{ itemNo: 'I1', ticketAmount: 1 }],
        }),
      ).rejects.toThrow(/transport error.*Bad request/);
    });

    it('throws on Decrypted RtnCode != 1', async () => {
      const gateway = new ECPayTicketGateway();

      const decrypted: ECPayTicketIssueResponseDecrypted = {
        RtnCode: 10010,
        RtnMsg: 'Invalid Operator',
        TicketTradeNo: '',
        TicketData: [],
      };

      post.mockImplementation(async () => ({ data: buildTicketResponseEnvelope(decrypted) }));

      await expect(
        gateway.issue({
          merchantTradeNo: 'M001',
          issueType: ECPayIssueType.CVS,
          operator: 'BadOp',
          tickets: [{ itemNo: 'I1', ticketAmount: 1 }],
        }),
      ).rejects.toThrow(/issue failed.*Invalid Operator/);
    });

    it('rejects when response CheckMacValue invalid', async () => {
      const gateway = new ECPayTicketGateway();

      const envelope = buildTicketResponseEnvelope<ECPayTicketIssueResponseDecrypted>({
        RtnCode: 1,
        RtnMsg: 'OK',
        TicketTradeNo: 'TT',
        TicketData: [],
      });

      envelope.CheckMacValue = 'TAMPERED';

      post.mockImplementation(async () => ({ data: envelope }));

      await expect(
        gateway.issue({
          merchantTradeNo: 'M001',
          issueType: ECPayIssueType.CVS,
          operator: 'Tester',
          tickets: [{ itemNo: 'I1', ticketAmount: 1 }],
        }),
      ).rejects.toThrow(/Invalid CheckMacValue/);
    });

    it('with issuePoll: false, does not start background polling after issue()', async () => {
      const gateway = new ECPayTicketGateway({ issuePoll: false });

      const issueDecrypted: ECPayTicketIssueResponseDecrypted = {
        RtnCode: 1,
        RtnMsg: 'OK',
        MerchantTradeNo: 'M-NO-POLL',
        TicketTradeNo: 'TT-NO-POLL',
        TicketData: [],
      };

      let issueCalls = 0;
      let queryCalls = 0;

      post.mockImplementation(async (url: string) => {
        if (url.endsWith('/api/Ticket/Issue')) {
          issueCalls += 1;

          return { data: buildTicketResponseEnvelope(issueDecrypted) };
        }

        queryCalls += 1;

        return {
          data: buildTicketResponseEnvelope<ECPayTicketQueryIssueResultResponseDecrypted>({
            RtnCode: 1,
            RtnMsg: 'OK',
            MerchantTradeNo: 'M-NO-POLL',
            Status: 3,
            Remark: '',
          }),
        };
      });

      let issuedFired = false;
      let issueFailedFired = false;

      gateway.emitter.on(ECPayTicketEvents.TICKET_ISSUED, () => {
        issuedFired = true;
      });

      gateway.emitter.on(ECPayTicketEvents.TICKET_ISSUE_FAILED, () => {
        issueFailedFired = true;
      });

      await gateway.issue({
        merchantTradeNo: 'M-NO-POLL',
        issueType: ECPayIssueType.CVS,
        operator: 'Tester',
        tickets: [{ itemNo: 'I1', ticketAmount: 1 }],
      });

      // Give any (incorrectly-scheduled) timers a chance to run
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(issueCalls).toBe(1);
      expect(queryCalls).toBe(0);
      expect(issuedFired).toBe(false);
      expect(issueFailedFired).toBe(false);
    });

    it('issuePoll: false still honours waitForIssuance: true on a per-call basis', async () => {
      const gateway = new ECPayTicketGateway({
        issuePoll: false,
      });

      // Override the default poll interval via private field (waitForIssuance path uses defaults)
      // For a fast test, the public API doesn't allow tuning when issuePoll:false, so we override via reflection:
      // @ts-expect-error white-box: shrink the poll interval to keep the test fast
      gateway.pollIntervalMs = 10;
      // @ts-expect-error
      gateway.pollTimeoutMs = 1000;

      const issueDecrypted: ECPayTicketIssueResponseDecrypted = {
        RtnCode: 1,
        RtnMsg: 'OK',
        MerchantTradeNo: 'M-NO-POLL-WAIT',
        TicketTradeNo: 'TT-NO-POLL-WAIT',
        TicketData: [],
      };

      post.mockImplementation(async (url: string) => {
        if (url.endsWith('/api/Ticket/Issue')) {
          return { data: buildTicketResponseEnvelope(issueDecrypted) };
        }

        return {
          data: buildTicketResponseEnvelope<ECPayTicketQueryIssueResultResponseDecrypted>({
            RtnCode: 1,
            RtnMsg: 'OK',
            MerchantTradeNo: 'M-NO-POLL-WAIT',
            Status: 1,
            Remark: '',
          }),
        };
      });

      const outcome = (await gateway.issue({
        merchantTradeNo: 'M-NO-POLL-WAIT',
        issueType: ECPayIssueType.CVS,
        operator: 'Tester',
        tickets: [{ itemNo: 'I1', ticketAmount: 1 }],
        waitForIssuance: true,
      })) as ECPayTicketIssueOutcome;

      expect(outcome.status).toBe('success');
    });

    it('with waitForIssuance=true, resolves with the final outcome after polling', async () => {
      const gateway = new ECPayTicketGateway({
        issuePoll: { intervalMs: 10, timeoutMs: 5_000 },
      });

      const issueDecrypted: ECPayTicketIssueResponseDecrypted = {
        RtnCode: 1,
        RtnMsg: 'OK',
        MerchantTradeNo: 'M002',
        TicketTradeNo: 'TT2',
        TicketData: [{ ItemName: 'X', TicketPrice: 100, TicketAmount: 1 }],
      };

      const responses: ECPayTicketQueryIssueResultResponseDecrypted[] = [
        { RtnCode: 1, RtnMsg: 'OK', MerchantTradeNo: 'M002', Status: 3, Remark: '' },
        { RtnCode: 1, RtnMsg: 'OK', MerchantTradeNo: 'M002', Status: 1, Remark: '' },
      ];

      let call = 0;

      post.mockImplementation(async (url: string) => {
        if (url.endsWith('/api/Ticket/Issue')) {
          return { data: buildTicketResponseEnvelope(issueDecrypted) };
        }

        const next = responses[Math.min(call, responses.length - 1)];

        call += 1;

        return { data: buildTicketResponseEnvelope(next) };
      });

      const outcome = (await gateway.issue({
        merchantTradeNo: 'M002',
        issueType: ECPayIssueType.SERIAL_ONLY,
        operator: 'Tester',
        tickets: [{ itemName: 'X', ticketPrice: 100, ticketAmount: 1 }],
        waitForIssuance: true,
      })) as ECPayTicketIssueOutcome;

      expect(outcome.status).toBe('success');
      expect(outcome.merchantTradeNo).toBe('M002');
    });
  });

  describe('queryIssueResult()', () => {
    let post: jest.SpyInstance;

    beforeEach(() => {
      post = jest.spyOn(axios, 'post');
    });

    afterEach(() => {
      post.mockRestore();
    });

    it.each([
      [1, 'success'],
      [2, 'failed'],
      [3, 'processing'],
    ])('maps Status=%d → %s', async (statusCode, expectedStatus) => {
      const gateway = new ECPayTicketGateway();

      const decrypted: ECPayTicketQueryIssueResultResponseDecrypted = {
        RtnCode: 1,
        RtnMsg: 'OK',
        MerchantTradeNo: 'M003',
        Status: statusCode,
        Remark: statusCode === 2 ? 'reason' : '',
      };

      post.mockImplementation(async (url: string) => {
        expect(url).toBe('https://ecticket-stage.ecpay.com.tw/api/Ticket/QueryIssueResult');

        return { data: buildTicketResponseEnvelope(decrypted) };
      });

      const outcome = await gateway.queryIssueResult({ merchantTradeNo: 'M003' });

      expect(outcome.status).toBe(expectedStatus);
      expect(outcome.merchantTradeNo).toBe('M003');

      if (outcome.status === 'failed') {
        expect(outcome.remark).toBe('reason');
      }
    });

    it('rejects when neither merchantTradeNo nor freeTradeNo provided', async () => {
      const gateway = new ECPayTicketGateway();

      await expect(gateway.queryIssueResult({})).rejects.toThrow(/merchantTradeNo or freeTradeNo/);
    });
  });

  describe('queryOrderInfo()', () => {
    let post: jest.SpyInstance;

    beforeEach(() => {
      post = jest.spyOn(axios, 'post');
    });

    afterEach(() => {
      post.mockRestore();
    });

    it('maps the full order + ticket list, including UseStatus enum mapping', async () => {
      const gateway = new ECPayTicketGateway();

      const decrypted: ECPayTicketQueryOrderInfoResponseDecrypted = {
        RtnCode: 1,
        RtnMsg: 'OK',
        MerchantID: '2000132',
        MerchantTradeNo: 'M004',
        TicketTradeNo: 'TT4',
        PaymentProvider: '1',
        PaymentType: '1',
        Status: 1,
        Remark: '',
        IssueDate: '2026/05/18 14:30:00',
        IssueType: ECPayIssueType.SERIAL_ONLY,
        EscrowExpiredDate: '20260918',
        TotalCount: 4,
        TradeAmount: 400,
        RedeemCount: 1,
        RedeemAmount: 100,
        RefundCount: 1,
        RefundAmount: 100,
        TotalRefundFee: 0,
        UnUsedCount: 1,
        UnUsedAmount: 100,
        ExpiredCount: 1,
        TicketList: [
          { TicketNo: 'TKT-001', UseStatus: 1, TicketType: '1', TicketAmount: 100 },
          { TicketNo: 'TKT-002', UseStatus: 2, TicketType: '1', TicketAmount: 100, WriteOffDate: '20260601' },
          { TicketNo: 'TKT-003', UseStatus: 3, TicketType: '2', TicketAmount: 100, RefundDate: '20260602' },
          { TicketNo: 'TKT-004', UseStatus: 4, TicketType: '2', TicketAmount: 100, ExpiredDate: '20260603' },
        ],
      };

      post.mockImplementation(async () => ({ data: buildTicketResponseEnvelope(decrypted) }));

      const info = await gateway.queryOrderInfo({ merchantTradeNo: 'M004' });

      expect(info.merchantTradeNo).toBe('M004');
      expect(info.totalCount).toBe(4);
      expect(info.tradeAmount).toBe(400);
      expect(info.issueDate).toBeInstanceOf(Date);
      expect(info.tickets).toHaveLength(4);
      expect(info.tickets[0].useStatus).toBe(ECPayTicketUseStatus.UNUSED);
      expect(info.tickets[1].useStatus).toBe(ECPayTicketUseStatus.REDEEMED);
      expect(info.tickets[2].useStatus).toBe(ECPayTicketUseStatus.REFUNDED);
      expect(info.tickets[3].useStatus).toBe(ECPayTicketUseStatus.EXPIRED);
      expect(info.tickets[1].writeOffDate).toBeInstanceOf(Date);
    });

    it('omits date fields when ECPay sends malformed date strings', async () => {
      const gateway = new ECPayTicketGateway();

      const decrypted: ECPayTicketQueryOrderInfoResponseDecrypted = {
        RtnCode: 1,
        RtnMsg: 'OK',
        MerchantID: '2000132',
        MerchantTradeNo: 'M-BAD-DATES',
        TicketTradeNo: 'TT',
        PaymentProvider: '1',
        PaymentType: '1',
        Status: 1,
        Remark: '',
        IssueDate: 'not-a-date',
        IssueType: ECPayIssueType.SERIAL_ONLY,
        EscrowExpiredDate: 'oops',
        TotalCount: 1,
        TradeAmount: 100,
        RedeemCount: 0,
        RedeemAmount: 0,
        RefundCount: 0,
        RefundAmount: 0,
        TotalRefundFee: 0,
        UnUsedCount: 1,
        UnUsedAmount: 100,
        ExpiredCount: 0,
        TicketList: [{ TicketNo: 'TKT-1', UseStatus: 1, TicketType: '1', TicketAmount: 100, StartDate: 'garbage' }],
      };

      jest.spyOn(axios, 'post').mockImplementation(async () => ({ data: buildTicketResponseEnvelope(decrypted) }));

      const info = await gateway.queryOrderInfo({ merchantTradeNo: 'M-BAD-DATES' });

      expect(info.issueDate).toBeUndefined();
      expect(info.escrowExpiredDate).toBeUndefined();
      expect(info.tickets[0].startDate).toBeUndefined();
    });
  });

  describe('built-in callback server', () => {
    function postToServer(
      port: number,
      path: string,
      body: object,
    ): Promise<{ statusCode: number | undefined; body: string }> {
      return new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          },
          res => {
            const chunks: Buffer[] = [];

            res.on('data', chunk => chunks.push(chunk as Buffer));
            res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
          },
        );

        req.on('error', reject);
        req.write(JSON.stringify(body));
        req.end();
      });
    }

    function getPort(gateway: ECPayTicketGateway): number {
      const addr = gateway._server!.address() as AddressInfo;

      return addr.port;
    }

    it('emits SERVER_LISTENED on startup', done => {
      const gateway = new ECPayTicketGateway({
        withServer: true,
        onServerListen: (): void => {
          gateway._server?.close(done);
        },
      });
    });

    it('emits TICKET_REFUND_NOTIFIED on valid refund callback and replies 1|OK', done => {
      const gateway = new ECPayTicketGateway({
        withServer: true,
        onServerListen: async (): Promise<void> => {
          gateway.emitter.on(ECPayTicketEvents.TICKET_REFUND_NOTIFIED, (n: ECPayTicketRefundNotification) => {
            expect(n.ticketTradeNo).toBe('TT-REF');
            expect(n.refundAmount).toBe(200);
            gateway._server?.close(done);
          });

          const port = getPort(gateway);
          const envelope = buildTicketResponseEnvelope({
            MerchantTradeNo: 'MR1',
            TicketTradeNo: 'TT-REF',
            RefundAmount: 200,
            Remark: 'customer refund',
          });

          const { statusCode, body } = await postToServer(port, '/payments/ecpay/ticket/refund', envelope);

          expect(statusCode).toBe(200);
          expect(body).toBe('1|OK');
        },
      });
    });

    it('emits TICKET_USE_STATUS_CHANGED on valid use-status callback', done => {
      const gateway = new ECPayTicketGateway({
        withServer: true,
        onServerListen: async (): Promise<void> => {
          gateway.emitter.on(ECPayTicketEvents.TICKET_USE_STATUS_CHANGED, (n: ECPayTicketUseStatusNotification) => {
            expect(n.ticketNo).toBe('TKT-USE-001');
            expect(n.useStatus).toBe(ECPayTicketUseStatus.REDEEMED);
            gateway._server?.close(done);
          });

          const port = getPort(gateway);
          const envelope = buildTicketResponseEnvelope({
            MerchantTradeNo: 'MR2',
            TicketTradeNo: 'TT-USE',
            TicketNo: 'TKT-USE-001',
            UseStatus: 2,
          });

          await postToServer(port, '/payments/ecpay/ticket/use-status', envelope);
        },
      });
    });

    it('rejects callback with invalid CheckMacValue', done => {
      const gateway = new ECPayTicketGateway({
        withServer: true,
        onServerListen: async (): Promise<void> => {
          const port = getPort(gateway);
          const envelope = buildTicketResponseEnvelope({ TicketTradeNo: 'X' });

          envelope.CheckMacValue = 'TAMPERED';

          let refundFired = false;

          gateway.emitter.on(ECPayTicketEvents.TICKET_REFUND_NOTIFIED, () => {
            refundFired = true;
          });

          const { statusCode, body } = await postToServer(port, '/payments/ecpay/ticket/refund', envelope);

          expect(statusCode).toBe(400);
          expect(body).toBe('0|InvalidCheckMacValue');
          expect(refundFired).toBe(false);

          gateway._server?.close(done);
        },
      });
    });

    it('returns 404 for unknown path', done => {
      const gateway = new ECPayTicketGateway({
        withServer: true,
        onServerListen: async (): Promise<void> => {
          const port = getPort(gateway);
          const { statusCode } = await postToServer(port, '/random/path', {});

          expect(statusCode).toBe(404);
          gateway._server?.close(done);
        },
      });
    });
  });

  describe('framework-agnostic notification handlers (no built-in server)', () => {
    it('handleRefundNotification returns parsed notification and emits event', () => {
      const gateway = new ECPayTicketGateway();

      const envelope = buildTicketResponseEnvelope({
        MerchantTradeNo: 'M-REF-1',
        TicketTradeNo: 'TT-REF-1',
        RefundAmount: 350,
        Remark: 'customer requested',
      });

      let emitted: ECPayTicketRefundNotification | undefined;

      gateway.emitter.on(ECPayTicketEvents.TICKET_REFUND_NOTIFIED, n => {
        emitted = n;
      });

      const result = gateway.handleRefundNotification(envelope);

      expect(result.merchantTradeNo).toBe('M-REF-1');
      expect(result.ticketTradeNo).toBe('TT-REF-1');
      expect(result.refundAmount).toBe(350);
      expect(result.remark).toBe('customer requested');
      expect(emitted).toBe(result);
    });

    it('handleUseStatusNotification returns parsed notification and emits event', () => {
      const gateway = new ECPayTicketGateway();

      const envelope = buildTicketResponseEnvelope({
        MerchantTradeNo: 'M-USE-1',
        TicketTradeNo: 'TT-USE-1',
        TicketNo: 'TKT-USE-X',
        UseStatus: 2,
      });

      let emitted: ECPayTicketUseStatusNotification | undefined;

      gateway.emitter.on(ECPayTicketEvents.TICKET_USE_STATUS_CHANGED, n => {
        emitted = n;
      });

      const result = gateway.handleUseStatusNotification(envelope);

      expect(result.ticketNo).toBe('TKT-USE-X');
      expect(result.useStatus).toBe(ECPayTicketUseStatus.REDEEMED);
      expect(emitted).toBe(result);
    });

    it('handleRefundNotification throws INVALID_PAYLOAD when TicketTradeNo is missing', () => {
      const gateway = new ECPayTicketGateway();

      const envelope = buildTicketResponseEnvelope({
        MerchantTradeNo: 'M-X',
        RefundAmount: 100,
        // TicketTradeNo intentionally omitted
      });

      let fired = false;

      gateway.emitter.on(ECPayTicketEvents.TICKET_REFUND_NOTIFIED, () => {
        fired = true;
      });

      try {
        gateway.handleRefundNotification(envelope);
        throw new Error('expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ECPayTicketCallbackError);
        expect((err as ECPayTicketCallbackError).code).toBe('INVALID_PAYLOAD');
      }

      expect(fired).toBe(false);
    });

    it('handleRefundNotification throws INVALID_PAYLOAD when both MerchantTradeNo and FreeTradeNo are absent', () => {
      const gateway = new ECPayTicketGateway();

      const envelope = buildTicketResponseEnvelope({
        TicketTradeNo: 'TT-OK',
        RefundAmount: 50,
        // No MerchantTradeNo, no FreeTradeNo
      });

      try {
        gateway.handleRefundNotification(envelope);
        throw new Error('expected to throw');
      } catch (err) {
        expect((err as ECPayTicketCallbackError).code).toBe('INVALID_PAYLOAD');
      }
    });

    it('handleUseStatusNotification throws INVALID_PAYLOAD when UseStatus is missing', () => {
      const gateway = new ECPayTicketGateway();

      const envelope = buildTicketResponseEnvelope({
        MerchantTradeNo: 'M-X',
        TicketTradeNo: 'TT-X',
        TicketNo: 'TKT-X',
        // UseStatus intentionally missing — must not default to UNUSED
      });

      let fired = false;

      gateway.emitter.on(ECPayTicketEvents.TICKET_USE_STATUS_CHANGED, () => {
        fired = true;
      });

      try {
        gateway.handleUseStatusNotification(envelope);
        throw new Error('expected to throw');
      } catch (err) {
        expect((err as ECPayTicketCallbackError).code).toBe('INVALID_PAYLOAD');
      }

      expect(fired).toBe(false);
    });

    it('handleUseStatusNotification throws INVALID_PAYLOAD when UseStatus is out of range', () => {
      const gateway = new ECPayTicketGateway();

      const envelope = buildTicketResponseEnvelope({
        MerchantTradeNo: 'M-X',
        TicketTradeNo: 'TT-X',
        TicketNo: 'TKT-X',
        UseStatus: 99,
      });

      try {
        gateway.handleUseStatusNotification(envelope);
        throw new Error('expected to throw');
      } catch (err) {
        expect((err as ECPayTicketCallbackError).code).toBe('INVALID_PAYLOAD');
      }
    });

    it('handleRefundNotification throws ECPayTicketCallbackError(INVALID_CHECKMAC) on tampered envelope', () => {
      const gateway = new ECPayTicketGateway();

      const envelope = buildTicketResponseEnvelope({ TicketTradeNo: 'X', RefundAmount: 1 });

      envelope.CheckMacValue = 'TAMPERED';

      let fired = false;

      gateway.emitter.on(ECPayTicketEvents.TICKET_REFUND_NOTIFIED, () => {
        fired = true;
      });

      try {
        gateway.handleRefundNotification(envelope);
        throw new Error('expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ECPayTicketCallbackError);
        expect((err as ECPayTicketCallbackError).code).toBe('INVALID_CHECKMAC');
      }

      expect(fired).toBe(false);
    });

    it('handleUseStatusNotification throws ECPayTicketCallbackError(INVALID_DATA) when Data cannot be decrypted', () => {
      const gateway = new ECPayTicketGateway();

      const garbageData = 'NOT-A-VALID-AES-BASE64-PAYLOAD';
      const envelope = {
        PlatformID: '',
        MerchantID: '2000132',
        RpHeader: { Timestamp: Math.round(Date.now() / 1000) },
        TransCode: 1,
        TransMsg: '',
        Data: garbageData,
        CheckMacValue: computeTicketCheckMacValue(garbageData),
      };

      try {
        gateway.handleUseStatusNotification(envelope);
        throw new Error('expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ECPayTicketCallbackError);
        expect((err as ECPayTicketCallbackError).code).toBe('INVALID_DATA');
      }
    });
  });

  it('issue() with withServer=false does not auto-fill NotifyURL', async () => {
    const gateway = new ECPayTicketGateway({
      issuePoll: { intervalMs: 60_000, timeoutMs: 60_000 },
    });

    const post = jest.spyOn(axios, 'post');

    post.mockImplementation(async (_url: string, body: unknown) => {
      const parsed = JSON.parse(body as string);
      const data = parsed.Data;
      // 用 gateway 自己解密以驗證 plaintext 中不含 NotifyURL
      // @ts-expect-error private access for white-box validation
      const decrypted = gateway.decrypt(data) as Record<string, unknown>;

      expect(decrypted.RefundNotifyURL).toBeUndefined();
      expect(decrypted.UseStatusNotifyURL).toBeUndefined();

      return {
        data: buildTicketResponseEnvelope<ECPayTicketIssueResponseDecrypted>({
          RtnCode: 1,
          RtnMsg: 'OK',
          MerchantTradeNo: 'M005',
          TicketTradeNo: 'TT5',
          TicketData: [],
        }),
      };
    });

    await gateway.issue({
      merchantTradeNo: 'M005',
      issueType: ECPayIssueType.PAPER,
      printType: ECPayPrintType.ECPAY,
      operator: 'Tester',
      tickets: [{ itemNo: 'I1', ticketAmount: 1 }],
    });

    post.mockRestore();
  });
});
