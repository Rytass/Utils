import {
  CTBCAmexConfig,
  CTBCAmexInquiryParams,
  CTBCAmexRefundParams,
  CTBCAmexCancelRefundParams,
  CTBCAmexAuthRevParams,
  CTBCAmexCapRevParams,
  CTBCPosApiResponse,
  SoapRequestData,
  SoapResponse,
  AmexPoDetailItem,
  SoapInquiryResult,
  CTBCAmexRefundResponse,
} from './typings';
import { desEcbEncryptHex } from './ctbc-crypto-core';
import * as soap from 'soap';

/**
 * AMEX SOAP 客戶端包裝器
 * 對應 PHP 版本的 CTCBAEGateway 類別
 */
type SoapClient = Record<string, (args: unknown, cb: (err: unknown, result: unknown) => void) => void>;

type AmexResponse = {
  errCode?: string;
  errDesc?: string;
  mac?: string;
  // Inquiry
  count?: number;
  poDetails?: AmexPoDetailItem[];
  // Refund / Capture / Cancel
  aetId?: string;
  aetid?: string;
  xid?: string;
  credAmt?: string;
  unCredAmt?: string;
  capBatchId?: string;
  capBatchSeq?: string;
  capAmt?: string;
  unCapAmt?: string;
  termSeq?: string;
} & Record<string, unknown>;

export class CTBCAEGateway {
  private serverConfig: CTBCAmexConfig = {} as CTBCAmexConfig;
  private response: AmexResponse = {};

  constructor(config: CTBCAmexConfig) {
    this.serverConfig = config;
  }

