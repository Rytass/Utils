import crypto from 'node:crypto';
import * as iconv from 'iconv-lite';
import * as https from 'node:https';
import { desMac, SSLAuthIV } from './ctbc-crypto-core';
import {
  CTBC_ERROR_CODES,
  CTBCPosApiConfig,
  CTBCPosApiQueryParams,
  CTBCPosApiRefundParams,
  CTBCPosApiCancelRefundParams,
  CTBCPosApiResponse,
} from './typings';
import { Logger } from '@nestjs/common';

const posApiUtilsLogger = new Logger('CTBCPosApiUtils');

function checkMerid(input: string): true | number {
  if (!input) {
    return CTBC_ERROR_CODES.ERR_INVALID_MERID;
  }

  if (!isNumeric(input)) {
    return CTBC_ERROR_CODES.ERR_INVALID_MERID;
  }

  return true;
}

function isNumeric(input: string): boolean {
  return /^\d+$/.test(input);
}

function checkLidm(input: string): true | number {
  const MAX_LENGTH = 19;

  if (!input || input.length === 0 || input.length > MAX_LENGTH) {
    return CTBC_ERROR_CODES.ERR_INVALID_LIDM;
  }

  if (!checkValidSymbol(input)) {
    return CTBC_ERROR_CODES.ERR_INVALID_LIDM;
  }

  return true;
}

function checkValidSymbol(input: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(input);
}

function checkOrgAmt(input: string): true | number {

  if (!isNumeric(input)) {
    return CTBC_ERROR_CODES.ERR_INVALID_ORG_AMT;
  }

  return true;
}

function checkAuthCode(input: string): true | number {
  if (!input || input === null) {
    return true;
  }

  if (input === '' || input.length > 6 || !/^[A-Za-z0-9]+$/.test(input)) {
    return CTBC_ERROR_CODES.ERR_INVALID_AUTH_CODE;
  }

  return true;
}

function checkTxType(input: string): true | number {
  if (!input) {
    return CTBC_ERROR_CODES.ERR_INVALID_TX_TYPE;
  }

  const validTypes = ['Q', 'A', 'S', 'V', 'R'];

  if (!validTypes.includes(input)) {
    return CTBC_ERROR_CODES.ERR_INVALID_TX_TYPE;
  }

  return true;
}

function getJsonString(
  name: string,
  name2: string | null,
  type: string | null,
  value: string,
  quote: string = '"',
): string {
  let jsonStr = '';
  let nameStr = name;

  if (name2) {
    nameStr = `${name}${name2}`;
  }

  jsonStr += `${quote}${nameStr}${quote}:`;

  if (type === 'N') {
    jsonStr += value;
  } else {
    jsonStr += `${quote}${value}${quote}`;
  }

  return jsonStr;
}

function getMacValue(dataString: string, macKey: string): string {
  if (macKey.length === 8) {
    return getMacValue8(dataString, macKey);
  } else if (macKey.length === 24) {
    return getMacValue24(dataString, macKey);
  }

  throw new Error('Invalid MAC key length');
}

function getMacValueSub(dataString: string, macKey: string): string {
  if (macKey.length === 8) {
    return getMacValue8Sub(dataString, macKey);
  } else if (macKey.length === 24) {
    return getMacValue24Sub(dataString, macKey);
  }

  throw new Error('Invalid MAC key length');
}

function getMacValue8(dataString: string, macKey: string): string {
  const big5Data = iconv.encode(dataString, 'big5');

  return desMac(big5Data, macKey);
}

function getMacValue8Sub(dataString: string, macKey: string): string {
  const big5Data = iconv.encode(dataString, 'big5');
  const mac = desMac(big5Data, macKey);

  return mac.slice(-16);
}

function getMacValue24(dataString: string, macKey: string): string {
  const big5Data = iconv.encode(dataString, 'big5');
  const mac = desMac(big5Data, macKey);

  return mac;
}

