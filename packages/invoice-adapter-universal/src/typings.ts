import {
  InvoiceAllowanceOptions,
  InvoiceAllowanceState,
  InvoiceIssueOptions,
  InvoicePaymentItem,
  InvoiceState,
  InvoiceVoidOptions,
  TaxType,
} from '@rytass/invoice';
import { UniversalBaseUrls } from './constants';
import { UniversalAllowance } from './universal-allowance';

export type UniversalProcessType = 'B' | 'C';
export type UniversalInvoiceType = '07' | '08';
export type UniversalTaxTypeCodeValue = '1' | '2' | '3' | '4' | '9';
export type UniversalDetailTaxTypeCode = Exclude<UniversalTaxTypeCodeValue, '9'>;
export type UniversalZeroTaxRateReason = '71' | '72' | '73' | '74' | '75' | '76' | '77' | '78' | '79';

export interface UniversalInvoiceGatewayOptions {
  companyID: string;
  userID: string;
  auth: string;
  apiKey: string;
  sellerID: string;
  baseUrl?: UniversalBaseUrls | string;
  unitCode?: string;
  buyerNameResolver?: (options: UniversalInvoiceIssueOptions) => string;
  skipMobileBarcodeValidation?: boolean;
  skipLoveCodeValidation?: boolean;
}

export interface UniversalPaymentItem extends InvoicePaymentItem {
  name: string;
  unitPrice: number;
  quantity: number;
  unit?: string;
  taxType?: TaxType.TAXED | TaxType.TAX_FREE | TaxType.ZERO_TAX | TaxType.SPECIAL;
  remark?: string;
}

export interface UniversalInvoiceIssueOptions extends InvoiceIssueOptions<UniversalPaymentItem> {
  orderId: string;
  buyerName?: string;
  buyerAddress?: string;
  buyerEmail?: string;
  remark?: string;
  unitCode?: string;
  zeroTaxRateReason?: UniversalZeroTaxRateReason;
  invoiceType?: UniversalInvoiceType;
}

export interface UniversalInvoiceOptions {
  orderId: string;
  sellerID: string;
  buyerID: string;
  buyerName?: string;
  items: UniversalPaymentItem[];
  issuedOn: Date;
  invoiceNumber: string;
  randomCode: string;
  taxType: TaxType;
  voidOn?: Date | null;
  state?: InvoiceState;
  allowances?: UniversalAllowance[];
}

export interface UniversalAllowanceOptions {
  allowanceNumber: string;
  allowanceDate: string;
  allowancePrice: number;
  allowancedOn: Date;
  remainingAmount: number;
  items: UniversalPaymentItem[];
  parentInvoice: import('./universal-invoice').UniversalInvoice;
  status: InvoiceAllowanceState;
  invalidOn: Date | null;
  salesReturnID: string;
}

export interface UniversalInvoiceVoidOptions extends InvoiceVoidOptions {
  orderId?: string;
  remark?: string;
}

export interface UniversalInvoiceAllowanceOptions extends InvoiceAllowanceOptions {
  salesReturnID?: string;
  buyerName?: string;
  buyerAddress?: string;
  notifyEmail?: string;
  unitCode?: string;
  allowanceType?: '1' | '2';
}

export interface UniversalInvoiceInvalidAllowanceOptions {
  salesReturnID?: string;
  reason?: string;
}

export type UniversalInvoiceQueryOptions =
  | {
      orderId: string;
      processType?: UniversalProcessType;
    }
  | {
      invoiceNumber: string;
      issuedOn: Date | string;
      processType?: UniversalProcessType;
    };

export interface UniversalRequestBody<TReqData> {
  companyID: string;
  userID: string;
  auth: string;
  createDateTime: string;
  signatureValue: string;
  reqData: TReqData;
}

export interface UniversalResponse<TRespData = undefined> {
  statusCode: '0' | '1' | '2' | '3' | '9';
  statusDesc?: string;
  respData?: TRespData;
}

export interface UniversalInvoiceDetailPayload {
  description: string;
  quantity: number;
  unit?: string;
  unitprice: number;
  amount: number;
  sequenceNumber: string;
  remark?: string;
  taxType?: UniversalDetailTaxTypeCode;
}

