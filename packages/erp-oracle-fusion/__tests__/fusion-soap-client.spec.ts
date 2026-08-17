import {
  buildFindCriteria,
  buildFindControl,
  buildSoapEnvelope,
  classifySoapHttpError,
  escapeXml,
  FusionApiOutcome,
  FusionAuthError,
  FusionCustomerAccountService,
  FusionCustomerProfileService,
  FusionSoapClient,
  FusionSoapFaultError,
  FusionTransientError,
  parseSoapXml,
  serializeElement,
} from '@rytass/erp-oracle-fusion';
import type { FusionCallLogEntry, FusionCallLogSink, FusionClientOptions } from '@rytass/erp-oracle-fusion';

/**
 * `FusionSoapClient` 與其上的客戶帳戶／信用檔服務。
 *
 * 重點在三件容易出錯的事：雙 namespace 的 envelope 序列化、`undefined`／`null` 的
 * partial update 語意，以及「SOAP fault 一律是 HTTP 500 但不可重試」的錯誤分類。
 * XML fixture 取自真實 pod 回應，全數注入假的 fetch，不對外連線。
 */

class RecordingSink implements FusionCallLogSink {
  readonly entries: FusionCallLogEntry[] = [];

  async record(entry: FusionCallLogEntry): Promise<void> {
    this.entries.push(entry);
  }
}

function xmlResponse(xml: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (): string | null => null },
    text: async () => xml,
  } as unknown as Response;
}

function buildClient(overrides: Partial<FusionClientOptions> = {}): {
  client: FusionSoapClient;
  sink: RecordingSink;
  fetchMock: jest.Mock;
} {
  const sink = new RecordingSink();
  const fetchMock = jest.fn();

  const client = new FusionSoapClient({
    baseUrl: 'https://pod.example.com',
    auth: { type: 'basic', username: 'u', password: 'p' },
    retryBaseDelayMs: 0,
    callLogSink: sink,
    ...overrides,
    fetchImpl: fetchMock as unknown as typeof fetch,
  });

  return { client, sink, fetchMock };
}

const PROFILE_SERVICE_NS = 'http://xmlns.oracle.com/apps/financials/receivables/customers/customerProfileService/';

/** 取自真實 pod：帳戶層信用檔，含多個 `xsi:nil="true"` 欄位。 */
const PROFILE_RESPONSE_XML = `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Body>
    <ns0:getActiveCustomerProfileResponse xmlns:ns0="${PROFILE_SERVICE_NS}types/">
      <ns4:result xmlns:ns3="${PROFILE_SERVICE_NS}" xmlns:ns4="${PROFILE_SERVICE_NS}types/"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="ns3:CustomerProfileResult">
        <ns3:Value>
          <ns3:AccountNumber>4</ns3:AccountNumber>
          <ns3:SiteNumber xsi:nil="true"/>
          <ns3:CustomerAccountId>300000003278047</ns3:CustomerAccountId>
          <ns3:CustomerAccountProfileId>300000003278056</ns3:CustomerAccountProfileId>
          <ns3:ProfileClassName>DEFAULT</ns3:ProfileClassName>
          <ns3:CreditHold>N</ns3:CreditHold>
          <ns3:CreditLimit xsi:nil="true"/>
        </ns3:Value>
      </ns4:result>
    </ns0:getActiveCustomerProfileResponse>
  </env:Body>
</env:Envelope>`;

