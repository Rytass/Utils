import {
  CustomsMark,
  InvoiceAllowanceOptions,
  InvoiceAwardType,
  InvoiceCarrier,
  InvoiceIssueOptions,
  InvoicePaymentItem,
  InvoiceVoidOptions,
  SpecialTaxCode,
  TaxType,
} from '@rytass/invoice';

export enum ECPayBaseUrls {
  DEVELOPMENT = 'https://einvoice-stage.ecpay.com.tw',
  PRODUCTION = 'https://einvoice.ecpay.com.tw',
}

export interface ECPayInvoiceListQueryOptions {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onlyAward?: boolean;
  onlyInvalid?: boolean;
}

export interface ECPayInvoiceListQueryRequestBody {
  MerchantID: string;
  BeginDate: string;
  EndDate: string;
  NumPerPage: number;
  ShowingPage: number;
  DataType: 1 | 2;
  Query_Award: 0 | 1 | 2;
  Query_Invalid: 0 | 1 | 2;
}

export interface ECPayQueryListInvoiceResponse {
  MerchantID: string;
  RpHeader: {
    Timestamp: number;
  };
  TransCode: number;
  TransMsg: string;
  Data: ECPayQueryListInvoiceResponseDecrypted;
}

export interface ECPayQueryListInvoiceResponseDecrypted {
  RtnCode: number;
  RtnMsg: string;
  TotalCount: number;
  ShowingPage: number;
  InvoiceData: {
    IIS_Number: string;
    IIS_Relate_Number: string;
    IIS_Identifier: string;
    IIS_Clearance_Mark: string;
    IIS_Category: string;
    IIS_Tax_Type: string;
    IIS_Tax_Rate: number;
    IIS_Tax_Amount: number;
    IIS_Sales_Amount: number;
    IIS_Create_Date: string; // YYYY-MM-DD HH:mm:ss
    IIS_Issue_Status: '0' | '1';
    IIS_Invalid_Status: '0' | '1';
    IIS_Upload_Status: '0' | '1';
    IIS_Upload_Date: string; // YYYY-MM-DD HH:mm:ss
    IIS_Turnkey_Status: 'C' | 'E' | 'G' | 'P';
    IIS_Remain_Allowance_Amt: number;
    IIS_Print_Flag: '0' | '1';
    IIS_Award_Flag: '0' | '1' | 'X';
    IIS_Award_Type:
      | '0'
      | '6'
      | '5'
      | '4'
      | '3'
      | '2'
      | '1'
      | '12'
      | '11'
      | '10'
      | '9'
      | '8'
      | '7';
    IIS_Carrier_Type: '' | '1' | '2' | '3';
    IIS_Carrier_Num: string;
    IIS_Love_Code: string;
  }[];
}

export type ECPayInvoiceQueryOptions =
  | ECPayInvoiceQueryWithOrderIdOptions
  | ECPayInvoiceQueryWithInvoiceNumberAndDateOptions;

export interface ECPayInvoiceQueryWithOrderIdOptions {
  orderId: string;
}

export interface ECPayInvoiceQueryWithInvoiceNumberAndDateOptions {
  invoiceNumber: string;
  issuedOn: Date;
}
interface ECPayInvoiceQueryBasePayload {
  MerchantID: string;
}

export type ECPayInvoiceQueryRequestBody =
  | ECPayInvoiceQueryWithOrderIdRequestBody
  | ECPayInvoiceQueryWithInvoiceNumberAndDateRequestBody;

interface ECPayInvoiceQueryWithOrderIdRequestBody
  extends ECPayInvoiceQueryBasePayload {
  RelateNumber: string;
}

interface ECPayInvoiceQueryWithInvoiceNumberAndDateRequestBody
  extends ECPayInvoiceQueryBasePayload {
  InvoiceNo: string;
  InvoiceDate: string;
}