export interface UniversalOpenInvoicePayload {
  orderID: string;
  process_type: UniversalProcessType;
  sellerID: string;
  buyerID: string;
  buyerName: string;
  buyerAddress?: string;
  mainRemark?: string;
  invoiceType: UniversalInvoiceType;
  donateMark: '0' | '1';
  carrierType?: '' | '3J0002' | 'CQ0001' | 'EG0478';
  carrierID1?: string;
  carrierID2?: string;
  printMark: 'Y' | 'N';
  npoban?: string;
  salesAmount: number;
  freetaxSalesamount: number;
  zerotaxSalesamount: number;
  taxType: UniversalTaxTypeCodeValue;
  taxrate: number;
  taxAmount: number;
  totalAmount: number;
  notifyEmail?: string;
  customsClearanceMark?: '1' | '2';
  unitCode?: string;
  zeroTaxRateReason?: UniversalZeroTaxRateReason;
  Details: UniversalInvoiceDetailPayload[];
}

export interface UniversalOpenInvoiceResponse {
  invNo: string;
  invDate: string;
  invTime: string;
  randomNumber: string;
}

export interface UniversalCancelInvoicePayload {
  orderID: string;
  process_type: UniversalProcessType;
  sellerID: string;
  buyerID: string;
  invNo: string;
  invDate: string;
  cancelReason: string;
  remark?: string;
}

export interface UniversalCancelInvoiceResponse {
  invNo: string;
  cancelDate: string;
  cancelTime: string;
}

export interface UniversalAllowanceDetailPayload {
  originalinvDate: string;
  originalInvoiceNumber: string;
  originalDescription: string;
  quantity: number;
  unitprice: number;
  amount: number;
  tax: number;
  sequenceNumber: string;
  taxType: UniversalDetailTaxTypeCode;
}

export interface UniversalOpenAllowancePayload {
  salesReturnID: string;
  process_type: UniversalProcessType;
  sellerID: string;
  sellerName?: string;
  sellerAddress?: string;
  buyerID: string;
  buyerName?: string;
  buyerAddress?: string;
  allowanceType: '1' | '2';
  taxAmount: number;
  totalAmount: number;
  notifyEmail?: string;
  unitCode?: string;
  originalInvoiceSellerId?: string;
  originalInvoiceBuyerId?: string;
  salesReturnDetail: UniversalAllowanceDetailPayload[];
}

export interface UniversalOpenAllowanceResponse {
  allowanceNumber: string;
  allowanceDate: string;
}

export interface UniversalCancelAllowancePayload {
  salesReturnID: string;
  process_type: UniversalProcessType;
  sellerID: string;
  buyerID: string;
  allowanceNumber: string;
  allowanceDate: string;
  cancelReason: string;
  remark?: string;
}

export interface UniversalCancelAllowanceResponse {
  allowanceNumber: string;
  cancelDate: string;
  cancelTime: string;
}

export interface UniversalQueryInvoicePayload {
  orderID: string;
  process_type: UniversalProcessType;
  sellerID: string;
}

export interface UniversalQueryInvoiceResponse {
  invNo: string;
  invDate: string;
  invTime: string;
  randomNumber: string;
  status?: '0' | '1' | '3';
}

export interface UniversalQueryInvoiceDetailPayload {
  invNo: string;
  invDate: string;
  process_type: UniversalProcessType;
  sellerID: string;
}

export interface UniversalQueryInvoiceDetailResponse {
  invNo: string;
  sellerCompid?: string;
  buyerCompid?: string;
  sellerName?: string;
  buyerName?: string;
  invDate: string;
  note?: string;
  amount?: number | string;
  tax?: number | string;
  total?: number | string;
  sellerInvStatus?: '0' | '1';
  carrierType?: string;
  carrierid1?: string;
  npoban?: string;
  randomnumber?: string;
  freetaxsalesamount?: number | string;
  zerotaxsalesamount?: number | string;
  details?: {
    productName?: string;
    qty?: number | string;
    unitPrice?: number | string;
    subtotoal?: number | string;
  }[];
}