/** 取自真實 pod：查無資料的 fault（HTTP 500）。 */
const FAULT_RESPONSE_XML = `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Body>
    <env:Fault>
      <faultcode>env:Server</faultcode>
      <faultstring>JBO-FND:::FND_CMN_RCRD_MSNG: &lt;MESSAGE&gt;&lt;TEXT&gt;The record for Account Number X doesn't exist.&lt;/TEXT&gt;&lt;/MESSAGE&gt;</faultstring>
      <detail>
        <tns:ServiceErrorMessage xmlns:tns="http://xmlns.oracle.com/adf/svc/errors/">
          <tns:code>FND:::FND_CMN_RCRD_MSNG</tns:code>
          <tns:message>JBO-FND:::FND_CMN_RCRD_MSNG: &lt;MESSAGE&gt;&lt;TEXT&gt;The record for Account Number X doesn't exist.&lt;/TEXT&gt;&lt;/MESSAGE&gt;</tns:message>
          <tns:severity>SEVERITY_ERROR</tns:severity>
          <tns:exceptionClassName>oracle.apps.fnd.applcore.messages.ApplcoreException</tns:exceptionClassName>
        </tns:ServiceErrorMessage>
      </detail>
    </env:Fault>
  </env:Body>
</env:Envelope>`;

/** 取自真實 pod：欄位級驗證失敗，錯誤掛在巢狀 `detail` 下。 */
const ATTRIBUTE_FAULT_XML = `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Body>
    <env:Fault>
      <faultcode>env:Server</faultcode>
      <faultstring>JBO-27024: Failed to validate a row</faultstring>
      <detail>
        <tns:ServiceErrorMessage xmlns:tns="http://xmlns.oracle.com/adf/svc/errors/">
          <tns:code>27024</tns:code>
          <tns:message>JBO-27024: Failed to validate a row</tns:message>
          <tns:detail>
            <tns:message>JBO-27014: Attribute PartyId in CustomerProfileDEO is required.</tns:message>
            <tns:attributeName>PartyId</tns:attributeName>
            <tns:objectName>CustomerProfileDEO</tns:objectName>
          </tns:detail>
          <tns:detail>
            <tns:message>JBO-HZ:::HZ_INVALID_ORIG_SYSTEM</tns:message>
            <tns:attributeName>OrigSystem</tns:attributeName>
            <tns:objectName>CustomerAccountEO</tns:objectName>
          </tns:detail>
        </tns:ServiceErrorMessage>
      </detail>
    </env:Fault>
  </env:Body>
</env:Envelope>`;