  /**
   * AMEX 查詢功能
   * 對應 PHP amex.php 的 Inquiry 方法
   */
  async inquiry(params: CTBCAmexInquiryParams): Promise<CTBCPosApiResponse> {
    this.response = {
      count: 0,
      mac: '',
      errCode: '',
      errDesc: '',
      poDetails: [],
    };

    if (!this.checkServer(this.serverConfig)) {
      return this.toPosInquiryResponse(this.response);
    }

    const requestData: SoapRequestData = {} as SoapRequestData;

    const merIdResult = this.checkMerId(params.merId);

    if (!merIdResult) {
      return this.toPosInquiryResponse(this.response);
    }

    requestData.merId = merIdResult;

    const lidmResult = this.checkLidm(params.lidm);

    if (!lidmResult) {
      return this.toPosInquiryResponse(this.response);
    }

    requestData.lidm = lidmResult;

    if (params.xid) {
      // XID 是可選的，只有在提供時才需要驗證
      const xidResult = this.checkXid(params.xid);

      if (!xidResult) {
        return this.toPosInquiryResponse(this.response);
      }

      requestData.xid = xidResult;
    } else {
      // 根據 Java ParametersChecker.inquiry()，XID 可以為空
      // 如果沒有提供 XID，我們可以不設置或設置為空字串
      requestData.xid = ''; // 或者可以不設置這個欄位
    }

    // 查詢 MAC：merId(12,左補0) + lidm(20,右補空白)
    {
      const macString = requestData.merId.padStart(12, '0') + requestData.lidm.padEnd(20, ' ');

      requestData.mac = params.IN_MAC_KEY ? this.createMac(macString, params.IN_MAC_KEY) : '';
    }

    const startTime = Date.now();

    try {
      console.log('AMEX SOAP Inquiry Request:', requestData);

      // 組合 WSDL URL（優先使用 wsdlUrl；否則依 host/port 組合，對齊 PHP）
      const wsdlUrl =
        this.serverConfig.wsdlUrl ||
        (this.serverConfig.port
          ? `http://${this.serverConfig.host}:${this.serverConfig.port}/HubAgentConsole/services/AEPaymentSoap?wsdl`
          : `https://${this.serverConfig.host}/HubAgentConsole/services/AEPaymentSoap?wsdl`);

      const soapClient = await soap.createClientAsync(wsdlUrl, {
        wsdl_options: this.serverConfig.sslOptions,
      });

      const client = soapClient as SoapClient;

      // 根據 WSDL，這是 RPC style SOAP，參數需要包裝在 request 對象中
      const rpcRequest: { request: SoapRequestData } = { request: requestData };

      console.log('RPC SOAP Request structure:', JSON.stringify(rpcRequest, null, 2));

      // 調用 SOAP 方法
      const soapResponse: SoapResponse = await new Promise<SoapResponse>((resolve, reject) => {
        const call = (name: string, payload: unknown): void =>
          client[name](payload, (err: unknown, result: unknown) =>
            err ? reject(err) : resolve(result as SoapResponse),
          );

        if (typeof client['Inquiry'] === 'function') {
          call('Inquiry', rpcRequest);
        } else if (typeof client['inquiry'] === 'function') {
          call('inquiry', rpcRequest);
        } else {
          console.error('Available SOAP methods:', Object.keys(client));
          reject(new Error('SOAP method "Inquiry" not found in WSDL'));
        }
      });

      console.log('AMEX SOAP Response:', soapResponse);

      // 處理 RPC style SOAP 回應
      const inquiryResult = (soapResponse.inquiryReturn ?? soapResponse) as SoapInquiryResult | SoapResponse;

      // 處理 SOAP 回應
      if (
        (inquiryResult as SoapInquiryResult).count !== undefined &&
        (inquiryResult as SoapInquiryResult).count !== null
      ) {
        const c = (inquiryResult as SoapInquiryResult).count;

        this.response.count = typeof c === 'number' ? c : 0;
      }

      if (
        (inquiryResult as SoapInquiryResult).errCode !== undefined &&
        (inquiryResult as SoapInquiryResult).errCode !== null
      ) {
        this.response.errCode = String((inquiryResult as SoapInquiryResult).errCode);
      }

      if (
        (inquiryResult as SoapInquiryResult).errDesc !== undefined &&
        (inquiryResult as SoapInquiryResult).errDesc !== null
      ) {
        this.response.errDesc = String((inquiryResult as SoapInquiryResult).errDesc);
      }

      // mac 於下方檢核後以 'Y'/'F'/'N' 形式寫入

      const pd = (inquiryResult as SoapInquiryResult).poDetails;

      if (pd) {
        this.response.poDetails = Array.isArray(pd)
          ? pd.map(detail => ({
              aetId: (detail as AmexPoDetailItem).aetid || (detail as AmexPoDetailItem).aetId,
              authCode: (detail as AmexPoDetailItem).authCode,
              termSeq: (detail as AmexPoDetailItem).termSeq,
              authAmt: (detail as AmexPoDetailItem).purchAmt
                ? String((detail as AmexPoDetailItem).purchAmt)
                : (detail as AmexPoDetailItem).authAmt || '',
              currency: (detail as AmexPoDetailItem).currency || 'TWD',
              status: (detail as AmexPoDetailItem).status,
              txnType: (detail as AmexPoDetailItem).txnType,
              expDate: (detail as AmexPoDetailItem).expDate,
              pan: (detail as AmexPoDetailItem).pan,
              xid: (detail as AmexPoDetailItem).xid,
              lidm: (detail as AmexPoDetailItem).lidm,
            }))
          : [
              {
                aetId: (pd as AmexPoDetailItem).aetid || (pd as AmexPoDetailItem).aetId,
                authCode: (pd as AmexPoDetailItem).authCode,
                termSeq: (pd as AmexPoDetailItem).termSeq,
                authAmt: (pd as AmexPoDetailItem).purchAmt
                  ? String((pd as AmexPoDetailItem).purchAmt)
                  : (pd as AmexPoDetailItem).authAmt || '',
                currency: (pd as AmexPoDetailItem).currency || 'TWD',
                status: (pd as AmexPoDetailItem).status,
                txnType: (pd as AmexPoDetailItem).txnType,
                expDate: (pd as AmexPoDetailItem).expDate,
                pan: (pd as AmexPoDetailItem).pan,
                xid: (pd as AmexPoDetailItem).xid,
                lidm: (pd as AmexPoDetailItem).lidm,
              },
            ];
      }

      const responseSMac =
        this.sprintf('%08d', this.response.count ?? 0) + this.padOrTruncate(this.response.errCode || '', 8);

      const recvMac = inquiryResult?.mac?.toString() || '';

      this.checkMac(responseSMac, params.IN_MAC_KEY || '', recvMac);

      const endTime = Date.now();

      this.checkTimeOut(startTime, endTime);
    } catch (error) {
      console.error('AMEX SOAP Inquiry failed:', error);
      this.response.errCode = 'SOAP_ERROR';
      this.response.errDesc = `SOAP communication failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return this.toPosInquiryResponse(this.response);
  }

  /**
   * AMEX 退款功能
   * 對應 PHP amex.php 的 Cred 方法
   */
  async refund(params: CTBCAmexRefundParams): Promise<CTBCPosApiResponse> {
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
      return this.toPosRefundResponse(this.response);
    }

    const requestData: SoapRequestData = {} as SoapRequestData;

    const merIdResult = this.checkMerId(params.merId);

    if (!merIdResult) {
      return this.toPosRefundResponse(this.response);
    }

    requestData.merId = merIdResult;

    const xidResult = this.checkXid(params.xid);

    if (!xidResult) {
      return this.toPosRefundResponse(this.response);
    }

    requestData.xid = xidResult;

    const purchAmtResult = this.checkCredAmt(params.purchAmt);

    if (!purchAmtResult) {
      return this.toPosRefundResponse(this.response);
    }

    requestData.credAmt = purchAmtResult;

    // 退款 MAC：merId(12,左補0) + credAmt(12,左補0) + xid(12,右補空白) + lidm(20,右補空白)

    const lidmResult = this.checkLidm(params.lidm);

    if (!lidmResult) {
      return this.toPosRefundResponse(this.response);
    }

    requestData.lidm = lidmResult;

    const sMac =
      requestData.merId.padStart(12, '0') +
      String(requestData.credAmt).padStart(12, '0') +
      requestData.xid.padEnd(12, ' ') +
      requestData.lidm.padEnd(20, ' ');

    // 按 PHP 規格只送 mac，不送 IN_MAC_KEY
    requestData.mac = this.createMac(sMac, params.IN_MAC_KEY);

    const startTime = Date.now();

    try {
      console.log('AMEX SOAP Refund Request:', requestData);

      const wsdlUrl =
        this.serverConfig.wsdlUrl ||
        (this.serverConfig.port
          ? `http://${this.serverConfig.host}:${this.serverConfig.port}/HubAgentConsole/services/AEPaymentSoap?wsdl`
          : `https://${this.serverConfig.host}/HubAgentConsole/services/AEPaymentSoap?wsdl`);

      const soapClient = await soap.createClientAsync(wsdlUrl, {
        wsdl_options: this.serverConfig.sslOptions,
      });

      const client = soapClient as SoapClient;

      const soapResponse: SoapResponse = await new Promise<SoapResponse>((resolve, reject) => {
        const call = (name: string, payload: unknown): void =>
          client[name](payload, (err: unknown, result: unknown) =>
            err ? reject(err) : resolve(result as SoapResponse),
          );

        if (typeof client['Cred'] === 'function') {
          call('Cred', { request: requestData });
        } else if (typeof client['cred'] === 'function') {
          call('cred', { request: requestData });
        } else if (typeof client['refund'] === 'function') {
          call('refund', requestData);
        } else {
          reject(new Error('SOAP method "Cred"/"refund" not found in WSDL'));
        }
      });

      console.log('AMEX SOAP Refund Response:', soapResponse);

      // 處理退款回應（不同實作大小寫可能不同）
      const respObj = soapResponse as unknown as Record<string, unknown>;
      const refundResult = (respObj['CredReturn'] ??
        respObj['credReturn'] ??
        respObj['refundReturn'] ??
        soapResponse) as Partial<CTBCAmexRefundResponse> | Record<string, unknown>;

      Object.assign(this.response, refundResult as Record<string, unknown>);

      // 檢核回應 MAC：aetId(16,右補空白) + xid(16,右補空白) + errCode(8,右補空白) + credAmt(16,左補0)
      const responseSMac =
        this.padOrTruncate(this.response.aetId || '', 16) +
        this.padOrTruncate(this.response.xid || '', 16) +
        this.padOrTruncate(this.response.errCode || '', 8) +
        this.sprintf('%016d', parseInt(this.response.credAmt || '0', 10));

      const recvMac = String((refundResult as Record<string, unknown>)?.['mac'] ?? '');

      this.checkMac(responseSMac, params.IN_MAC_KEY || '', recvMac);

      const endTime = Date.now();

      this.checkTimeOut(startTime, endTime);
    } catch (error) {
      console.error('AMEX SOAP Refund failed:', error);
      this.response.errCode = 'SOAP_ERROR';
      this.response.errDesc = `SOAP communication failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return this.toPosRefundResponse(this.response);
  }

  /**
   * AMEX 授權取消 (AuthRev)
   */
  async authRev(params: CTBCAmexAuthRevParams): Promise<CTBCPosApiResponse> {
    this.response = {
      aetId: '',
      xid: '',
      termSeq: '',
      errCode: '',
      errDesc: '',
      mac: '',
    };

    if (!this.checkServer(this.serverConfig)) {
      return this.toPosCancelRefundResponse(this.response);
    }

    const requestData: SoapRequestData = {} as SoapRequestData;

    const merIdResult = this.checkMerId(params.merId);

    if (!merIdResult) return this.toPosCancelRefundResponse(this.response);
    requestData.merId = merIdResult;

    const xidResult = this.checkXid(params.xid);

    if (!xidResult) return this.toPosCancelRefundResponse(this.response);
    requestData.xid = xidResult;

    const lidmResult = this.checkLidm(params.lidm);

    if (!lidmResult) return this.toPosCancelRefundResponse(this.response);
    requestData.lidm = lidmResult;

    // sMac: merId(12,0) + xid(12,' ') + lidm(24,' ')
    const sMac =
      requestData.merId.padStart(12, '0') + requestData.xid.padEnd(12, ' ') + this.padOrTruncate(requestData.lidm, 24);

    requestData.mac = this.createMac(sMac, params.IN_MAC_KEY);

    const startTime = Date.now();

    console.log('AMEX SOAP AuthRev Request:', requestData);

    try {
      const wsdlUrl =
        this.serverConfig.wsdlUrl ||
        (this.serverConfig.port
          ? `http://${this.serverConfig.host}:${this.serverConfig.port}/HubAgentConsole/services/AEPaymentSoap?wsdl`
          : `https://${this.serverConfig.host}/HubAgentConsole/services/AEPaymentSoap?wsdl`);

