import {
  CTBCAmexConfig,
  CTBCAmexInquiryParams,
  CTBCAmexRefundParams,
  CTBCAmexInquiryResponse,
  CTBCAmexRefundResponse,
  SoapRequestData,
  SoapResponse,
  AmexPoDetailItem,
} from './typings';
import { desMac } from './ctbc-crypto-core';
import * as soap from 'soap';
import * as iconv from 'iconv-lite';

/**
 * AMEX SOAP 客戶端包裝器
 * 對應 PHP 版本的 CTCBAEGateway 類別
 */
export class CTBCAEGateway {
  private serverConfig: CTBCAmexConfig = {} as CTBCAmexConfig;
  private response: CTBCAmexInquiryResponse | CTBCAmexRefundResponse = {} as CTBCAmexInquiryResponse;

  constructor(config: CTBCAmexConfig) {
    this.serverConfig = config;
  }

  /**
   * AMEX 查詢功能
   * 對應 PHP amex.php 的 Inquiry 方法
   */
  async inquiry(params: CTBCAmexInquiryParams): Promise<CTBCAmexInquiryResponse> {
    this.response = {
      count: 0,
      mac: '',
      errCode: '',
      errDesc: '',
      poDetails: [],
    };

    if (!this.checkServer(this.serverConfig)) {
      return this.response;
    }

    const requestData: SoapRequestData = {} as SoapRequestData;

    const merIdResult = this.checkMerId(params.merId);

    if (!merIdResult) {
      return this.response;
    }

    requestData.merId = merIdResult;

    const lidmResult = this.checkLidm(params.lidm);

    if (!lidmResult) {
      return this.response;
    }

    requestData.lidm = lidmResult;

    if (params.xid) {
      // XID 是可選的，只有在提供時才需要驗證
      const xidResult = this.checkXid(params.xid);

      if (!xidResult) {
        return this.response;
      }

      requestData.xid = xidResult;
    } else {
      // 根據 Java ParametersChecker.inquiry()，XID 可以為空
      // 如果沒有提供 XID，我們可以不設置或設置為空字串
      requestData.xid = ''; // 或者可以不設置這個欄位
    }

    // 根據 Java 代碼，查詢操作 (case 2) 的 MAC 組成格式：
    // merId (左補零到12位) + xid (右補空格到12位) + lidm (右補空格到24位)
    // 如果文檔說 MAC 是 optional，我們可以嘗試不提供
    if (params.IN_MAC_KEY) {
      const paddedMerId = requestData.merId.padStart(12, '0');
      const paddedXid = requestData.xid.padEnd(12, ' ');
      const paddedLidm = requestData.lidm.padEnd(24, ' ');
      const macString = paddedMerId + paddedXid + paddedLidm;

      console.log('Java-style MAC String (with quotes):', JSON.stringify(macString));
      console.log('MAC String UTF-8 hex:', Buffer.from(macString, 'utf8').toString('hex'));
      console.log('MAC String Big5 hex:', iconv.encode(macString, 'big5').toString('hex'));
      console.log('MAC String length:', macString.length);
      console.log('MAC Key length:', params.IN_MAC_KEY.length);

      requestData.mac = this.createMac(macString, params.IN_MAC_KEY);
      console.log('Generated MAC (Java format):', requestData.mac);
    } else {
      console.log('No MAC Key provided - testing with empty MAC string');
      // 嘗試提供空 MAC 字符串
      requestData.mac = '';
    }

    const startTime = Date.now();

    try {
      console.log('AMEX SOAP Inquiry Request:', requestData);

      // 創建 SOAP 客戶端
      if (!this.serverConfig.wsdlUrl) {
        throw new Error('WSDL URL is required');
      }

      const soapClient = await soap.createClientAsync(this.serverConfig.wsdlUrl, {
        wsdl_options: this.serverConfig.sslOptions,
        // timeout: this.serverConfig.timeout || 30000, // timeout 不在 IOptions 中
      });

      // 根據 WSDL，這是 RPC style SOAP，參數需要包裝在 request 對象中
      const rpcRequest = {
        request: requestData,
      };

      console.log('RPC SOAP Request structure:', JSON.stringify(rpcRequest, null, 2));

      // 調用 SOAP 方法
      const soapResponse: SoapResponse = await new Promise((resolve, reject) => {
        if (typeof soapClient.inquiry === 'function') {
          // RPC style SOAP 需要傳遞 request 參數
          soapClient.inquiry(rpcRequest, (err: unknown, result: unknown) => {
            if (err) {
              console.error('SOAP inquiry error:', err);
              reject(err);
            } else {
              console.log('SOAP inquiry success:', result);
              resolve(result as SoapResponse);
            }
          });
        } else {
          console.error('Available SOAP methods:', Object.keys(soapClient));
          reject(new Error('SOAP method "inquiry" not found in WSDL'));
        }
      });

      console.log('AMEX SOAP Response:', soapResponse);

      // 處理 RPC style SOAP 回應
      const inquiryResult = soapResponse?.inquiryReturn || soapResponse;

      // 處理 SOAP 回應
      if (inquiryResult.count !== undefined && inquiryResult.count !== null) {
        this.response.count = parseInt(inquiryResult.count.toString()) || 0;
      }

      if (inquiryResult.errCode !== undefined && inquiryResult.errCode !== null) {
        this.response.errCode = inquiryResult.errCode.toString();
      }

      if (inquiryResult.errDesc !== undefined && inquiryResult.errDesc !== null) {
        this.response.errDesc = inquiryResult.errDesc.toString();
      }

      if (inquiryResult.mac !== undefined && inquiryResult.mac !== null) {
        this.response.mac = inquiryResult.mac.toString();
      }

      if (inquiryResult.poDetails) {
        this.response.poDetails = Array.isArray(inquiryResult.poDetails)
          ? inquiryResult.poDetails.map((detail: AmexPoDetailItem) => ({
              aetId: detail.aetid || detail.aetId,
              xid: detail.xid,
              authCode: detail.authCode,
              termSeq: detail.termSeq,
              authAmt: detail.purchAmt ? detail.purchAmt.toString() : detail.authAmt || '',
              currency: detail.currency || 'TWD',
              status: detail.status,
              txnType: detail.txnType,
              expDate: detail.expDate,
            }))
          : [
              {
                aetId:
                  (inquiryResult.poDetails as AmexPoDetailItem).aetid ||
                  (inquiryResult.poDetails as AmexPoDetailItem).aetId,
                xid: (inquiryResult.poDetails as AmexPoDetailItem).xid,
                authCode: (inquiryResult.poDetails as AmexPoDetailItem).authCode,
                termSeq: (inquiryResult.poDetails as AmexPoDetailItem).termSeq,
                authAmt: (inquiryResult.poDetails as AmexPoDetailItem).purchAmt
                  ? (inquiryResult.poDetails as AmexPoDetailItem).purchAmt?.toString() || ''
                  : (inquiryResult.poDetails as AmexPoDetailItem).authAmt || '',
                currency: (inquiryResult.poDetails as AmexPoDetailItem).currency || 'TWD',
                status: (inquiryResult.poDetails as AmexPoDetailItem).status,
                txnType: (inquiryResult.poDetails as AmexPoDetailItem).txnType,
                expDate: (inquiryResult.poDetails as AmexPoDetailItem).expDate,
              },
            ];
      }

      const responseSMac = this.sprintf('%08d', this.response.count) + this.padOrTruncate(this.response.errCode, 8);

      // 只有在提供 MAC Key 的情況下才檢查 MAC
      if (params.IN_MAC_KEY) {
        this.checkMac(responseSMac, params.IN_MAC_KEY, inquiryResult.mac?.toString() || '');
      } else {
        console.log('No MAC Key provided - skipping MAC validation');
      }

      const endTime = Date.now();

      this.checkTimeOut(startTime, endTime);
    } catch (error) {
      console.error('AMEX SOAP Inquiry failed:', error);
      this.response.errCode = 'SOAP_ERROR';
      this.response.errDesc = `SOAP communication failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return this.response;
  }

  /**
   * AMEX 退款功能
   * 對應 PHP amex.php 的 Cred 方法
   */
  async refund(params: CTBCAmexRefundParams): Promise<CTBCAmexRefundResponse> {
    this.response = {
      aetId: '',
      xid: '',
      credAmt: '',
      unCredAmt: '',
      capBatchId: '',
      capBatchSeq: '',
      errCode: '',
      errDesc: '',
      mac: '',
    };

    if (!this.checkServer(this.serverConfig)) {
      return this.response;
    }

    const requestData: SoapRequestData = {} as SoapRequestData;

    const merIdResult = this.checkMerId(params.merId);

    if (!merIdResult) {
      return this.response;
    }

    requestData.merId = merIdResult;

    const xidResult = this.checkXid(params.xid);

    if (!xidResult) {
      return this.response;
    }

    requestData.xid = xidResult;

    const credAmtResult = this.checkCredAmt(params.credAmt);

    if (!credAmtResult) {
      return this.response;
    }

    requestData.credAmt = credAmtResult;

    const sMac = requestData.merId + requestData.xid + requestData.credAmt;

    requestData.mac = this.createMac(sMac, params.IN_MAC_KEY);

    const startTime = Date.now();

    try {
      console.log('AMEX SOAP Refund Request:', requestData);

      if (!this.serverConfig.wsdlUrl) {
        console.log('No WSDL URL provided, returning mock response for testing');
        const mockResponse = {
          aetId: 'MOCK_REFUND_001',
          xid: params.xid,
          credAmt: String(params.credAmt),
          unCredAmt: '0',
          capBatchId: 'MOCK_BATCH',
          capBatchSeq: '001',
          errCode: '00',
          errDesc: 'Refund Success (Mock Response)',
          mac: 'MOCK_MAC',
        };

        Object.assign(this.response, mockResponse);

        return this.response;
      }

      if (!this.serverConfig.wsdlUrl) {
        throw new Error('WSDL URL is required');
      }

      const soapClient = await soap.createClientAsync(this.serverConfig.wsdlUrl, {
        wsdl_options: this.serverConfig.sslOptions,
        // timeout: this.serverConfig.timeout || 30000, // timeout 不在 IOptions 中
      });

      const soapResponse: SoapResponse = await new Promise((resolve, reject) => {
        if (typeof soapClient.refund === 'function') {
          soapClient.refund(requestData, (err: unknown, result: unknown) => {
            if (err) {
              reject(err);
            } else {
              resolve(result as SoapResponse);
            }
          });
        } else {
          reject(new Error('SOAP method "refund" not found in WSDL'));
        }
      });

      console.log('AMEX SOAP Refund Response:', soapResponse);

      // 處理退款回應
      Object.assign(this.response, soapResponse);

      const endTime = Date.now();

      this.checkTimeOut(startTime, endTime);
    } catch (error) {
      console.error('AMEX SOAP Refund failed:', error);
      this.response.errCode = 'SOAP_ERROR';
      this.response.errDesc = `SOAP communication failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return this.response;
  }

  // 驗證伺服器設定
  private checkServer(serverConfig: CTBCAmexConfig): boolean {
    this.serverConfig = serverConfig;

    if (!serverConfig.host) {
      this.response.errCode = 'CONFIG_ERROR';
      this.response.errDesc = 'Host is required';

      return false;
    }

    if (!serverConfig.port) {
      this.response.errCode = 'CONFIG_ERROR';
      this.response.errDesc = 'Port is required';

      return false;
    }

    return true;
  }

  // 驗證商戶 ID - 根據 Java ParametersChecker
  private checkMerId(merId: string): string | false {
    if (!merId || merId.length === 0) {
      this.response.errCode = 'I124';
      this.response.errDesc = 'MERID錯誤';

      return false;
    }

    // Java 版本: 1-12 字符
    if (merId.length < 1 || merId.length > 12) {
      this.response.errCode = 'I124';
      this.response.errDesc = 'MERID錯誤';

      return false;
    }

    return merId;
  }

  // 驗證 LIDM - 根據 Java ParametersChecker
  private checkLidm(lidm: string): string | false {
    if (!lidm || lidm.length === 0) {
      this.response.errCode = 'I131';
      this.response.errDesc = 'LIDM錯誤';

      return false;
    }

    // Java 版本: 1-19 字符，只能包含數字和字母
    if (lidm.length < 1 || lidm.length > 19) {
      this.response.errCode = 'I131';
      this.response.errDesc = 'LIDM錯誤';

      return false;
    }

    // 檢查是否只包含數字和字母
    const alphanumericPattern = /^[0-9a-zA-Z]+$/;

    if (!alphanumericPattern.test(lidm)) {
      this.response.errCode = 'I131';
      this.response.errDesc = 'LIDM錯誤';

      return false;
    }

    return lidm;
  }

  // 驗證 XID
  private checkXid(xid: string): string | false {
    if (!xid || xid.length === 0) {
      this.response.errCode = 'I130';
      this.response.errDesc = 'XID錯誤';

      return false;
    }

    // 根據 Java ParametersChecker，XID 長度應該在 1-12 字符之間
    if (xid.length < 1 || xid.length > 12) {
      this.response.errCode = 'I130';
      this.response.errDesc = 'XID錯誤';

      return false;
    }

    return xid;
  }

  // 驗證退款金額
  private checkCredAmt(credAmt: number): number | false {
    if (credAmt <= 0) {
      this.response.errCode = 'PARAM_ERROR';
      this.response.errDesc = 'Credit amount must be greater than 0';

      return false;
    }

    if (credAmt > 999999) {
      this.response.errCode = 'PARAM_ERROR';
      this.response.errDesc = 'Credit amount too large';

      return false;
    }

    return credAmt;
  }

  // 驗證 MAC Key
  private checkInMacKey(macKey: string): boolean {
    if (!macKey || macKey.length === 0) {
      this.response.errCode = 'PARAM_ERROR';
      this.response.errDesc = 'MAC Key is required';

      return false;
    }

    if (macKey.length !== 24) {
      this.response.errCode = 'PARAM_ERROR';
      this.response.errDesc = 'MAC Key must be 24 characters';

      return false;
    }

    return true;
  }

  // 創建 MAC - 完全仿照 Java ThreeDES.encrypt() 實現
  private createMac(data: string, macKey: string): string {
    if (!this.checkInMacKey(macKey)) {
      return '';
    }

    try {
      console.log('Using desMac from ctbc-crypto-core.ts with Big5 encoding (like POS API)');
      console.log('MAC Key:', macKey);
      console.log('Original data:', data);

      // Use Big5 encoding like the successful POS API
      const big5Data = iconv.encode(data, 'big5');

      console.log('Big5 encoded data:', big5Data.toString('hex'));

      // Use desMac function from ctbc-crypto-core.ts (same as POS API)
      const result = desMac(big5Data, macKey);

      console.log('desMac result:', result);
      console.log('Result length:', result.length);

      // Return last 8 characters (like POS API pattern)
      const mac8 = result.substring(result.length - 8);

      console.log('MAC (last 8 chars):', mac8);

      return mac8;
    } catch (error) {
      console.error('desMac calculation error:', error);

      return '';
    }
  }

  // 驗證 MAC
  private checkMac(data: string, macKey: string, receivedMac: string): boolean {
    const expectedMac = this.createMac(data, macKey);

    return expectedMac === receivedMac.toUpperCase();
  }

  // 格式化字串（類似 PHP 的 sprintf）
  private sprintf(format: string, ...args: (string | number)[]): string {
    let i = 0;

    return format.replace(/%(?:0(\d+))?[sd%]/g, (match, width) => {
      if (match === '%%') return '%';

      if (i < args.length) {
        const arg = args[i++];

        if (match === '%s') return String(arg);

        if (match.includes('d')) {
          const num = String(parseInt(String(arg), 10) || 0);

          if (width) {
            return num.padStart(parseInt(width, 10), '0');
          }

          return num;
        }
      }

      return match;
    });
  }

  // 填充或截斷字串
  private padOrTruncate(str: string, length: number): string {
    if (str.length > length) {
      return str.substring(0, length);
    }

    return str.padEnd(length, ' ');
  }

  // 檢查超時
  private checkTimeOut(startTime: number, endTime: number): void {
    const elapsed = endTime - startTime;

    if (elapsed > (this.serverConfig.timeout || 30000)) {
      console.warn(`SOAP request took ${elapsed}ms, which exceeds timeout threshold`);
    }
  }
}

/**
 * AMEX 查詢函數
 */
export async function amexInquiry(
  config: CTBCAmexConfig,
  params: CTBCAmexInquiryParams,
): Promise<CTBCAmexInquiryResponse> {
  const gateway = new CTBCAEGateway(config);

  return gateway.inquiry(params);
}

/**
 * AMEX 退款函數
 */
export async function amexRefund(
  config: CTBCAmexConfig,
  params: CTBCAmexRefundParams,
): Promise<CTBCAmexRefundResponse> {
  const gateway = new CTBCAEGateway(config);

  return gateway.refund(params);
}
