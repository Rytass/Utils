import { CustomsMark, InvoiceIssueOptions, InvoiceLoveCodeCarrier, InvoiceMobileCarrier, InvoiceMoicaCarrier, InvoicePaymentItem, InvoicePrintCarrier, InvoiceVoidOptions, InvoicPlatformCarrier, TaxType } from '@rytass/invoice';
import { EZPayInvoice } from './ezpay-invoice';

export enum EZPayBaseUrls {
  DEVELOPMENT = 'https://cinv.ezpay.com.tw',
  PRODUCTION = 'https://inv.ezpay.com.tw',
}

export interface EZPayInvoiceAllowanceOptions {
  taxType?: Omit<TaxType, TaxType.MIXED | TaxType.SPECIAL>;
  buyerEmail?: string;
}

export interface EZPayPaymentItem extends InvoicePaymentItem {
  name: string;
  unitPrice: number;
  quantity: number;
  unit?: string;
  taxType?: TaxType.TAXED | TaxType.TAX_FREE | TaxType.ZERO_TAX | TaxType.SPECIAL;
}

export interface EZPayInvoiceOptions {
  items: EZPayPaymentItem[];
  issuedOn: Date;
  invoiceNumber: string;
  randomCode: string;
  orderId: string;
  platformId?: string;
  taxType: TaxType;
}

interface EZPayInvoiceIssueBaseOptions extends InvoiceIssueOptions<EZPayInvoice> {
  items: EZPayPaymentItem[];
  buyerName: string;
  orderId: string;
  buyerEmail?: string;
  ezPayTransNumber?: string;
  specialTaxPercentage?: number; // 18% = 18
  customsMark?: CustomsMark;
  remark?: string;
}

export interface EZPayInvoiceB2CIssueOptions extends EZPayInvoiceIssueBaseOptions {
  carrier: EZPayAvailableCarrier;
}

export interface EZPayInvoiceB2BIssueOptions extends EZPayInvoiceIssueBaseOptions {
  vatNumber: string;
  buyerAddress?: string;
  carrier: InvoicePrintCarrier;
}

export type EZPayInvoiceIssueOptions = EZPayInvoiceB2CIssueOptions | EZPayInvoiceB2BIssueOptions;

export interface EZPayInvoiceGatewayOptions {
  hashKey?: string;
  hashIv?: string;
  merchantId?: string;
  baseUrl?: EZPayBaseUrls;
}

export enum EZPayInvoiceIssueStatus {
  INSTANT = '1',
  WAITING = '0',
  DELAY = '3',
}

export const EZPayTaxTypeCode = {
  [TaxType.TAXED]: '1',
  [TaxType.ZERO_TAX]: '2',
  [TaxType.TAX_FREE]: '3',
  [TaxType.MIXED]: '9',
}

export type EZPayAvailableCarrier = InvoicePrintCarrier | InvoiceLoveCodeCarrier | InvoiceMobileCarrier | InvoiceMoicaCarrier | InvoicPlatformCarrier;

export interface EZPayInvoiceMobileValidationPayload {
  TimeStamp: string;
  CellphoneBarcode: string;
}

export interface EZPayInvoiceLoveCodeValidationPayload {
  TimeStamp: string;
  LoveCode: string;
}

export interface EZPayInvoiceVoidPayload {
  RespondType: 'JSON';
  Version: '1.0';
  TimeStamp: string;
  InvoiceNumber: string;
  InvalidReason: string;
}

export interface EZPayInvoiceInvalidAllowancePayload {
  RespondType: 'JSON';
  Version: '1.0';
  TimeStamp: string;
  AllowanceNo: string;
  InvalidReason: string;
}

export interface EZPayInvoiceAllowancePayload {
  RespondType: 'JSON';
  Version: '1.3';
  TimeStamp: string;
  InvoiceNo: string;
  MerchantOrderNo: string;
  ItemName: string;
  ItemCount: string;
  ItemUnit: string;
  ItemPrice: string;
  ItemAmt: string;
  TaxTypeForMixed?: '1' | '2' | '3';
  ItemTaxAmt: string;
  TotalAmt: number;
  BuyerEmail?: string;
  Status: '0' | '1';
}

