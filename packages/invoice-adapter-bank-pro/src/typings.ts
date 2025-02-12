import {
  InvoiceAllowanceState,
  InvoiceIssueOptions,
  InvoicePaymentItem,
  InvoiceState,
  TaxType,
} from '@rytass/invoice';
import { BankProInvoice } from './bank-pro-invoice';

export enum BankProBaseUrls {
  DEVELOPMENT = 'http://webtest.bpscm.com.tw/webapi/api/B2B2CWebApi',
  PRODUCTION = 'http://www.bpscm.com.tw/webapi/api/B2B2CWebApi',
}

export interface BankProPaymentItem extends InvoicePaymentItem {
  name: string;
  unitPrice: number;
  quantity: number;
  unit?: string;
  taxType?: TaxType.TAXED | TaxType.TAX_FREE | TaxType.ZERO_TAX;
  id?: string;
  barcode?: string;
  spec?: string;
  remark?: string;
}

export interface BankProInvoiceOptions {
  items: BankProPaymentItem[];
  issuedOn: Date;
  invoiceNumber: string;
  randomCode: string;
  orderId: string;
  taxType: TaxType;
  voidOn?: Date;
  state?: InvoiceState;
}

export interface BankProInvoiceGatewayOptions {
  user: string;
  password: string;
  systemOID: number;
  sellerBAN: string; // 賣方統編
  baseUrl?: BankProBaseUrls;
}

export interface BankProInvoiceQueryFromOrderIdArgs {
  orderId: string;
}

export interface BankProInvoiceQueryFromInvoiceNumberArgs {
  invoiceNumber: string;
}

export type BankProInvoiceQueryArgs =
  | BankProInvoiceQueryFromOrderIdArgs
  | BankProInvoiceQueryFromInvoiceNumberArgs;

export interface BankProInvoiceIssueOptions
  extends InvoiceIssueOptions<BankProPaymentItem> {
  orderId: string;
  sellerCode?: string; // 賣方廠編
  companyName?: string; // 買方公司名稱
  remark?: string;
  buyerEmail: string;
  buyerName?: string;
  buyerZipCode?: string;
  buyerAddress?: string;
  buyerMobile?: string;
}

export interface BankProInvoicePosIssueOptions
  extends InvoiceIssueOptions<BankProPaymentItem> {
  orderId: string;
  issueAt: Date;
  registerCode: string;
  storeName: string;
  storeCode: string;
  sellerCode?: string; // 賣方廠編
  companyName?: string; // 買方公司名稱
  remark?: string;
}

export enum BankProInvoiceStatus {
  CREATE = '0',
  UPDATE = '1',
  DELETE = '2',
  ALLOWANCE = '3',
  INVALID_ALLOWANCE = '4',
}

export const BankProRateType = {
  [TaxType.TAXED]: '1',
  [TaxType.ZERO_TAX]: '2',
  [TaxType.TAX_FREE]: '3',
} as Record<TaxType, '1' | '2' | '3'>;

export interface BankProQueryInvoiceByInvoiceNumberPayload {
  UserID: string;
  Pwd: string;
  SystemOID: number;
  InvoiceNo: string;
}

export interface BankProQueryInvoiceByOrderNumberPayload {
  UserID: string;
  Pwd: string;
  SystemOID: number;
  OrderNo: string;
}

export interface BankProIssueInvoicePayload {
  UserID: string;
  Pwd: string;
  SystemOID: number;
  Orders: {
    No: string;
    OrderStatus: BankProInvoiceStatus;
    OrderDate: string;
    ExpectedShipDate: string;
    UpdateOrderDate: string;
    RateType: '1' | '2' | '3';
    Amount: 0;
    TaxAmount: 0;
    TotalAmount: number;
    SellerBAN: string;
    SellerCode: string;
    BuyerBAN: string;
    BuyerCompanyName: string;
    PaperInvoiceMark: 'Y' | 'N';
    DonateMark: string;
    MainRemark: string;
    CarrierType: '3J0002' | 'CQ0001' | '';
    CarrierId1: string;
    CarrierId2: string;
    RelateNumber1: string;
    RelateNumber2: string;
    RelateNumber3: string;
    Members: {
      ID: string; // User Email
      Name: string;
      ZipCode: string;
      Address: string;
      Tel: string;
      Mobilephone: string;
      Email: string;
    }[];
    OrderDetails: {
      SeqNo: string;
      ItemID: string;
      Barcode: string;
      ItemName: string;
      ItemSpec: string;
      Unit: string;
      UnitPrice: number;
      Qty: number;
      Amount: 0;
      TaxAmount: 0;
      TotalAmount: string;
      HealthAmount: 0;
      DiscountAmount: 0;
      RateType: '1' | '2' | '3';
      DetailRemark: string;
    }[];
  }[];
}