export interface ECPayQueryInvoiceResponse {
  MerchantID: string;
  RqHeader: {
    Timestamp: number;
  };
  TransCode: number;
  TransMsg: string;
  Data: string;
}

export interface ECPayQueryInvoiceResponseDecrypted {
  RtnCode: number;
  RtnMsg: string;
  IIS_Mer_ID: string;
  IIS_Number: string;
  IIS_Relate_Number: string;
  IIS_Customer_ID: string;
  IIS_Identifier: string;
  IIS_Customer_Name: string;
  IIS_Customer_Addr: string;
  IIS_Customer_Phone: string;
  IIS_Customer_Email: string;
  IIS_Customer_Mark: '1' | '2';
  IIS_Type: '07' | '08';
  IIS_Category: 'B2B' | 'B2C';
  IIS_Tax_Type: '1' | '2' | '3' | '4' | '9';
  SpecialTaxType: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  IIS_Tax_Rate: number;
  IIS_Tax_Amount: number;
  IIS_Sales_Amount: number;
  IIS_Check_Number: string;
  IIS_Carrier_Type: '' | '1' | '2' | '3';
  IIS_Carrir_Num: string;
  IIS_Love_Code: string;
  IIS_IP: string;
  IIS_Create_Date: string; // YYYY-MM-DD HH:mm:ss
  IIS_Issue_Status: '1' | '0';
  IIS_Invalid_Status: '1' | '0';
  IIS_Upload_Status: '1' | '0';
  IIS_Upload_Date: string; // YYYY-MM-DD HH:mm:ss
  IIS_Turnkey_Status: 'C' | 'E' | 'G' | 'P';
  IIS_Remain_Allowance_Amt: number;
  IIS_Print_Flag: string;
  IIS_Award_Flag: '0' | '1' | 'X';
  IIS_Award_Type:
    | '0'
    | '1'
    | '2'
    | '3'
    | '4'
    | '5'
    | '6'
    | '7'
    | '8'
    | '9'
    | '10'
    | '11'
    | '12';
  Items: {
    ItemSeq: number;
    ItemName: string;
    ItemCount: number;
    ItemWord: string;
    ItemPrice: number;
    ItemTaxType: '1' | '2' | '3' | '';
    ItemAmount: number;
    ItemRemark: string;
  }[];
  IIS_Random_Number: string;
  InvoiceRemark: string;
  PosBarCode: string;
  QRCode_Left: string;
  QRCode_Right: string;
}

export interface ECPayInvoiceVoidOptions extends InvoiceVoidOptions {
  reason: string;
}

export interface ECPayInvoiceAllowanceOptions extends InvoiceAllowanceOptions {
  taxType?: Omit<TaxType, TaxType.MIXED | TaxType.SPECIAL>;
  buyerName?: string;
  notifyEmail?: string;
  notifyPhone?: string;
}

export interface ECPayInvoiceVoidRequestBody {
  MerchantID: string;
  InvoiceNo: string;
  InvoiceDate: string;
  Reason: string;
}

export interface ECPayInvoiceInvalidAllowanceRequestBody {
  MerchantID: string;
  InvoiceNo: string;
  AllowanceNo: string;
  Reason: string;
}

export interface ECPayInvoiceAllowanceRequestBody {
  MerchantID: string;
  InvoiceNo: string;
  InvoiceDate: string;
  AllowanceNotify: 'S' | 'E' | 'A' | 'N';
  CustomerName?: string;
  NotifyMail?: string;
  NotifyPhone?: string;
  AllowanceAmount: number;
  Items: {
    ItemSeq: number;
    ItemName: string;
    ItemCount: number;
    ItemWord: string;
    ItemPrice: number;
    ItemTaxType?: '1' | '2' | '3' | '';
    ItemAmount: number;
  }[];
}

export interface ECPayInvoiceVoidResponse {
  PlatformID?: string;
  MerchantID: string;
  RpHeader: {
    Timestamp: number;
  };
  TransCode: number;
  TransMsg: string;
  Data: string;
}