      const soapClient = await soap.createClientAsync(wsdlUrl, {
        wsdl_options: this.serverConfig.sslOptions,
      });

      const client = soapClient as SoapClient;
      const soapResponse: SoapResponse = await new Promise<SoapResponse>((resolve, reject) => {
        const call = (name: string, payload: unknown): void =>
          client[name](payload, (err: unknown, result: unknown) =>
            err ? reject(err) : resolve(result as SoapResponse),
          );

        if (typeof client['authRev'] === 'function') {
          call('authRev', { request: requestData });
        } else if (typeof client['AuthRev'] === 'function') {
          call('AuthRev', { request: requestData });
        } else {
          reject(new Error('SOAP method "AuthRev" not found in WSDL'));
        }
      });

      const revObj = soapResponse as Record<string, unknown>;
      const revResult = (revObj['authRevReturn'] ?? revObj['AuthRevReturn'] ?? soapResponse) as Record<string, unknown>;

      Object.assign(this.response, revResult);

      // Response sMac: aetId(16) + xid(16) + errCode(8)
      const responseSMac =
        this.padOrTruncate(this.response.aetId || '', 16) +
        this.padOrTruncate(this.response.xid || '', 16) +
        this.padOrTruncate(this.response.errCode || '', 8);

      const recvMac = String((revResult as Record<string, unknown>)?.['mac'] ?? '');

