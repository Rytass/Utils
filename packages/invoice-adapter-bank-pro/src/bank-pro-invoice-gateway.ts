import {
  getTaxTypeFromItems,
  InvoiceAllowanceState,
  InvoiceCarrierType,
  InvoiceGateway,
  InvoiceState,
  TaxType,
  verifyVatNumber,
} from '@rytass/invoice';
import axios from 'axios';
import { DateTime } from 'luxon';
import isEmail from 'validator/lib/isEmail';
import { BankProAllowance } from './bank-pro-allowance';
import { BankProInvoice } from './bank-pro-invoice';
import {
  BankProBaseUrls,
  BankProInvoiceGatewayOptions,
  BankProInvoiceIssueOptions,
  BankProInvoiceQueryArgs,
  BankProInvoiceQueryFromInvoiceNumberArgs,
  BankProInvoiceQueryFromOrderIdArgs,
  BankProInvoiceQueryResponse,
  BankProInvoiceStatus,
  BankProIssueInvoicePayload,
  BankProIssueInvoiceResponse,
  BankProPaymentItem,
  BankProQueryInvoiceByInvoiceNumberPayload,
  BankProQueryInvoiceByOrderNumberPayload,
  BankProRateType,
  BankProVoidAllowanceResponse,
  BankProVoidInvoiceResponse,
} from './typings';

