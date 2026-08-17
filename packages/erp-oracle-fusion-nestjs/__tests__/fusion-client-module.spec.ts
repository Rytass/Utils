import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  FusionCustomerAccountService,
  FusionCustomerProfileService,
  FusionFbdiService,
  FusionRestClient,
  FusionSoapClient,
} from '@rytass/erp-oracle-fusion';
import type { FusionCallLogEntry, FusionCallLogSink } from '@rytass/erp-oracle-fusion';
import { FUSION_CALL_LOG_SINK, FusionClientModule, NoopFusionCallLogSink } from '@rytass/erp-oracle-fusion-nestjs';

/** module 組裝：provider 綁定、sink 注入路徑、單例保證與 global／非 global 兩種拓撲。 */

const CONFIG = {
  baseUrl: 'https://pod.example.com',
  auth: { type: 'basic' as const, username: 'u', password: 'p' },
};

@Injectable()
class TestSink implements FusionCallLogSink {
  readonly entries: FusionCallLogEntry[] = [];

  async record(entry: FusionCallLogEntry): Promise<void> {
    this.entries.push(entry);
  }
}

@Module({ providers: [TestSink], exports: [TestSink] })
class TestSinkModule {}

describe('FusionClientModule', () => {
  it('forRoot 提供 client 與 FBDI service，未指定 sink 時綁 no-op', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FusionClientModule.forRoot({ config: CONFIG })],
    }).compile();

    expect(moduleRef.get(FusionRestClient)).toBeInstanceOf(FusionRestClient);
    expect(moduleRef.get(FusionFbdiService)).toBeInstanceOf(FusionFbdiService);
    expect(moduleRef.get(FUSION_CALL_LOG_SINK)).toBeInstanceOf(NoopFusionCallLogSink);
  });

  it('forRootAsync 由 factory 取得設定', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        FusionClientModule.forRootAsync({
          useFactory: async () => ({ ...CONFIG, defaultNamespace: 'crmRestApi' }),
        }),
      ],
    }).compile();

    expect(moduleRef.get(FusionRestClient).resourceUrl('accounts')).toBe(
      'https://pod.example.com/crmRestApi/resources/11.13.18.05/accounts',
    );
  });

  it('可用 useExisting 綁定既有 provider 作為 sink，且真的被 client 使用', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ReqstId: '1' }),
      text: async () => '{}',
    } as unknown as Response);

    const moduleRef = await Test.createTestingModule({
      imports: [
        FusionClientModule.forRoot({
          config: { ...CONFIG, fetchImpl: fetchMock as unknown as typeof fetch },
          callLogSink: { imports: [TestSinkModule], useExisting: TestSink },
        }),
      ],
    }).compile();

    const sink = moduleRef.get(FUSION_CALL_LOG_SINK) as TestSink;

    expect(sink).toBeInstanceOf(TestSink);

    await moduleRef.get(FusionRestClient).get('ledgersLOV');

    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].endpoint).toBe('ledgersLOV');
  });

  /**
   * 非 global 的推薦拓撲：由 wrapper module 組裝一次並 `exports: [FusionClientModule]`，
   * 需要 client 的 module 顯式 import 該 wrapper。單例仍有保證。
   */
  it('非 global 時經 wrapper re-export 仍取得同一個 client 單例', async () => {
    @Module({
      imports: [FusionClientModule.forRoot({ config: CONFIG })],
      exports: [FusionClientModule],
    })
    class WrapperModule {}

    @Injectable()
    class ConsumerA {
      constructor(readonly client: FusionRestClient) {}
    }

    @Injectable()
    class ConsumerB {
      constructor(readonly client: FusionRestClient) {}
    }

    @Module({ imports: [WrapperModule], providers: [ConsumerA], exports: [ConsumerA] })
    class ModuleA {}

    @Module({ imports: [WrapperModule], providers: [ConsumerB], exports: [ConsumerB] })
    class ModuleB {}

    const moduleRef = await Test.createTestingModule({ imports: [ModuleA, ModuleB] }).compile();

    const a = moduleRef.get(ConsumerA, { strict: false });
    const b = moduleRef.get(ConsumerB, { strict: false });

    expect(a.client).toBeInstanceOf(FusionRestClient);
    expect(a.client).toBe(b.client);
  });

  it('未 import 且非 global 時無法解析（依賴必須顯式宣告）', async () => {
    @Injectable()
    class OrphanService {
      constructor(readonly client: FusionRestClient) {}
    }

    @Module({ providers: [OrphanService] })
    class OrphanModule {}

    await expect(
      Test.createTestingModule({
        imports: [FusionClientModule.forRoot({ config: CONFIG }), OrphanModule],
      }).compile(),
    ).rejects.toThrow();
  });

  it('isGlobal 時其他 module 不需 import 即可注入', async () => {
    @Injectable()
    class DownstreamService {
      constructor(readonly client: FusionRestClient) {}
    }

    @Module({ providers: [DownstreamService], exports: [DownstreamService] })
    class DownstreamModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [FusionClientModule.forRoot({ config: CONFIG, isGlobal: true }), DownstreamModule],
    }).compile();

    expect(moduleRef.get(DownstreamService, { strict: false }).client).toBeInstanceOf(FusionRestClient);
  });

  it('同時提供 SOAP client 與客戶帳戶／信用檔服務', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FusionClientModule.forRoot({ config: CONFIG })],
    }).compile();

    expect(moduleRef.get(FusionSoapClient)).toBeInstanceOf(FusionSoapClient);
    expect(moduleRef.get(FusionCustomerAccountService)).toBeInstanceOf(FusionCustomerAccountService);
    expect(moduleRef.get(FusionCustomerProfileService)).toBeInstanceOf(FusionCustomerProfileService);
  });

  /**
   * REST 與 SOAP 必須落在同一組觀測紀錄裡，否則無法用 correlationId 串起一筆單據
   * 「先開帳戶再設信用額度」的完整軌跡。
   */
  it('SOAP 呼叫與 REST 呼叫共用同一個 call log sink', async () => {
    const soapResponse =
      '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>' +
      '<ns0:getActiveCustomerProfileResponse xmlns:ns0="x"><ns0:result><ns0:Value>' +
      '<ns0:AccountNumber>4</ns0:AccountNumber></ns0:Value></ns0:result>' +
      '</ns0:getActiveCustomerProfileResponse></env:Body></env:Envelope>';

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (): string | null => null },
      json: async () => ({}),
      text: async () => soapResponse,
    } as unknown as Response);

    const moduleRef = await Test.createTestingModule({
      imports: [
        FusionClientModule.forRoot({
          config: { ...CONFIG, fetchImpl: fetchMock as unknown as typeof fetch },
          callLogSink: { imports: [TestSinkModule], useExisting: TestSink },
        }),
      ],
    }).compile();

    const sink = moduleRef.get(FUSION_CALL_LOG_SINK) as TestSink;

    await moduleRef.get(FusionCustomerProfileService).getActiveCustomerProfile({ AccountNumber: '4' });

    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].operation).toBe('getActiveCustomerProfile');
    expect(sink.entries[0].endpoint).toBe('/fscmService/ReceivablesCustomerProfileService');
  });

  it('no-op sink 不做任何事且不拋出', async () => {
    await expect(new NoopFusionCallLogSink().record()).resolves.toBeUndefined();
  });
});