describe('SOAP envelope 序列化', () => {
  it('operation 與參數 element 用 types namespace，內容欄位用 service namespace', () => {
    const xml = buildSoapEnvelope({
      operation: 'createCustomerProfile',
      typesNamespace: 'https://example.com/svc/types/',
      serviceNamespace: 'https://example.com/svc/',
      parameters: [{ name: 'customerProfile', value: { AccountNumber: '4', CreditLimit: 1000 } }],
    });

    expect(xml).toContain('xmlns:typ="https://example.com/svc/types/"');
    expect(xml).toContain('xmlns:svc="https://example.com/svc/"');
    expect(xml).toContain('<typ:createCustomerProfile>');
    expect(xml).toContain('<typ:customerProfile>');
    // 內容欄位換到 svc prefix——這是 Fusion BC4J 服務的關鍵結構特性
    expect(xml).toContain('<svc:AccountNumber>4</svc:AccountNumber>');
    expect(xml).toContain('<svc:CreditLimit>1000</svc:CreditLimit>');
  });

  it('undefined 欄位完全不輸出（partial update 的基礎）', () => {
    const xml = buildSoapEnvelope({
      operation: 'updateCustomerProfile',
      typesNamespace: 'https://example.com/svc/types/',
      serviceNamespace: 'https://example.com/svc/',
      parameters: [{ name: 'customerProfile', value: { AccountNumber: '4', CreditLimit: undefined } }],
    });

    expect(xml).toContain('<svc:AccountNumber>4</svc:AccountNumber>');
    expect(xml).not.toContain('CreditLimit');
  });

  it('null 欄位輸出 xsi:nil（明確清空）', () => {
    const xml = buildSoapEnvelope({
      operation: 'updateCustomerAccount',
      typesNamespace: 'https://example.com/svc/types/',
      serviceNamespace: 'https://example.com/svc/',
      parameters: [{ name: 'customerAccount', value: { Comments: null } }],
    });

    expect(xml).toContain('<svc:Comments xsi:nil="true"/>');
  });

  it('陣列展開為同名 element 重複出現', () => {
    expect(serializeElement('CustomerAccountSite', [{ PartySiteId: '1' }, { PartySiteId: '2' }], 'svc')).toBe(
      '<svc:CustomerAccountSite><svc:PartySiteId>1</svc:PartySiteId></svc:CustomerAccountSite>' +
        '<svc:CustomerAccountSite><svc:PartySiteId>2</svc:PartySiteId></svc:CustomerAccountSite>',
    );
  });

  it('跳脫 XML 特殊字元，客戶名稱含 & 或 < 不會產生無效 XML', () => {
    expect(escapeXml(`A & B <test> "q" 'r'`)).toBe('A &amp; B &lt;test&gt; &quot;q&quot; &apos;r&apos;');

    const xml = buildSoapEnvelope({
      operation: 'createCustomerAccount',
      typesNamespace: 'https://example.com/svc/types/',
      serviceNamespace: 'https://example.com/svc/',
      parameters: [{ name: 'customerAccount', value: { AccountName: 'A & B <Ltd>' } }],
    });

    expect(xml).toContain('<svc:AccountName>A &amp; B &lt;Ltd&gt;</svc:AccountName>');
  });

  it('頂層參數為陣列時展開為重複的參數 element（processCustomerAccount 的形狀）', () => {
    const xml = buildSoapEnvelope({
      operation: 'processCustomerAccount',
      typesNamespace: 'https://example.com/svc/types/',
      serviceNamespace: 'https://example.com/svc/',
      parameters: [{ name: 'customerAccount', value: [{ PartyId: '1' }, { PartyId: '2' }] }],
    });

    expect(xml).toContain(
      '<typ:customerAccount><svc:PartyId>1</svc:PartyId></typ:customerAccount>' +
        '<typ:customerAccount><svc:PartyId>2</svc:PartyId></typ:customerAccount>',
    );

    // 不可退化成 String(array) 的 "[object Object],[object Object]"
    expect(xml).not.toContain('[object Object]');
  });

  /** 陣列分支是遞迴呼叫，contentPrefix 沒往下傳的話子欄位會靜默退回預設的 svc。 */
  it('陣列參數遞迴時保留 contentPrefix，不會退回預設的 svc', () => {
    const xml = buildSoapEnvelope({
      operation: 'processCustomerAccount',
      typesNamespace: 'https://example.com/svc/types/',
      serviceNamespace: 'https://example.com/svc/',
      parameters: [{ name: 'criteria', value: [{ fetchSize: 1 }, { fetchSize: 2 }], contentPrefix: 'adf' }],
    });

    expect(xml).toContain(
      '<typ:criteria><adf:fetchSize>1</adf:fetchSize></typ:criteria>' +
        '<typ:criteria><adf:fetchSize>2</adf:fetchSize></typ:criteria>',
    );

    expect(xml).not.toContain('svc:fetchSize');
  });

  it('移除 XML 1.0 非法控制字元，避免整個 envelope 被拒收', () => {
    // 外部匯入資料常夾帶 NUL 或 UNIT SEPARATOR 等字元，無法用實體跳脫表示
    expect(escapeXml('\u0001\u0002ABC')).toBe('ABC');
    // 合法的空白字元必須保留
    expect(escapeXml('A\tB\nC\rD')).toBe('A\tB\nC\rD');
  });

  it('contentPrefix 可切到 adf namespace（FindCriteria 用）', () => {
    const xml = buildSoapEnvelope({
      operation: 'findCustomerAccount',
      typesNamespace: 'https://example.com/svc/types/',
      serviceNamespace: 'https://example.com/svc/',
      parameters: [{ name: 'findCriteria', value: { fetchSize: 3 }, contentPrefix: 'adf' }],
    });

    expect(xml).toContain('<adf:fetchSize>3</adf:fetchSize>');
  });
});