export interface EZPayInvoiceIssuePayload {
  RespondType: 'JSON';
  Version: '1.5';
  TimeStamp: string;
  TransNum: string;
  MerchantOrderNo: string;
  BuyerName: string;
  BuyerUBN: string;
  BuyerAddress: string;
  BuyerEmail: string;
  Category: 'B2B' | 'B2C';
  TaxType: '1' | '2' | '3' | '9';
  TaxRate: string;
  Amt: string;
  AmtSales: string;
  AmtZero: string;
  AmtFree: string;
  TaxAmt: string;
  TotalAmt: string;
  CarrierType: '' | '0' | '1' | '2';
  CarrierNum: string;
  LoveCode: string;
  PrintFlag: 'Y' | 'N';
  ItemName: string;
  ItemCount: string;
  ItemUnit: string;
  ItemPrice: string;
  ItemAmt: string;
  Comment: string;
  CreateStatusTime: string;
  Status: EZPayInvoiceIssueStatus;
  ItemTaxType: string;
  KioskPrintFlag: '1' | '';
  CustomsClearance: '' | '1' | '2';
}

export enum ErrorCode {
  KEY10002 = '資料解密錯誤',
  KEY10004 = '資料不齊全',
  KEY10006 = '商店未申請啟用電子發票',
  KEY10007 = '頁面停留超過 30 分鐘',
  KEY10010 = '商店代號空白',
  KEY10011 = 'PostData_欄位空白',
  KEY10012 = '資料傳遞錯誤',
  KEY10013 = '資料空白',
  KEY10014 = 'TimeOut',
  KEY10015 = '發票金額格式錯誤',
  INV10003 = '商品資訊格式錯誤或缺少資料',
  INV10004 = '商品資訊的商品小計計算錯誤',
  INV10006 = '稅率格式錯誤',
  INV10012 = '發票金額、課稅別驗證錯誤',
  INV10013 = '發票欄位資料不齊全或格式錯誤',
  INV10014 = '自訂編號格式錯誤',
  INV10015 = '無未稅金額',
  INV10016 = '無稅金',
  INV10017 = '輸入的版本不支援混合稅率功能',
  INV10019 = '資料含有控制碼',
  INV10020 = '暫停使用',
  INV10021 = '異常終止',
  INV20006 = '查無發票資料',
  INV70001 = '欄位資料格式錯誤',
  INV70002 = '上傳失敗之發票不得作廢',
  INV90005 = '未簽定合約或合約已到期',
  INV90006 = '可開立張數已用罄',
  NOR10001 = '網路連線異常',
  LIB10003 = '商店自訂編號重覆',
  LIB10005 = '發票已作廢過',
  LIB10007 = '無法作廢',
  LIB10008 = '超過可作廢期限',
  LIB10009 = '發票已開立，但未上傳至財政部，無法作廢',
  IAI10001 = '缺少參數 作廢折讓錯誤代碼',
  IAI10002 = '查詢失敗 作廢折讓錯誤代碼',
  IAI10003 = '更新失敗 作廢折讓錯誤代碼',
  IAI10004 = '參數錯誤 作廢折讓錯誤代碼',
  IAI10005 = '新增失敗 作廢折讓錯誤代碼',
  IAI10006 = '異常終止',
  API10001 = '缺少參數',
  API10002 = '查詢失敗',
  API10004 = '參數錯誤',
  CBC10001 = '欄位資料空白',
  CBC10002 = '欄位資料格式錯誤',
  CBC10003 = '異常終止',
  CBC10004 = '財政部大平台網路連線異常',
}

export interface EZPayInvoiceVoidOptions extends InvoiceVoidOptions {
  reason: string;
}

export interface EZPayInvoiceResponse {
  Status: 'SUCCESS' | ErrorCode;
  Message: string;
  Result: string;
}

export interface EZPayInvoiceSuccessResponse {
  MerchantID: string;
  InvoiceTransNo: string;
  MerchantOrderNo: string;
  TotalAmt: number;
  InvoiceNumber: string;
  RandomNum: string;
  CreateTime: string;
  CheckCode: string;
  BarCode: string;
  QRCodeL: string;
  QRCodeR: string;
}

export interface EZPayInvoiceMobileValidationResponse {
  Status: 'SUCCESS' | ErrorCode;
  Message: string;
  APIID: string;
  Version: string;
  MerchantID: string;
  Result: string;
  CheckCode: string;
}

export interface EZPayInvoiceMobileValidationSuccessResponse {
  CellphoneBarcode: string;
  IsExist: 'Y' | 'N';
}

export interface EZPayInvoiceLoveCodeValidationSuccessResponse {
  LoveCode: string;
  IsExist: 'Y' | 'N';
}

export interface EZPayInvoiceVoidSuccessResponse {
  MerchantID: string;
  InvoiceNumber: string;
  CreateTime: string;
}

export interface EZPayInvoiceAllowanceSuccessResponse {
  AllowanceNo: string;
  InvoiceNumber: string;
  MerchantID: string;
  MerchantOrderNo: string;
  AllowanceAmt: number;
  RemainAmt: number;
}

export interface EZPayInvoiceInvalidAllowanceSuccessResponse {
  AllowanceNo: string;
  MerchantID: string;
  CreateTime: string;
}
