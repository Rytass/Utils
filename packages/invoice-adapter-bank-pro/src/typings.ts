import {
  InvoiceIssueOptions,
  InvoicePaymentItem,
  InvoiceState,
  TaxType,
} from '@rytass/invoice';

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
    SellerCode?: string;
    BuyerBAN?: string;
    BuyerCompanyName?: string;
    PaperInvoiceMark: 'Y' | 'N';
    DonateMark?: string;
    MainRemark?: string;
    CarrierType?: '3J0002' | 'CQ0001';
    CarrierId1?: string;
    CarrierId2?: string;
    Members: {
      ID: string; // User Email
      Name?: string;
      ZipCode?: string;
      Address?: string;
      Tel?: string;
      Mobilephone?: string;
      Email: string;
    }[];
    OrderDetails: {
      SeqNo: string;
      ItemID?: string;
      Barcode?: string;
      ItemName: string;
      ItemSpec?: string;
      Unit?: string;
      UnitPrice?: number;
      Qty: number;
      Amount?: string;
      TaxAmount?: string;
      TotalAmount: string;
      RateType: '1' | '2' | '3';
      DetailRemark?: string;
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