describe('ADF FindCriteria', () => {
  it('依 XSD sequence 順序輸出，順序錯誤會被 Fusion 拒收', () => {
    const criteria = buildFindCriteria({
      fetchStart: 0,
      fetchSize: 5,
      filters: [{ attribute: 'AccountNumber', operator: '=', value: '4' }],
      findAttributes: ['CustomerAccountId'],
    });

    const xml = serializeElement('findCriteria', criteria, 'adf');
    const order = ['fetchStart', 'fetchSize', 'filter', 'findAttribute', 'excludeAttribute'].map(name =>
      xml.indexOf(`<adf:${name}>`),
    );

    expect(order.every((position, index) => index === 0 || position > order[index - 1])).toBe(true);
    // item 內部順序：upperCaseCompare → attribute → operator → value
    expect(xml).toContain(
      '<adf:upperCaseCompare>false</adf:upperCaseCompare><adf:attribute>AccountNumber</adf:attribute>' +
        '<adf:operator>=</adf:operator><adf:value>4</adf:value>',
    );
  });

  it('無 filter 時不輸出 filter 節點，但 excludeAttribute 必定存在', () => {
    const xml = serializeElement('findCriteria', buildFindCriteria({ fetchSize: 1 }), 'adf');

    expect(xml).not.toContain('<adf:filter>');
    expect(xml).toContain('<adf:excludeAttribute>false</adf:excludeAttribute>');
  });

  it('IN 運算子輸出多個 value', () => {
    const xml = serializeElement(
      'findCriteria',
      buildFindCriteria({ filters: [{ attribute: 'Status', operator: 'IN', value: ['A', 'I'] }] }),
      'adf',
    );

    expect(xml).toContain('<adf:value>A</adf:value><adf:value>I</adf:value>');
  });

  it('findControl 預設不取多語系翻譯', () => {
    expect(buildFindControl()).toEqual({ retrieveAllTranslations: false });
  });
});

describe('SOAP 回應解析', () => {
  it('xsi:nil 轉為 null，其餘值保持字串（long 型 id 不可轉 number）', () => {
    const parsed = parseSoapXml(PROFILE_RESPONSE_XML) as Record<string, never>;
    const value = (parsed['Envelope'] as Record<string, Record<string, Record<string, Record<string, unknown>>>>)[
      'Body'
    ]['getActiveCustomerProfileResponse']['result'] as Record<string, Record<string, unknown>>;

    expect(value['Value']['CustomerAccountId']).toBe('300000003278047');
    expect(typeof value['Value']['CustomerAccountId']).toBe('string');
    expect(value['Value']['SiteNumber']).toBeNull();
    expect(value['Value']['CreditLimit']).toBeNull();
  });
});

describe('SOAP 錯誤分類', () => {
  it('500 帶 fault 分類為 FusionSoapFaultError，且不是 transient', () => {
    const error = classifySoapHttpError(500, FAULT_RESPONSE_XML, 'SOAP getActiveCustomerProfile');

    expect(error).toBeInstanceOf(FusionSoapFaultError);
    expect(error).not.toBeInstanceOf(FusionTransientError);

    const fault = error as FusionSoapFaultError;

    expect(fault.errorCode).toBe('FND:::FND_CMN_RCRD_MSNG');
    expect(fault.faultCode).toBe('env:Server');
    expect(fault.severity).toBe('SEVERITY_ERROR');
    // <TEXT> 內的可讀敘述被抽出來，而不是原始的 <MESSAGE> 包裝
    expect(fault.message).toContain("The record for Account Number X doesn't exist.");
  });

  it('遞迴收集巢狀 detail 中的欄位級錯誤', () => {
    const fault = classifySoapHttpError(500, ATTRIBUTE_FAULT_XML, 'SOAP createCustomerProfile') as FusionSoapFaultError;

    expect(fault.attributeErrors).toHaveLength(2);
    expect(fault.attributeErrors[0]).toEqual({
      attributeName: 'PartyId',
      objectName: 'CustomerProfileDEO',
      message: 'JBO-27014: Attribute PartyId in CustomerProfileDEO is required.',
    });

    expect(fault.attributeErrors[1]?.attributeName).toBe('OrigSystem');
  });

  it('500 但無 fault 才是可重試的暫時性錯誤', () => {
    const error = classifySoapHttpError(500, '<html>gateway error</html>', 'SOAP x');

    expect(error).toBeInstanceOf(FusionTransientError);
  });

  it('401 分類為認證錯誤', () => {
    expect(classifySoapHttpError(401, '', 'SOAP x')).toBeInstanceOf(FusionAuthError);
  });
});