export interface ECPayVoidInvoiceResponseDecrypted {
  RtnCode: number;
  RtnMsg: string;
  InvoiceNo: string;
}

export interface ECPayAllowanceInvoiceResponseDecrypted {
  RtnCode: number;
  RtnMsg: string;
  IA_Allow_No: string;
  IA_Invoice_No: string;
  IA_Date: string;
  IA_Remain_Allowance_Amt: number;
}

export interface ECPayInvalidAllowanceInvoiceResponseDecrypted {
  RtnCode: number;
  RtnMsg: string;
  IA_Invoice_No: string;
}

export interface ECPayInvoiceOptions {
  items: ECPayPaymentItem[];
  issuedOn: Date;
  invoiceNumber: string;
  randomCode: string;
  orderId: string;
  taxType: TaxType;
  awardType?: InvoiceAwardType;
  isVoid?: boolean;
}

export interface ECPayInvoiceGatewayOptions {
  aesKey?: string;
  aesIv?: string;
  merchantId?: string;
  baseUrl?: ECPayBaseUrls;
}

interface ECPayCustomerInfo {
  id?: string;
  name?: string;
  address?: string;
  mobile?: string;
  email?: string;
}

export interface ECPayPaymentItem extends InvoicePaymentItem {
  name: string;
  unitPrice: number;
  quantity: number;
  unit?: string;
  taxType?:
    | TaxType.TAXED
    | TaxType.TAX_FREE
    | TaxType.ZERO_TAX
    | TaxType.SPECIAL;
  remark?: string;
}

export interface ECPayInvoiceIssueOptions
  extends InvoiceIssueOptions<ECPayPaymentItem> {
  orderId: string;
  customer: ECPayCustomerInfo;
  remark?: string;
  specialTaxCode?: SpecialTaxCode;
}

export interface ECPayInvoiceResponse {
  PlatformID?: string;
  MerchantID: string;
  RpHeader: {
    Timestamp: number;
  };
  TransCode: number;
  TransMsg: string;
  Data: string;
}

export interface ECPayIssuedInvoiceResponse {
  RtnCode: number;
  RtnMsg: string;
  InvoiceNo: string;
  InvoiceDate: string;
  RandomNumber: string;
}

export interface ECPayInvoiceRequestBody {
  MerchantID: string;
  RelateNumber: string;
  CustomerID: string;
  CustomerIdentifier: string;
  CustomerName: string;
  CustomerAddr: string;
  CustomerPhone: string;
  CustomerEmail: string;
  ClearanceMark: '1' | '2';
  Print: '0' | '1';
  Donation: '0' | '1';
  LoveCode: string;
  CarrierType: '' | '1' | '2' | '3';
  CarrierNum: string;
  TaxType: '1' | '2' | '3' | '4' | '9';
  SpecialTaxType: number;
  SalesAmount: number;
  InvoiceRemark: string;
  Items: {
    ItemSeq: number;
    ItemName: string;
    ItemCount: number;
    ItemWord: string;
    ItemPrice: number;
    ItemTaxType: string;
    ItemAmount: number;
    ItemRemark: string;
  }[];
  InvType: '07' | '08';
  vat: '1';
}

export interface ECPayInvoiceMobileBarcodeValidateResponse {
  RtnCode: number;
  RtnMsg: string;
  IsExist: 'Y' | 'N';
}

export interface ECPayInvoiceLoveCodeValidateResponse {
  RtnCode: number;
  RtnMsg: string;
  IsExist: 'Y' | 'N';
}

export interface ECPayInvoiceMobileBarcodeValidateRequestBody {
  MerchantID: string;
  BarCode: string;
}

export interface ECPayInvoiceLoveCodeValidateRequestBody {
  MerchantID: string;
  LoveCode: string;
}