function getMacValue24Sub(dataString: string, macKey: string): string {
  const big5Data = iconv.encode(dataString, 'big5');
  const mac = desMac(big5Data, macKey);

  return mac.slice(-48); // 取最後 48 字元
}

// 解密 MAC 值 - 對應 PHP 的 decodeDESMAC
function decodeMacValue(macValue: string, macKey: string): string {
  const decipher = crypto.createDecipheriv('des-ede3-cbc', Buffer.from(macKey, 'utf8'), SSLAuthIV);

  decipher.setAutoPadding(false);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(macValue, 'hex')),
    decipher.final(),
  ]);

  // 使用與 PHP 相同的 PKCS#5 unpadding
  const decryptedBuffer = pkcs5Unpad(decrypted);

  // 如果包含 '}' 字符，則進行字符編碼轉換（PHP 中會從 BIG-5 轉 UTF-8）
  // 使用 iconv-lite 來處理 Big5 編碼轉 UTF-8
  try {
    // 先嘗試用 Big5 解碼
    const decryptedStr = iconv.decode(decryptedBuffer, 'big5');
    return decryptedStr;
  } catch (error) {
    // 如果 Big5 解碼失敗，回退到 UTF-8
    console.warn('Big5 解碼失敗，使用 UTF-8 解碼:', error);
    return decryptedBuffer.toString('utf8');
  }
}

// PKCS#5 Unpadding - 對應 PHP 的 pkcs5Unpad
function pkcs5Unpad(data: Buffer): Buffer {
  const pad = data[data.length - 1];

  if (pad > data.length) {
    throw new Error('Invalid padding');
  }

  // 驗證 padding 的完整性
  for (let i = data.length - pad; i < data.length; i++) {
    if (data[i] !== pad) {
      throw new Error('Invalid padding');
    }
  }

  const result = data.slice(0, data.length - pad);

  return result;
}

// 回應解析 - 對應 PHP 的 parseResponse
function parseResponse(responseStr: string, macKey: string): CTBCPosApiResponse | number {
  // 解析格式：key1=value1&key2=value2&encryptedData
  const parts = responseStr.split(/[&=]/);

  if (parts.length < 4) {
    return CTBC_ERROR_CODES.ERR_RESPONSE_PARSE_FAILED;
  }

  const encryptedData = parts[3];
  const decodedData = decodeMacValue(encryptedData, macKey);

  posApiUtilsLogger.log(`decodedData: ${decodedData}`);

  // 尋找 JSON 結尾
  const jsonEndIndex = decodedData.lastIndexOf('}');

  if (jsonEndIndex === -1) {
    return CTBC_ERROR_CODES.ERR_JSON_DECODE_FAILED;
  }

  const jsonStr = decodedData.slice(0, jsonEndIndex + 1);

  try {
    const jsonDecoded = JSON.parse(jsonStr);

    return jsonDecoded;
  } catch (error) {
    return CTBC_ERROR_CODES.ERR_RESPONSE_PARSE_FAILED;
  }
}