export interface BankProIssueInvoiceResponse {
  OrderNo: string;
  OrderStatus: BankProInvoiceStatus;
  InvoiceNo: string;
  ErrorMessage: string;
  RandomNumber: string;
  InvoiceDate: string; // yyyy/MM/dd
  AllowanceNo?: string;
  AllowanceDate?: string; // yyyy/MM/dd
}

export type BankProInvoiceQueryResponse = {
  InvoiceNo: string;
  InvoiceDate: string; // yyyy/MM/dd
  CheckNo: '1';
  OrderNo: string;
  BuyerBAN: string;
  BuyerName: string;
  BuyerAddress: string;
  SellerBAN: string;
  SellerName: string;
  InvoiceAmount: string; // NumberString in Float
  RateType: '應稅' | '零稅' | '免稅';
  TaxAmount: string; // NumberString in Float
  Remark: string;
  IsNillify: 'Y' | 'N'; // Y is voided
  RandomNumber: string;
  InvoiceDetails: {
    ProductName: string;
    Qty: string; // NumberString in Float
    UnitPrice: string; // NumberString in Float
    Amount: string; // NumberString in Float
  }[];
};

export interface BankProVoidInvoiceResponse {
  OrderNo: string;
  OrderStatus: BankProInvoiceStatus.DELETE;
  InvoiceNo: '';
  ErrorMessage: '';
  RandomNumber: '';
  InvoiceDate: '';
  AllowanceNo: '';
  AllowanceDate: '';
  AllowanceInvoiceNo: '';
}

export interface BankProVoidAllowanceResponse {
  OrderNo: string;
  OrderStatus: BankProInvoiceStatus.ALLOWANCE;
  InvoiceNo: '';
  ErrorMessage: '';
  RandomNumber: '';
  InvoiceDate: '';
  AllowanceNo: string;
  AllowanceDate: string; // yyyy/MM/dd HH:mm:ss
  AllowanceInvoiceNo: string;
}

export interface BankProAllowanceOptions {
  allowanceNumber: string;
  allowancePrice: number;
  allowancedOn: Date;
  items: BankProPaymentItem[];
  parentInvoice: BankProInvoice;
  status: InvoiceAllowanceState;
  invalidOn: Date | null;
}

export interface BankProPosMainPayload {
  /**
   * 檔案代號 - 固定值填 M.
   */
  FileType: 'M';

  /**
   * 發票狀態
   * 1: 發票開立
   * 4: 折讓開立
   * 6: 發票補印
   * 7: 折讓補印
   */
  State: '1' | '4' | '6' | '7';

  /**
   * 賣方統編
   */
  SellerBAN: string;

  /**
   * 店別代碼
   */
  StoreCode: string;

  /**
   * 相關號碼（店別名稱）
   */
  StoreName: string;
  /**
   * 機號
   */
  RegisterCode: string;
  /**
   * 發票: 交易序號(20 碼)
   * 折讓: 折讓單號(16 碼)
   */
  OrderNo: string;
  InvoiceNo: string;
  InvoiceDate: string; // 系統自動讀取時間 (格式: yyyy/MM/dd 或 yyyy/MM/dd HH:mm:ss，作廢時為作廢日期)
  AllowanceDate?: string;
  BuyerBAN: string;
  PrintMark: string;
  MemberId: string;
  GroupMark: string;
  SalesAmt: string;
  FreeTaxSalesAmt: string;
  ZeroTaxSalesAmt: string;
  TaxAmt: string;
  TotalAmt: number;
  TaxType: '1' | '2' | '3' | '4' | '9';
  TaxRate: string;
  CarrierType: string;
  CarrierId1: string;
  CarrierId2: string;
  NpoBan: string;
  RandomNumber: string;
  MainRemark: string;
  Buyer: '';
  CancelReason: string;
  ReturnTaxDocumentNo: string;
  Remark: string;
}

export interface BankProPosDetailPayload {
  FileType: 'D';
  SequenceNo: string;
  ItemName: string;
  Qty: number;
  Unit: string;
  UnitPrice: number;
  SalesAmt: '';
  TaxAmt: '';
  TotalAmt: string;
  RelatedNumber: '';
  Remark: string;
}