      this.checkMac(responseSMac, params.IN_MAC_KEY || '', recvMac);

      const endTime = Date.now();

      this.checkTimeOut(startTime, endTime);
    } catch (error) {
      console.error('AMEX SOAP AuthRev failed:', error);
      this.response.errCode = 'SOAP_ERROR';
      this.response.errDesc = `SOAP communication failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return this.toPosCancelRefundResponse(this.response);
  }

  /**
   * AMEX 請款取消 (CapRev)
   */
  async capRev(params: CTBCAmexCapRevParams): Promise<CTBCPosApiResponse> {
    this.response = {
      aetId: '',
      xid: '',
      errCode: '',
      errDesc: '',
      mac: '',
    };

    if (!this.checkServer(this.serverConfig)) {
      return this.toPosCancelRefundResponse(this.response);
    }

    const requestData: SoapRequestData = {} as SoapRequestData;

    const merIdResult = this.checkMerId(params.merId);

    if (!merIdResult) return this.toPosCancelRefundResponse(this.response);
    requestData.merId = merIdResult;

    const xidResult = this.checkXid(params.xid);

    if (!xidResult) return this.toPosCancelRefundResponse(this.response);
    requestData.xid = xidResult;

    const lidmResult = this.checkLidm(params.lidm);

    if (!lidmResult) return this.toPosCancelRefundResponse(this.response);
    requestData.lidm = lidmResult;

    // sMac: merId(12,0) + xid(12,' ') + lidm(24,' ')
    const sMac =
      requestData.merId.padStart(12, '0') + requestData.xid.padEnd(12, ' ') + this.padOrTruncate(requestData.lidm, 24);

    requestData.mac = this.createMac(sMac, params.IN_MAC_KEY);

    const startTime = Date.now();

    try {
      const wsdlUrl =
        this.serverConfig.wsdlUrl ||
        (this.serverConfig.port
          ? `http://${this.serverConfig.host}:${this.serverConfig.port}/HubAgentConsole/services/AEPaymentSoap?wsdl`
          : `https://${this.serverConfig.host}/HubAgentConsole/services/AEPaymentSoap?wsdl`);

      const soapClient = await soap.createClientAsync(wsdlUrl, {
        wsdl_options: this.serverConfig.sslOptions,
      });

      const client = soapClient as SoapClient;
      const soapResponse: SoapResponse = await new Promise<SoapResponse>((resolve, reject) => {
        const call = (name: string, payload: unknown): void =>
          client[name](payload, (err: unknown, result: unknown) =>
            err ? reject(err) : resolve(result as SoapResponse),
          );

        if (typeof client['CapRev'] === 'function') {
          call('CapRev', { request: requestData });
        } else if (typeof client['capRev'] === 'function') {
          call('capRev', { request: requestData });
        } else {
          reject(new Error('SOAP method "CapRev" not found in WSDL'));
        }
      });

      const revRaw = soapResponse as unknown as Record<string, unknown>;
      const revResult = (revRaw['CapRevReturn'] ?? revRaw['capRevReturn'] ?? soapResponse) as Record<string, unknown>;

      Object.assign(this.response, revResult);

      // Response sMac: aetId(16) + xid(16) + errCode(8)
      const responseSMac =
        this.padOrTruncate(this.response.aetId || '', 16) +
        this.padOrTruncate(this.response.xid || '', 16) +
        this.padOrTruncate(this.response.errCode || '', 8);

      const recvMac = String((revResult as Record<string, unknown>)?.['mac'] ?? '');

      this.checkMac(responseSMac, params.IN_MAC_KEY || '', recvMac);

      const endTime = Date.now();

      this.checkTimeOut(startTime, endTime);
    } catch (error) {
      console.error('AMEX SOAP CapRev failed:', error);
      this.response.errCode = 'SOAP_ERROR';
      this.response.errDesc = `SOAP communication failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return this.toPosCancelRefundResponse(this.response);
  }

  /**
   * AMEX 取消退款 (CredRev)
   */
  async cancelRefund(params: CTBCAmexCancelRefundParams): Promise<CTBCPosApiResponse> {
    this.response = {
      aetId: '',
      xid: '',
      errCode: '',
      errDesc: '',
      mac: '',
    };

    if (!this.checkServer(this.serverConfig)) {
      return this.toPosCancelRefundResponse(this.response);
    }

    const requestData: SoapRequestData = {} as SoapRequestData;

    const merIdResult = this.checkMerId(params.merId);

    if (!merIdResult) return this.toPosCancelRefundResponse(this.response);
    requestData.merId = merIdResult;

    const xidResult = this.checkXid(params.xid);

    if (!xidResult) return this.toPosCancelRefundResponse(this.response);
    requestData.xid = xidResult;

    const lidmResult = this.checkLidm(params.lidm);

    if (!lidmResult) return this.toPosCancelRefundResponse(this.response);
    requestData.lidm = lidmResult;

    const capBatchIdResult = this.checkCapBatchId(params.capBatchId);

    if (!capBatchIdResult) return this.toPosCancelRefundResponse(this.response);
    requestData.capBatchId = capBatchIdResult;

    const capBatchSeqResult = this.checkCapBatchSeq(params.capBatchSeq);

    if (!capBatchSeqResult) return this.toPosCancelRefundResponse(this.response);
    requestData.capBatchSeq = capBatchSeqResult;

    // sMac: merId(12,0) + capBatchSeq(12,space) + xid(12,space) + lidm(20,space)
    const sMac =
      requestData.merId.padStart(12, '0') +
      requestData.capBatchSeq.padEnd(12, ' ') +
      requestData.xid.padEnd(12, ' ') +
      requestData.lidm.padEnd(20, ' ');

    requestData.mac = this.createMac(sMac, params.IN_MAC_KEY);

    const startTime = Date.now();

    try {
      const wsdlUrl =
        this.serverConfig.wsdlUrl ||
        (this.serverConfig.port
          ? `http://${this.serverConfig.host}:${this.serverConfig.port}/HubAgentConsole/services/AEPaymentSoap?wsdl`
          : `https://${this.serverConfig.host}/HubAgentConsole/services/AEPaymentSoap?wsdl`);

      const soapClient = await soap.createClientAsync(wsdlUrl, {
        wsdl_options: this.serverConfig.sslOptions,
      });

      const client = soapClient as SoapClient;
      const soapResponse: SoapResponse = await new Promise<SoapResponse>((resolve, reject) => {
        const call = (name: string, payload: unknown): void =>
          client[name](payload, (err: unknown, result: unknown) =>
            err ? reject(err) : resolve(result as SoapResponse),
          );

        if (typeof client['CredRev'] === 'function') {
          call('CredRev', { request: requestData });
        } else if (typeof client['credRev'] === 'function') {
          call('credRev', { request: requestData });
        } else {
          reject(new Error('SOAP method "CredRev" not found in WSDL'));
        }
      });

      const resultObj = soapResponse as Record<string, unknown>;
      const result = (resultObj['CredRevReturn'] ?? soapResponse) as Record<string, unknown>;

      Object.assign(this.response, result);

      // Response MAC: aetId(16,space) + xid(16,space) + errCode(8,space)
      const responseSMac =
        this.padOrTruncate(this.response.aetId || '', 16) +
        this.padOrTruncate(this.response.xid || '', 16) +
        this.padOrTruncate(this.response.errCode || '', 8);

      const recvMac = String((result as Record<string, unknown>)?.['mac'] ?? '');

      this.checkMac(responseSMac, params.IN_MAC_KEY || '', recvMac);

      const endTime = Date.now();

      this.checkTimeOut(startTime, endTime);
    } catch (error) {
      console.error('AMEX SOAP Cancel Refund failed:', error);
      this.response.errCode = 'SOAP_ERROR';
      this.response.errDesc = `SOAP communication failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return this.toPosCancelRefundResponse(this.response);
  }

  // 驗證伺服器設定
  private checkServer(serverConfig: CTBCAmexConfig): boolean {
    this.serverConfig = serverConfig;

    // 允許直接提供 wsdlUrl，或提供 host/port 後由外層組合 wsdlUrl
    if (!serverConfig.wsdlUrl) {
      if (!serverConfig.host || !serverConfig.port) {
        this.response.errCode = 'CONFIG_ERROR';
        this.response.errDesc = 'WSDL URL or (host+port) is required';

        return false;
      }
      // 若無 wsdlUrl，預期呼叫端已依 host/port 構造 SOAP endpoint；保留相容，僅通過檢核
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

  private checkCapBatchId(capBatchId: string): string | false {
    const id = (capBatchId || '').trim();

    if (id && id.length === 8) return id;
    this.response.errCode = 'I134';
    this.response.errDesc = 'capBatchId參數錯誤';

    return false;
  }

  private checkCapBatchSeq(capBatchSeq: string): string | false {
    const seq = (capBatchSeq || '').trim();

    if (seq && seq.length === 12) return seq;
    this.response.errCode = 'I135';
    this.response.errDesc = 'capBatchSeq參數錯誤';

    return false;
  }

  // ——— POS-like response mappers ———
  private mapErrCodeToPos(code?: string): string | undefined {
    if (!code) return code;

    // AMEX success A000 => POS success 00
    return code === 'A000' ? '00' : code;
  }

  private toPosInquiryResponse(amex: AmexResponse): CTBCPosApiResponse {
    const detail = Array.isArray(amex.poDetails) ? amex.poDetails[0] : amex.poDetails?.[0];
    const ErrCode = this.mapErrCodeToPos(amex.errCode) || '';

    const resp: CTBCPosApiResponse = {
      RespCode: ErrCode === '00' ? '0' : '1',
      ErrCode,
      ERRDESC: amex.errDesc,
      XID: detail?.xid,
      AuthCode: detail?.authCode,
      AuthAmt: detail?.purchAmt ? String(detail.purchAmt) : detail?.authAmt,
      PAN: detail?.pan,
      ECI: undefined,
      QueryCode: amex.count && amex.count > 0 ? '1' : '0',
      currency: detail?.currency,
      // 方便上層判斷 AE 狀態
      txnType: detail?.txnType,
      status: detail?.status,
      CurrentState: '',
      capBatchId: amex.capBatchId,
      capBatchSeq: amex.capBatchSeq,
      aetId: detail?.aetId,
    };

    return resp;
  }

  private toPosRefundResponse(amex: AmexResponse): CTBCPosApiResponse {
    const ErrCode = this.mapErrCodeToPos(amex.errCode) || '';
    const resp: CTBCPosApiResponse = {
      RespCode: ErrCode === '00' ? '0' : '1',
      ErrCode,
      ERRDESC: amex.errDesc,
      XID: amex.xid,
      RefAmt: amex.credAmt ? `901 ${amex.credAmt} 0` : undefined,
      RetrRef: amex.capBatchId,
      ResAmt: amex.unCredAmt,
      capBatchId: amex.capBatchId,
      capBatchSeq: amex.capBatchSeq,
      CurrentState: '',
    };

    return resp;
  }

  private toPosCancelRefundResponse(amex: AmexResponse): CTBCPosApiResponse {
    const ErrCode = this.mapErrCodeToPos(amex.errCode) || '';
    const resp: CTBCPosApiResponse = {
      RespCode: ErrCode === '00' ? '0' : '1',
      ErrCode,
      ERRDESC: amex.errDesc,
      CurrentState: '',
      XID: amex.xid,
    };

    return resp;
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

  // 驗證 MAC Key（允許 0/8/24；0 表示不送 mac）
  private checkInMacKey(macKey: string): boolean {
    if (macKey.length === 0) return false;

    if (macKey.length === 8) return true;

    if (macKey.length === 24) return true;
    this.response.errCode = 'PARAM_ERROR';
    this.response.errDesc = 'MAC Key length must be 0, 8 or 24 characters';

    return false;
  }

  // 創建 MAC - 3DES/ECB，滿 8 bytes 不補，否則補 PKCS#5
  private createMac(data: string, macKey: string): string {
    if (!this.checkInMacKey(macKey)) return '';

    try {
      return desEcbEncryptHex(data, macKey);
    } catch (_err) {
      return '';
    }
  }

  // 驗證 MAC，並將結果記錄到 this.response.mac（Y/F/N）
  private checkMac(data: string, macKey: string, receivedMac: string): boolean {
    if (!macKey) {
      this.response.mac = 'N';

      return false;
    }

    if (!receivedMac) {
      this.response.mac = 'F';

      return false;
    }

    const expectedMac = this.createMac(data, macKey);
    const ok = expectedMac === receivedMac.toUpperCase();

    this.response.mac = ok ? 'Y' : 'F';

    return ok;
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
export async function amexInquiry(config: CTBCAmexConfig, params: CTBCAmexInquiryParams): Promise<CTBCPosApiResponse> {
  const gateway = new CTBCAEGateway(config);

  return gateway.inquiry(params);
}

/**
 * AMEX 退款函數
 */
export async function amexRefund(config: CTBCAmexConfig, params: CTBCAmexRefundParams): Promise<CTBCPosApiResponse> {
  const gateway = new CTBCAEGateway(config);

  return gateway.refund(params);
}

/**
 * AMEX 取消退款函數 (CredRev)
 */
export async function amexCancelRefund(
  config: CTBCAmexConfig,
  params: CTBCAmexCancelRefundParams,
): Promise<CTBCPosApiResponse> {
  const gateway = new CTBCAEGateway(config);

  return gateway.cancelRefund(params);
}

/**
 * AMEX 授權取消 (AuthRev)
 */
export async function amexAuthRev(config: CTBCAmexConfig, params: CTBCAmexAuthRevParams): Promise<CTBCPosApiResponse> {
  const gateway = new CTBCAEGateway(config);

  return gateway.authRev(params);
}

/**
 * AMEX 請款取消 (CapRev)
 */
export async function amexCapRev(config: CTBCAmexConfig, params: CTBCAmexCapRevParams): Promise<CTBCPosApiResponse> {
  const gateway = new CTBCAEGateway(config);

  return gateway.capRev(params);
}

export type AmexAction = 'AuthRev' | 'CapRev' | 'Refund' | 'None';

export function getAmexNextActionFromInquiry(inquiryResp: CTBCPosApiResponse): AmexAction {
  const obj = inquiryResp as unknown as Record<string, unknown>;
  const txnType = obj['txnType'] as string | undefined;
  const statusCode = obj['status'] as string | undefined;

  if (txnType === 'AU') {
    if (statusCode && statusCode === 'AP') return 'AuthRev';

    if (statusCode && statusCode === 'B1') return 'CapRev';

    if (statusCode && statusCode === 'B5') return 'Refund';

    return 'None';
  }

  // Default to do nothing
  return 'None';
}

export async function amexSmartCancelOrRefund(
  config: CTBCAmexConfig,
  params: CTBCAmexRefundParams,
): Promise<{ action: AmexAction; response: CTBCPosApiResponse; inquiry: CTBCPosApiResponse }> {
  const inquiry = await amexInquiry(config, {
    merId: params.merId,
    lidm: params.lidm,
    xid: params.xid,
    IN_MAC_KEY: params.IN_MAC_KEY,
  });

  const action = getAmexNextActionFromInquiry(inquiry);

  console.log('Determined AMEX action:', action);
  let response: CTBCPosApiResponse;

  if (action === 'AuthRev') {
    response = await amexAuthRev(config, {
      merId: params.merId,
      xid: params.xid,
      lidm: params.lidm,
      purchAmt: params.purchAmt,
      orgAmt: params.orgAmt,
      IN_MAC_KEY: params.IN_MAC_KEY,
    });
  } else if (action === 'CapRev') {
    response = await amexCapRev(config, {
      merId: params.merId,
      xid: params.xid,
      lidm: params.lidm,
      purchAmt: params.purchAmt,
      orgAmt: params.orgAmt,
      IN_MAC_KEY: params.IN_MAC_KEY,
    });
  } else if (action === 'Refund') {
    response = await amexRefund(config, {
      merId: params.merId,
      xid: params.xid,
      lidm: params.lidm,
      IN_MAC_KEY: params.IN_MAC_KEY,
      purchAmt: params.purchAmt,
      orgAmt: params.orgAmt,
    });
  } else {
    response = { ...inquiry };
  }

  return { action, response, inquiry };
}