// 網路請求發送與回應處理
async function sendAndGetResponse(
  config: CTBCPosApiConfig,
  merid: string,
  requestData: string,
): Promise<CTBCPosApiResponse | number> {
  try {
    const macSubString = getMacValueSub(requestData, config.MacKey);
    const apiEncString = getMacValue(requestData + macSubString, config.MacKey);

    const formData = new URLSearchParams({
      ApiEnc: apiEncString,
      MERID: merid,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    posApiUtilsLogger.log('CTBC API 請求 URL:', config.URL);
    posApiUtilsLogger.log('CTBC API 請求資料:', requestData);
    posApiUtilsLogger.log('CTBC API MAC Key:', config.MacKey);
    posApiUtilsLogger.log('CTBC API 請求資料:', formData.toString());

    // 配置標準的 HTTPS 請求選項
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: controller.signal,
    };

    const response = await fetch(config.URL, fetchOptions);

    clearTimeout(timeoutId);

    if (!response.ok) {
      return CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED;
    }

    const responseText = await response.text();

    posApiUtilsLogger.log('CTBC API 回應狀態:', response.status);
    posApiUtilsLogger.log('CTBC API 回應內容:', responseText);

    return parseResponse(responseText, config.MacKey);
  } catch (error) {
    posApiUtilsLogger.error('CTBC API request failed:', error);

    return CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED;
  }
}

// POS API 查詢功能
export async function posApiQuery(
  config: CTBCPosApiConfig,
  params: CTBCPosApiQueryParams,
): Promise<CTBCPosApiResponse | number> {
  // 參數驗證
  const meridCheck = checkMerid(params.MERID);

  if (meridCheck !== true) {
    return meridCheck;
  }

  const lidmCheck = checkLidm(params['LID-M']);

  if (lidmCheck !== true) {
    return lidmCheck;
  }

  if (params.TxType) {
    const txTypeCheck = checkTxType(params.TxType);

    if (txTypeCheck !== true) {
      return txTypeCheck;
    }
  }

  // 建構請求 URL
  const requestConfig = { ...config };

  requestConfig.URL += '/NewQuery/InquiryByLidm';

  // 建構 JSON 請求資料
  let requestData = '{';

  requestData += getJsonString('MERID', null, 'S', params.MERID, '"');
  requestData += ',';
  requestData += getJsonString('LID-M', null, 'S', params['LID-M'], '"');
  requestData += ',';
  requestData += getJsonString('VERSION', null, 'S', '3.2', '"');
  requestData += ',';
  requestData += getJsonString('SwRevision', null, 'S', 'MicroQuery Server 3.2 (2019/10/25)', '"');

  if (params.TxType) {
    requestData += ',';
    requestData += getJsonString('TxType', null, 'S', params.TxType, '"');
  }

  if (params.TxID) {
    requestData += ',';
    requestData += getJsonString('TxID', null, 'S', params.TxID, '"');
  }

  if (params.Tx_ATTRIBUTE) {
    requestData += ',';
    requestData += getJsonString('Tx_ATTRIBUTE', null, 'S', params.Tx_ATTRIBUTE, '"');
  }

  requestData += '}';

  return sendAndGetResponse(requestConfig, params.MERID, requestData);
}

// POS API 退款功能
export async function posApiRefund(
  config: CTBCPosApiConfig,
  params: CTBCPosApiRefundParams,
): Promise<CTBCPosApiResponse | number> {
  // 參數驗證
  const meridCheck = checkMerid(params.MERID);

  if (meridCheck !== true) {
    return meridCheck;
  }

  const lidmCheck = checkLidm(params['LID-M']);

  if (lidmCheck !== true) {
    return lidmCheck;
  }

  const orgAmtCheck = checkOrgAmt(params.OrgAmt);

  if (orgAmtCheck !== true) {
    return orgAmtCheck;
  }

  if (params.AuthCode) {
    const authCodeCheck = checkAuthCode(params.AuthCode);

    if (authCodeCheck !== true) {
      return authCodeCheck;
    }
  }

  // 建構請求 URL
  const requestConfig = { ...config };

  requestConfig.URL += '/NewPos/Refund';

  // 建構部分退款金額字串
  let refundAmtString = '';

  if (params.currency && params.PurchAmt && params.exponent) {
    refundAmtString = `${params.currency} ${params.PurchAmt} ${params.exponent}`;
  }

  let originalAmtString = ''
  if (params.currency && params.OrgAmt && params.exponent) {
    originalAmtString = `${params.currency} ${params.OrgAmt} ${params.exponent}`;
  }

  // 建構 JSON 請求資料
  let requestData = '{';

  requestData += getJsonString('MERID', null, 'S', params.MERID, '"');
  requestData += ',';
  requestData += getJsonString('LID-M', null, 'S', params['LID-M'], '"');

  if (params.AuthCode) {
    requestData += ',';
    requestData += getJsonString('AuthCode', null, 'S', params.AuthCode, '"');
  }

  if (refundAmtString) {
    requestData += ',';
    requestData += getJsonString('CredAmt', null, null, refundAmtString, '"');
  }

  if (originalAmtString) {
    requestData += ',';
    requestData += getJsonString('OrgAmt', null, null, originalAmtString, '"');
  }

  requestData += ',';
  requestData += getJsonString('XID', null, 'S', params.XID, '"');
  requestData += ',';
  requestData += getJsonString('VERSION', null, 'S', '3.2', '"');
  requestData += ',';
  requestData += getJsonString('SwRevision', null, 'S', 'MicroRefund Server 3.2 (2019/10/25)', '"');

  requestData += '}';

  return sendAndGetResponse(requestConfig, params.MERID, requestData);
}

// POS API 退款撤銷功能
export async function posApiCancelRefund(
  config: CTBCPosApiConfig,
  params: CTBCPosApiCancelRefundParams,
): Promise<CTBCPosApiResponse | number> {

  posApiUtilsLogger.log('🔍 posApiCancelRefund 請求參數:', params);

  // 參數驗證
  const meridCheck = checkMerid(params.MERID);

  if (meridCheck !== true) {
    return meridCheck;
  }

  const lidmCheck = checkLidm(params['LID-M']);

  if (lidmCheck !== true) {
    return lidmCheck;
  }

  const orgAmtCheck = checkOrgAmt(params.CredRevAmt);

  if (orgAmtCheck !== true) {
    return orgAmtCheck;
  }

  if (params.AuthCode) {
    const authCodeCheck = checkAuthCode(params.AuthCode);

    if (authCodeCheck !== true) {
      return authCodeCheck;
    }
  }

  // 建構請求 URL
  const requestConfig = { ...config };

  requestConfig.URL += '/NewPos/RefundRev';

  // 建構部分退款金額字串
  let cancelRefundAmtString = '';

  if (params.currency && params.CredRevAmt && params.exponent) {
    cancelRefundAmtString = `${params.currency} 0 ${params.exponent}`;
  }

  let originalRefundAmtString = ''
  if (params.currency && params.CredRevAmt && params.exponent) {
    originalRefundAmtString = `${params.currency} ${params.CredRevAmt} ${params.exponent}`;
  }

  // 建構 JSON 請求資料
  let requestData = '{';

  requestData += getJsonString('MERID', null, 'S', params.MERID, '"');
  requestData += ',';
  requestData += getJsonString('LID-M', null, 'S', params['LID-M'], '"');

  if (params.AuthCode) {
    requestData += ',';
    requestData += getJsonString('AuthCode', null, 'S', params.AuthCode, '"');
  }

  if (cancelRefundAmtString) {
    requestData += ',';
    requestData += getJsonString('CredRevAmt', null, null, cancelRefundAmtString, '"');
  }

  if (originalRefundAmtString) {
    requestData += ',';
    requestData += getJsonString('OrgAmt', null, null, originalRefundAmtString, '"');
  }

  requestData += ',';
  requestData += getJsonString('XID', null, 'S', params.XID, '"');
  requestData += ',';
  requestData += getJsonString('VERSION', null, 'S', '3.2', '"');
  requestData += ',';
  requestData += getJsonString('SwRevision', null, 'S', 'MicroRefund Server 3.2 (2019/10/25)', '"');

  requestData += '}';

  posApiUtilsLogger.log('🔍 posApiCancelRefund 請求詳情:');
  posApiUtilsLogger.log('請求 URL:', requestConfig.URL);
  posApiUtilsLogger.log('請求資料:', requestData);

  const result = await sendAndGetResponse(requestConfig, params.MERID, requestData);

  posApiUtilsLogger.log('🔍 posApiCancelRefund 回應詳情:');
  posApiUtilsLogger.log('回應類型:', typeof result);
  posApiUtilsLogger.log('回應內容:', JSON.stringify(result, null, 2));

  return result;
}