describe('FusionSoapClient', () => {
  it('送出正確的 SOAPAction、Content-Type 與 Basic 認證標頭', async () => {
    const { client, fetchMock } = buildClient();

    fetchMock.mockResolvedValue(xmlResponse(PROFILE_RESPONSE_XML));

    await new FusionCustomerProfileService(client).getActiveCustomerProfile({ AccountNumber: '4' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe('https://pod.example.com/fscmService/ReceivablesCustomerProfileService');
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;

    expect(headers['SOAPAction']).toBe(`${PROFILE_SERVICE_NS}getActiveCustomerProfile`);
    expect(headers['Content-Type']).toBe('text/xml;charset=UTF-8');
    expect(headers['Authorization']).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`);
  });

  it('fault 不重試——這是寫入操作的安全底線', async () => {
    const { client, fetchMock } = buildClient();

    fetchMock.mockResolvedValue(xmlResponse(FAULT_RESPONSE_XML, 500));

    await expect(
      client.call(
        { path: '/x', serviceNamespace: 'n/', typesNamespace: 'n/types/', soapActionNamespace: 'n/' },
        'op',
        [],
        {
          maxRetries: 3,
        },
      ),
    ).rejects.toBeInstanceOf(FusionSoapFaultError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('500 無 fault 則照常重試', async () => {
    const { client, fetchMock } = buildClient();

    fetchMock.mockResolvedValue(xmlResponse('<html>bad gateway</html>', 500));

    await expect(
      client.call(
        { path: '/x', serviceNamespace: 'n/', typesNamespace: 'n/types/', soapActionNamespace: 'n/' },
        'op',
        [],
        {
          maxRetries: 2,
        },
      ),
    ).rejects.toBeInstanceOf(FusionTransientError);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  /**
   * Fusion 幾乎總是以 500 回 fault，但 SOAP 1.1 允許 fault 走 2xx。這條路徑若失守，
   * 一個失敗的寫入會被當成成功回傳，是最難察覺的失效模式。
   */
  it('HTTP 200 但 body 含 fault 時仍拋錯，且不重試', async () => {
    const { client, sink, fetchMock } = buildClient();

    fetchMock.mockResolvedValue(xmlResponse(FAULT_RESPONSE_XML, 200));

    await expect(
      client.call(
        { path: '/x', serviceNamespace: 'n/', typesNamespace: 'n/types/', soapActionNamespace: 'n/' },
        'op',
        [],
        { maxRetries: 3 },
      ),
    ).rejects.toBeInstanceOf(FusionSoapFaultError);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const entry = sink.entries[0]!;

    expect(entry.outcome).toBe(FusionApiOutcome.VALIDATION_ERROR);
    expect(entry.errorCode).toBe('FND:::FND_CMN_RCRD_MSNG');
    // 錯誤如實記錄實際的 HTTP 狀態，而不是硬寫 500
    expect(entry.httpStatus).toBe(200);
    expect(entry.attempt).toBe(1);
  });

  /**
   * 用 202 而非 200，才能鎖住「錯誤沿用實際狀態碼」——若改回硬寫 200，只有 200 的
   * fixture 是驗不出來的。
   */
  it('2xx + fault 時錯誤沿用實際狀態碼，而非硬寫 200', async () => {
    const { client, sink, fetchMock } = buildClient();

    fetchMock.mockResolvedValue(xmlResponse(FAULT_RESPONSE_XML, 202));

    await expect(
      client.call(
        { path: '/x', serviceNamespace: 'n/', typesNamespace: 'n/types/', soapActionNamespace: 'n/' },
        'op',
        [],
      ),
    ).rejects.toMatchObject({ status: 202 });

    expect(sink.entries[0]!.httpStatus).toBe(202);
  });

  it('埋點記錄 refs、摘要與 SOAP operation 名稱', async () => {
    const { client, sink, fetchMock } = buildClient();

    fetchMock.mockResolvedValue(xmlResponse(PROFILE_RESPONSE_XML));

    await new FusionCustomerProfileService(client).getActiveCustomerProfile({ AccountNumber: '4' });

    expect(sink.entries).toHaveLength(1);

    const entry = sink.entries[0]!;

    expect(entry.operation).toBe('getActiveCustomerProfile');
    expect(entry.endpoint).toBe('/fscmService/ReceivablesCustomerProfileService');
    expect(entry.outcome).toBe(FusionApiOutcome.SUCCESS);
    expect(entry.refs).toMatchObject({ CustomerAccountProfileId: '300000003278056', AccountNumber: '4' });
    expect(entry.responseSummary).toContain('DEFAULT');
  });

  it('fault 落地為 VALIDATION_ERROR 並帶 Oracle 錯誤碼，attempt 維持 1', async () => {
    const { client, sink, fetchMock } = buildClient();

    fetchMock.mockResolvedValue(xmlResponse(FAULT_RESPONSE_XML, 500));

    await expect(
      new FusionCustomerProfileService(client).getActiveCustomerProfile({ AccountNumber: 'X' }),
    ).rejects.toBeInstanceOf(FusionSoapFaultError);

    const entry = sink.entries[0]!;

    expect(entry.outcome).toBe(FusionApiOutcome.VALIDATION_ERROR);
    expect(entry.errorCode).toBe('FND:::FND_CMN_RCRD_MSNG');
    expect(entry.httpStatus).toBe(500);
    expect(entry.attempt).toBe(1);
  });
});

describe('FusionCustomerAccountService', () => {
  const ACCOUNT_SERVICE_NS = 'http://xmlns.oracle.com/apps/cdm/foundation/parties/customerAccountService/';

  const accountResponse = (values: string): string =>
    `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>` +
    `<ns0:findCustomerAccountResponse xmlns:ns0="${ACCOUNT_SERVICE_NS}applicationModule/types/">` +
    `<ns0:result xmlns:ns2="${ACCOUNT_SERVICE_NS}">${values}</ns0:result>` +
    `</ns0:findCustomerAccountResponse></env:Body></env:Envelope>`;

  it('單筆 Value 也正規化為陣列（XML 無單元素陣列概念）', async () => {
    const { client, fetchMock } = buildClient();

    fetchMock.mockResolvedValue(
      xmlResponse(accountResponse('<ns2:Value><ns2:CustomerAccountId>1</ns2:CustomerAccountId></ns2:Value>')),
    );

    const result = await new FusionCustomerAccountService(client).findCustomerAccount({ fetchSize: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]?.CustomerAccountId).toBe('1');
  });

  it('多筆 Value 全數回傳', async () => {
    const { client, fetchMock } = buildClient();

    fetchMock.mockResolvedValue(
      xmlResponse(
        accountResponse(
          '<ns2:Value><ns2:CustomerAccountId>1</ns2:CustomerAccountId></ns2:Value>' +
            '<ns2:Value><ns2:CustomerAccountId>2</ns2:CustomerAccountId></ns2:Value>',
        ),
      ),
    );

    const result = await new FusionCustomerAccountService(client).findCustomerAccount({ fetchSize: 2 });

    expect(result.map(account => account.CustomerAccountId)).toEqual(['1', '2']);
  });

  it('createCustomerAccount 使用 applicationModule 的 types namespace 與 SOAPAction', async () => {
    const { client, fetchMock } = buildClient();

    fetchMock.mockResolvedValue(
      xmlResponse(
        `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>` +
          `<ns0:createCustomerAccountResponse xmlns:ns0="${ACCOUNT_SERVICE_NS}applicationModule/types/">` +
          `<ns0:result xmlns:ns2="${ACCOUNT_SERVICE_NS}"><ns2:Value>` +
          `<ns2:CustomerAccountId>300000003304767</ns2:CustomerAccountId><ns2:AccountNumber>14</ns2:AccountNumber>` +
          `</ns2:Value></ns0:result></ns0:createCustomerAccountResponse></env:Body></env:Envelope>`,
      ),
    );

    const created = await new FusionCustomerAccountService(client).createCustomerAccount({
      PartyId: '300000003304761',
      AccountName: 'Test',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as string;
    const headers = init.headers as Record<string, string>;

    expect(headers['SOAPAction']).toBe(`${ACCOUNT_SERVICE_NS}applicationModule/createCustomerAccount`);
    expect(body).toContain(`xmlns:typ="${ACCOUNT_SERVICE_NS}applicationModule/types/"`);
    expect(body).toContain(`xmlns:svc="${ACCOUNT_SERVICE_NS}"`);
    expect(body).toContain('<svc:PartyId>300000003304761</svc:PartyId>');

    expect(created?.CustomerAccountId).toBe('300000003304767');
    expect(created?.AccountNumber).toBe('14');
  });

  /**
   * `getCustomerAccount` 的回應形狀與其他 operation 不同：result 直接就是帳戶物件，
   * 沒有 `Value` 包裝（XSD 上的型別是 `CustomerAccount` 而非 `CustomerAccountResult`）。
   * 這個不對稱是後續重構最容易改壞的地方。
   */
  it('getCustomerAccount 的 result 直接是帳戶物件，沒有 Value 包裝', async () => {
    const { client, fetchMock } = buildClient();

    fetchMock.mockResolvedValue(
      xmlResponse(
        `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>` +
          `<ns0:getCustomerAccountResponse xmlns:ns0="${ACCOUNT_SERVICE_NS}applicationModule/types/">` +
          `<ns0:result xmlns:ns2="${ACCOUNT_SERVICE_NS}">` +
          `<ns2:CustomerAccountId>300000003278047</ns2:CustomerAccountId>` +
          `<ns2:AccountNumber>4</ns2:AccountNumber>` +
          `<ns2:AccountName xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>` +
          `</ns0:result></ns0:getCustomerAccountResponse></env:Body></env:Envelope>`,
      ),
    );

    const account = await new FusionCustomerAccountService(client).getCustomerAccount('300000003278047');

    expect(account?.CustomerAccountId).toBe('300000003278047');
    expect(account?.AccountNumber).toBe('4');
    expect(account?.AccountName).toBeNull();
  });

  it('建立帳戶不自動重試（非冪等，重送會產生重複帳戶）', async () => {
    const { client, fetchMock } = buildClient();

    fetchMock.mockResolvedValue(xmlResponse('<html>gateway</html>', 503));

    await expect(
      new FusionCustomerAccountService(client).createCustomerAccount({ PartyId: '1' }),
    ).rejects.toBeInstanceOf(FusionTransientError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('唯讀查詢則允許重試', async () => {
    const { client, fetchMock } = buildClient();

    fetchMock
      .mockResolvedValueOnce(xmlResponse('<html>gateway</html>', 503))
      .mockResolvedValueOnce(
        xmlResponse(accountResponse('<ns2:Value><ns2:CustomerAccountId>1</ns2:CustomerAccountId></ns2:Value>')),
      );

    const result = await new FusionCustomerAccountService(client).findCustomerAccount({ fetchSize: 1 });

    expect(result).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