export class BankProInvoiceGateway
  implements InvoiceGateway<BankProPaymentItem, BankProInvoice, BankProInvoiceQueryArgs>
{
  private readonly user: string = '80178859AP2AP';
  private readonly password: string = 'a80178859AP2AP';
  private readonly systemOID: number = 185;
  private readonly sellerBAN: string = '80178859';
  private readonly baseUrl: string = BankProBaseUrls.DEVELOPMENT;

  constructor(options: BankProInvoiceGatewayOptions) {
    this.user = options.user;
    this.password = options.password;
    this.systemOID = options.systemOID;
    this.sellerBAN = options.sellerBAN;
    this.baseUrl = options?.baseUrl || this.baseUrl;

    if (!verifyVatNumber(options.sellerBAN)) {
      throw new Error('Seller BAN should not be a valid VAT number');
    }
  }

  async issue(options: BankProInvoiceIssueOptions): Promise<BankProInvoice> {
    if (options.orderId.length > 40) {
      throw new Error('Order ID is too long, max: 40');
    }

    if (options.vatNumber && !verifyVatNumber(options.vatNumber)) {
      throw new Error('VAT number is invalid');
    }

    if (options.remark && options.remark.length > 100) {
      throw new Error('Remark is too long, max: 100');
    }

    if (options.buyerName && options.buyerName.length > 80) {
      throw new Error('Buyer name is too long, max: 80');
    }

    if (options.buyerZipCode && !/\d{1,5}/.test(options.buyerZipCode)) {
      throw new Error('Buyer zip code should be 1-5 digits');
    }

    if (options.buyerAddress && options.buyerAddress.length > 240) {
      throw new Error('Buyer address is too long, max: 240');
    }

    if (options.buyerMobile && options.buyerMobile.length > 20) {
      throw new Error('Buyer mobile is too long, max: 20');
    }

    if (options.items.some(item => item.name.length > 200)) {
      throw new Error('Item name is too long, max: 200');
    }

    if (options.items.some(item => item.unit && item.unit?.length > 6)) {
      throw new Error('Item unit is too long, max: 6');
    }

    if (options.items.some(item => item.quantity <= 0)) {
      throw new Error('Item quantity should more than zero');
    }

    if (options.items.some(item => item.remark && item.remark.length > 100)) {
      throw new Error('Item remark is too long, max: 100');
    }

    if (options.items.some(item => item.id && item.id.length > 40)) {
      throw new Error('Item ID is too long, max: 40');
    }

    if (options.items.some(item => item.spec && item.spec.length > 100)) {
      throw new Error('Item spec is too long, max: 100');
    }

    if (!isEmail(options.buyerEmail)) {
      throw new Error('Buyer email is invalid');
    }

    const taxType = getTaxTypeFromItems(options.items);

    const rateType = BankProRateType[taxType];

    if (!rateType) {
      throw new Error('Tax type not supported, you should split tax type in each invoice');
    }

    const amount = options.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    if (amount <= 0) {
      throw new Error('invoice amount should more than zero');
    }

    const date = DateTime.now().toFormat('yyyy/MM/dd');

    const carrierId = ((): string | undefined => {
      switch (options.carrier?.type) {
        case InvoiceCarrierType.MOBILE:
        case InvoiceCarrierType.MOICA:
          return options.carrier.code;

        default:
          return '';
      }
    })();

    const payload: BankProIssueInvoicePayload = {
      UserID: this.user,
      Pwd: this.password,
      SystemOID: this.systemOID,
      Orders: [
        {
          No: options.orderId,
          OrderStatus: BankProInvoiceStatus.CREATE,
          OrderDate: date,
          ExpectedShipDate: date,
          UpdateOrderDate: date,
          RateType: rateType,
          Amount: 0,
          TaxAmount: 0,
          TotalAmount: amount,
          SellerBAN: this.sellerBAN,
          SellerCode: options.sellerCode ?? '',
          BuyerBAN: options.vatNumber ?? '',
          BuyerCompanyName: options.companyName ?? '',
          PaperInvoiceMark: 'N',
          DonateMark: options.carrier?.type === InvoiceCarrierType.LOVE_CODE ? options.carrier.code : '',
          MainRemark: options.remark ?? '',
          CarrierType: ((): '3J0002' | 'CQ0001' | '' => {
            switch (options.carrier?.type) {
              case InvoiceCarrierType.MOBILE:
                return '3J0002';

              case InvoiceCarrierType.MOICA:
                return 'CQ0001';

              default:
                return '';
            }
          })(),
          CarrierId1: carrierId ?? '',
          CarrierId2: carrierId ?? '',
          RelateNumber1: '',
          RelateNumber2: '',
          RelateNumber3: '',
          Members: [
            {
              ID: [InvoiceCarrierType.MEMBER, undefined].indexOf(options.carrier?.type)
                ? options.buyerEmail
                : options.orderId,
              Name: options.buyerName ?? '',
              ZipCode: options.buyerZipCode ?? '',
              Address: options.buyerAddress ?? '',
              Tel: '',
              Mobilephone: options.buyerMobile ?? '',
              Email: options.buyerEmail,
            },
          ],
          OrderDetails: options.items.map((item, index) => ({
            SeqNo: (index + 1).toString(),
            ItemID: item.id ?? '',
            Barcode: item.barcode ?? '',
            ItemName: item.name,
            ItemSpec: item.spec ?? '',
            Unit: item.unit ?? '',
            UnitPrice: 0,
            Qty: item.quantity,
            Amount: 0,
            TaxAmount: 0,
            TotalAmount: (item.unitPrice * item.quantity).toString(),
            HealthAmount: 0,
            RateType: BankProRateType[(item.taxType as TaxType) ?? TaxType.TAXED],
            DiscountAmount: 0,
            DetailRemark: item.remark ?? '',
          })),
        },
      ],
    };

    const { data } = await axios.post<BankProIssueInvoiceResponse[]>(
      `${this.baseUrl}/B2B2CInvoice_AddOrders`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (data.length === 0) {
      throw new Error('Failed to issue invoice');
    }

    if (data.some(response => response.ErrorMessage)) {
      throw new Error(data.map(response => response.ErrorMessage).join(', '));
    }

    return new BankProInvoice({
      issuedOn: DateTime.fromFormat(data[0].InvoiceDate, 'yyyy/MM/dd HH:mm:ss').toJSDate(),
      items: options.items,
      randomCode: data[0].RandomNumber,
      invoiceNumber: data[0].InvoiceNo,
      orderId: options.orderId,
      taxType,
    });
  }

  async isMobileBarcodeValid(_code: string): Promise<boolean> {
    throw new Error('Bank Pro does not support mobile barcode validation');
  }

  async isLoveCodeValid(_code: string): Promise<boolean> {
    throw new Error('Bank Pro does not support love code validation');
  }

  public async void(invoice: BankProInvoice): Promise<BankProInvoice> {
    if (invoice.state !== InvoiceState.ISSUED) {
      throw new Error('Invoice is not issued');
    }

    const payload: BankProIssueInvoicePayload = {
      UserID: this.user,
      Pwd: this.password,
      SystemOID: this.systemOID,
      Orders: [
        {
          No: invoice.orderId,
          OrderStatus: BankProInvoiceStatus.DELETE,
          OrderDate: DateTime.fromJSDate(invoice.issuedOn).toFormat('yyyy/MM/dd'),
          ExpectedShipDate: DateTime.now().toFormat('yyyy/MM/dd'),
          UpdateOrderDate: DateTime.now().toFormat('yyyy/MM/dd'),
          RateType: BankProRateType[invoice.taxType],
          Amount: 0,
          TaxAmount: 0,
          TotalAmount: invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
          SellerBAN: this.sellerBAN,
          SellerCode: '',
          BuyerBAN: '',
          BuyerCompanyName: '',
          PaperInvoiceMark: 'N',
          DonateMark: '',
          MainRemark: '',
          CarrierType: '',
          CarrierId1: '',
          CarrierId2: '',
          RelateNumber1: '',
          RelateNumber2: '',
          RelateNumber3: '',
          Members: [
            {
              ID: '',
              Name: '',
              ZipCode: '',
              Address: '',
              Tel: '',
              Mobilephone: '',
              Email: '',
            },
          ],
          OrderDetails: invoice.items.map((item, index) => ({
            SeqNo: (index + 1).toString(),
            ItemID: item.id ?? '',
            Barcode: item.barcode ?? '',
            ItemName: item.name,
            ItemSpec: item.spec ?? '',
            Unit: item.unit ?? '',
            UnitPrice: 0,
            Qty: item.quantity,
            Amount: 0,
            TaxAmount: 0,
            TotalAmount: (item.unitPrice * item.quantity).toString(),
            HealthAmount: 0,
            RateType: BankProRateType[(item.taxType as TaxType) ?? TaxType.TAXED],
            DiscountAmount: 0,
            DetailRemark: item.remark ?? '',
          })),
        },
      ],
    };

    const { data } = await axios.post<BankProVoidInvoiceResponse[]>(
      `${this.baseUrl}/B2B2CInvoice_AddOrders`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (data.length === 0) {
      throw new Error('Failed to void invoice');
    }

    if (data.some(response => response.ErrorMessage)) {
      throw new Error(data.map(response => response.ErrorMessage).join(', '));
    }

    invoice.setVoid();

    return invoice;
  }

  public async allowance(invoice: BankProInvoice, allowanceItems: BankProPaymentItem[]): Promise<BankProInvoice> {
    if (invoice.state !== InvoiceState.ISSUED) {
      throw new Error('Invoice is not issued');
    }

    const allowanceAmount = allowanceItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    if (allowanceAmount <= 0) {
      throw new Error('Allowance amount should more than zero');
    }

    const payload: BankProIssueInvoicePayload = {
      UserID: this.user,
      Pwd: this.password,
      SystemOID: this.systemOID,
      Orders: [
        {
          No: invoice.orderId,
          OrderStatus: BankProInvoiceStatus.ALLOWANCE,
          OrderDate: DateTime.fromJSDate(invoice.issuedOn).toFormat('yyyy/MM/dd'),
          ExpectedShipDate: DateTime.now().toFormat('yyyy/MM/dd'),
          UpdateOrderDate: DateTime.now().toFormat('yyyy/MM/dd'),
          RateType: BankProRateType[invoice.taxType],
          Amount: 0,
          TaxAmount: 0,
          TotalAmount: allowanceAmount,
          SellerBAN: this.sellerBAN,
          SellerCode: '',
          BuyerBAN: '',
          BuyerCompanyName: '',
          PaperInvoiceMark: 'N',
          DonateMark: '',
          MainRemark: '',
          CarrierType: '',
          CarrierId1: '',
          CarrierId2: '',
          RelateNumber1: '',
          RelateNumber2: '',
          RelateNumber3: '',
          Members: [
            {
              ID: '',
              Name: '',
              ZipCode: '',
              Address: '',
              Tel: '',
              Mobilephone: '',
              Email: '',
            },
          ],
          OrderDetails: allowanceItems.map((item, index) => ({
            SeqNo: (index + 1).toString(),
            ItemID: item.id ?? '',
            Barcode: item.barcode ?? '',
            ItemName: item.name,
            ItemSpec: item.spec ?? '',
            Unit: item.unit ?? '',
            UnitPrice: 0,
            Qty: item.quantity,
            Amount: 0,
            TaxAmount: 0,
            TotalAmount: (item.unitPrice * item.quantity).toString(),
            HealthAmount: 0,
            RateType: BankProRateType[(item.taxType as TaxType) ?? TaxType.TAXED],
            DiscountAmount: 0,
            DetailRemark: item.remark ?? '',
          })),
        },
      ],
    };

    const { data } = await axios.post<BankProVoidAllowanceResponse[]>(
      `${this.baseUrl}/B2B2CInvoice_AddOrders`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (data.length === 0) {
      throw new Error('Failed to allowance invoice');
    }

    if (data.some(response => response.ErrorMessage)) {
      throw new Error(data.map(response => response.ErrorMessage).join(', '));
    }

    invoice.allowances.push(
      new BankProAllowance({
        allowanceNumber: data[0].AllowanceNo.trim(),
        allowancedOn: DateTime.fromFormat(data[0].AllowanceDate, 'yyyy/MM/dd HH:mm:ss').toJSDate(),
        allowancePrice: allowanceAmount,
        items: allowanceItems,
        status: InvoiceAllowanceState.ISSUED,
        invalidOn: null,
        parentInvoice: invoice,
      }),
    );

    return invoice;
  }

  async invalidAllowance(allowance: BankProAllowance): Promise<BankProInvoice> {
    if (allowance.status !== InvoiceAllowanceState.ISSUED) {
      throw new Error('Allowance is not issued');
    }

    const payload: BankProIssueInvoicePayload = {
      UserID: this.user,
      Pwd: this.password,
      SystemOID: this.systemOID,
      Orders: [
        {
          No: allowance.parentInvoice.orderId,
          OrderStatus: BankProInvoiceStatus.INVALID_ALLOWANCE,
          OrderDate: DateTime.fromJSDate(allowance.parentInvoice.issuedOn).toFormat('yyyy/MM/dd'),
          ExpectedShipDate: DateTime.now().toFormat('yyyy/MM/dd'),
          UpdateOrderDate: DateTime.now().toFormat('yyyy/MM/dd'),
          RateType: BankProRateType[allowance.parentInvoice.taxType],
          Amount: 0,
          TaxAmount: 0,
          TotalAmount: allowance.allowancePrice,
          SellerBAN: this.sellerBAN,
          SellerCode: '',
          BuyerBAN: '',
          BuyerCompanyName: '',
          PaperInvoiceMark: 'N',
          DonateMark: '',
          MainRemark: '',
          CarrierType: '',
          CarrierId1: '',
          CarrierId2: '',
          RelateNumber1: '',
          RelateNumber2: allowance.allowanceNumber,
          RelateNumber3: '',
          Members: [
            {
              ID: '',
              Name: '',
              ZipCode: '',
              Address: '',
              Tel: '',
              Mobilephone: '',
              Email: '',
            },
          ],
          OrderDetails: allowance.items.map((item, index) => ({
            SeqNo: (index + 1).toString(),
            ItemID: item.id ?? '',
            Barcode: item.barcode ?? '',
            ItemName: item.name,
            ItemSpec: item.spec ?? '',
            Unit: item.unit ?? '',
            UnitPrice: 0,
            Qty: item.quantity,
            Amount: 0,
            TaxAmount: 0,
            TotalAmount: (item.unitPrice * item.quantity).toString(),
            HealthAmount: 0,
            RateType: BankProRateType[(item.taxType as TaxType) ?? TaxType.TAXED],
            DiscountAmount: 0,
            DetailRemark: item.remark ?? '',
          })),
        },
      ],
    };

    const { data } = await axios.post<BankProVoidAllowanceResponse[]>(
      `${this.baseUrl}/B2B2CInvoice_AddOrders`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (data.length === 0) {
      throw new Error('Failed to allowance invoice');
    }

    if (data.some(response => response.ErrorMessage)) {
      throw new Error(data.map(response => response.ErrorMessage).join(', '));
    }

    allowance.invalidOn = DateTime.now().toJSDate();
    allowance.status = InvoiceAllowanceState.INVALID;

    return allowance.parentInvoice;
  }

  async query(options: BankProInvoiceQueryFromOrderIdArgs): Promise<BankProInvoice>;
  async query(options: BankProInvoiceQueryFromInvoiceNumberArgs): Promise<BankProInvoice>;
  async query(options: BankProInvoiceQueryArgs): Promise<BankProInvoice> {
    const payload =
      'invoiceNumber' in options
        ? ({
            UserID: this.user,
            Pwd: this.password,
            SystemOID: this.systemOID,
            InvoiceNo: 'invoiceNumber' in options ? options.invoiceNumber : undefined,
          } as BankProQueryInvoiceByInvoiceNumberPayload)
        : ({
            UserID: this.user,
            Pwd: this.password,
            SystemOID: this.systemOID,
            OrderNo: 'orderId' in options ? options.orderId : undefined,
          } as BankProQueryInvoiceByOrderNumberPayload);

    const { data } = await axios.post<BankProInvoiceQueryResponse[]>(
      `${this.baseUrl}/${'invoiceNumber' in options ? 'B2B2CInvoice_GetByInvoiceNo' : 'B2B2CInvoice_GetByOrderNo'}`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (data.length !== 1) throw new Error('Invoice not found');

    return new BankProInvoice({
      issuedOn: DateTime.fromFormat(data[0].InvoiceDate, 'yyyy/MM/dd').startOf('day').toJSDate(),
      items: data[0].InvoiceDetails.map(item => ({
        name: item.ProductName,
        unitPrice: Number(item.UnitPrice),
        quantity: Number(item.Qty),
      })),
      randomCode: data[0].RandomNumber,
      invoiceNumber: data[0].InvoiceNo,
      orderId: data[0].OrderNo,
      taxType: ((): TaxType => {
        switch (data[0].RateType) {
          case '零稅':
            return TaxType.ZERO_TAX;

          case '免稅':
            return TaxType.TAX_FREE;

          case '應稅':
          default:
            return TaxType.TAXED;
        }
      })(),
    });
  }
}
