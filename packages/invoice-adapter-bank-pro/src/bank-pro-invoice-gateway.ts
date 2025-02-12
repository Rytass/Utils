import {
  getTaxTypeFromItems,
  InvoiceAllowanceState,
  InvoiceCarrierType,
  InvoiceGateway,
  InvoiceState,
  TaxType,
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
  BankProInvoicePosIssueOptions,
  BankProInvoiceQueryArgs,
  BankProInvoiceQueryFromInvoiceNumberArgs,
  BankProInvoiceQueryFromOrderIdArgs,
  BankProInvoiceQueryResponse,
  BankProInvoiceStatus,
  BankProIssueInvoicePayload,
  BankProIssueInvoiceResponse,
  BankProPaymentItem,
  BankProPosDetailPayload,
  BankProPosMainPayload,
  BankProQueryInvoiceByInvoiceNumberPayload,
  BankProQueryInvoiceByOrderNumberPayload,
  BankProRateType,
  BankProVoidAllowanceResponse,
  BankProVoidInvoiceResponse,
} from './typings';

export class BankProInvoiceGateway
  implements
    InvoiceGateway<BankProPaymentItem, BankProInvoice, BankProInvoiceQueryArgs>
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

    if (!/^\d{8}$/.test(options.sellerBAN)) {
      throw new Error('Seller BAN should be 8 digits');
    }
  }

  async issue(options: BankProInvoiceIssueOptions): Promise<BankProInvoice> {
    const { payload, taxType } = this.prepareIssuePayload(options);

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

    if (data.some((response) => response.ErrorMessage)) {
      throw new Error(data.map((response) => response.ErrorMessage).join(', '));
    }

    return new BankProInvoice({
      issuedOn: DateTime.fromFormat(data[0].InvoiceDate, 'yyyy/MM/dd HH:mm:ss')
        .startOf('day')
        .toJSDate(),
      items: options.items,
      randomCode: data[0].RandomNumber,
      invoiceNumber: data[0].InvoiceNo,
      orderId: options.orderId,
      taxType,
    });
  }

  posIssue(options: BankProInvoicePosIssueOptions): string {
    const { payload } = this.prepareIssuePayload(options);

    if (payload.Orders[0].CarrierType !== '') {
      throw new Error('Carrier information is not supported for POS invoice');
    }

    if (options.storeCode.length > 5) {
      throw new Error('Store code is too long, max: 5');
    }

    if (options.storeName.length > 20) {
      throw new Error('Store name is too long, max: 20');
    }

    if (options.registerCode.length > 5) {
      throw new Error('Register code is too long, max: 5');
    }

    const mainPayload: BankProPosMainPayload = {
      FileType: 'M',
      State: '1',
      SellerBAN: this.sellerBAN,
      StoreCode: options.storeCode,
      StoreName: options.storeName,
      RegisterCode: options.registerCode,
      OrderNo: options.orderId,
      InvoiceNo: '',
      InvoiceDate: DateTime.fromJSDate(options.issueAt).toFormat(
        'yyyy/MM/dd HH:mm:ss',
      ),
      AllowanceDate: '',
      BuyerBAN: payload.Orders[0].BuyerBAN,
      PrintMark: 'N',
      MemberId: '',
      GroupMark: '',
      SalesAmt: '',
      FreeTaxSalesAmt: '',
      ZeroTaxSalesAmt: '',
      TaxAmt: '',
      TotalAmt: payload.Orders[0].TotalAmount,
      TaxType: payload.Orders[0].RateType,
      TaxRate: '0.05',
      CarrierType: '',
      CarrierId1: '',
      CarrierId2: '',
      NpoBan: '',
      RandomNumber: '',
      MainRemark: '',
      Buyer: '',
      CancelReason: '',
      ReturnTaxDocumentNo: '',
      Remark: '',
    };

    const mainSequence: { [key: number]: keyof BankProPosMainPayload } = {
      1: 'FileType',
      2: 'State',
      3: 'SellerBAN',
      4: 'StoreCode',
      5: 'StoreName',
      6: 'RegisterCode',
      7: 'OrderNo',
      8: 'InvoiceNo',
      9: 'InvoiceDate',
      10: 'AllowanceDate',
      11: 'BuyerBAN',
      12: 'PrintMark',
      13: 'MemberId',
      14: 'GroupMark',
      15: 'SalesAmt',
      16: 'FreeTaxSalesAmt',
      17: 'ZeroTaxSalesAmt',
      18: 'TaxAmt',
      19: 'TotalAmt',
      20: 'TaxType',
      21: 'TaxRate',
      22: 'CarrierType',
      23: 'CarrierId1',
      24: 'CarrierId2',
      25: 'NpoBan',
      26: 'RandomNumber',
      27: 'MainRemark',
      28: 'Buyer',
      29: 'CancelReason',
      30: 'ReturnTaxDocumentNo',
      31: 'Remark',
    };

    const detailPayloads =
      payload.Orders[0].OrderDetails.map<BankProPosDetailPayload>((item) => ({
        FileType: 'D',
        SequenceNo: item.SeqNo,
        ItemName: item.ItemName,
        Qty: item.Qty,
        Unit: item.Unit,
        UnitPrice: item.UnitPrice,
        SalesAmt: '',
        TaxAmt: '',
        TotalAmt: item.TotalAmount,
        RelatedNumber: '',
        Remark: item.DetailRemark,
      }));

    const detailSequence: { [key: number]: keyof BankProPosDetailPayload } = {
      1: 'FileType',
      2: 'SequenceNo',
      3: 'ItemName',
      4: 'Qty',
      5: 'Unit',
      6: 'UnitPrice',
      7: 'SalesAmt',
      8: 'TaxAmt',
      9: 'TotalAmt',
      10: 'RelatedNumber',
      11: 'Remark',
    };

    const sortedDetailSequence = Object.keys(detailSequence).sort(
      (a, b) => Number(a) - Number(b),
    );

    const main = Object.keys(mainSequence)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => mainPayload[mainSequence[Number(key)]])
      .join('|');

    const details = detailPayloads.map((detail) =>
      sortedDetailSequence
        .map((key) => detail[detailSequence[Number(key)]])
        .join('|'),
    );

    return [main, ...details].join('\n');
  }

  posVoid(): string {
    throw new Error('Bank Pro does not support POS void');
  }

  async isMobileBarcodeValid(code: string): Promise<boolean> {
    throw new Error('Bank Pro does not support mobile barcode validation');
  }

  async isLoveCodeValid(code: string): Promise<boolean> {
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
          OrderDate: DateTime.fromJSDate(invoice.issuedOn).toFormat(
            'yyyy/MM/dd',
          ),
          ExpectedShipDate: DateTime.now().toFormat('yyyy/MM/dd'),
          UpdateOrderDate: DateTime.now().toFormat('yyyy/MM/dd'),
          RateType: BankProRateType[invoice.taxType],
          Amount: 0,
          TaxAmount: 0,
          TotalAmount: invoice.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0,
          ),
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
            RateType:
              BankProRateType[(item.taxType as TaxType) ?? TaxType.TAXED],
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

    if (data.some((response) => response.ErrorMessage)) {
      throw new Error(data.map((response) => response.ErrorMessage).join(', '));
    }

    invoice.setVoid();

    return invoice;
  }

  public async allowance(
    invoice: BankProInvoice,
    allowanceItems: BankProPaymentItem[],
  ): Promise<BankProInvoice> {
    if (invoice.state !== InvoiceState.ISSUED) {
      throw new Error('Invoice is not issued');
    }

    const allowanceAmount = allowanceItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

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
          OrderDate: DateTime.fromJSDate(invoice.issuedOn).toFormat(
            'yyyy/MM/dd',
          ),
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
            RateType:
              BankProRateType[(item.taxType as TaxType) ?? TaxType.TAXED],
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

    if (data.some((response) => response.ErrorMessage)) {
      throw new Error(data.map((response) => response.ErrorMessage).join(', '));
    }

    invoice.allowances.push(
      new BankProAllowance({
        allowanceNumber: data[0].AllowanceNo.trim(),
        allowancedOn: DateTime.fromFormat(
          data[0].AllowanceDate,
          'yyyy/MM/dd HH:mm:ss',
        ).toJSDate(),
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
          OrderDate: DateTime.fromJSDate(
            allowance.parentInvoice.issuedOn,
          ).toFormat('yyyy/MM/dd'),
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
            RateType:
              BankProRateType[(item.taxType as TaxType) ?? TaxType.TAXED],
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

    if (data.some((response) => response.ErrorMessage)) {
      throw new Error(data.map((response) => response.ErrorMessage).join(', '));
    }

    allowance.invalidOn = DateTime.now().toJSDate();
    allowance.status = InvoiceAllowanceState.INVALID;

    return allowance.parentInvoice;
  }

  async query(
    options: BankProInvoiceQueryFromOrderIdArgs,
  ): Promise<BankProInvoice>;
  async query(
    options: BankProInvoiceQueryFromInvoiceNumberArgs,
  ): Promise<BankProInvoice>;
  async query(options: BankProInvoiceQueryArgs): Promise<BankProInvoice> {
    const payload =
      'invoiceNumber' in options
        ? ({
            UserID: this.user,
            Pwd: this.password,
            SystemOID: this.systemOID,
            InvoiceNo:
              'invoiceNumber' in options ? options.invoiceNumber : undefined,
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
      issuedOn: DateTime.fromFormat(data[0].InvoiceDate, 'yyyy/MM/dd')
        .startOf('day')
        .toJSDate(),
      items: data[0].InvoiceDetails.map((item) => ({
        name: item.ProductName,
        unitPrice: Number(item.UnitPrice),
        quantity: Number(item.Qty),
      })),
      randomCode: data[0].RandomNumber,
      invoiceNumber: data[0].InvoiceNo,
      orderId: data[0].OrderNo,
      taxType: (() => {
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

  private prepareIssuePayload(
    options: BankProInvoiceIssueOptions | BankProInvoicePosIssueOptions,
  ) {
    const isPosIssue = (
      options: BankProInvoiceIssueOptions | BankProInvoicePosIssueOptions,
    ): options is BankProInvoicePosIssueOptions => {
      return 'registerCode' in options;
    };

    if (!isPosIssue(options)) {
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

      if (!isEmail(options.buyerEmail)) {
        throw new Error('Buyer email is invalid');
      }

      if (options.vatNumber && !options.buyerAddress) {
        throw new Error('Company invoice buyerAddress is required');
      }
    }

    if (options.orderId.length > 40) {
      throw new Error('Order ID is too long, max: 40');
    }

    if (options.vatNumber && !/^\d{8}$/.test(options.vatNumber)) {
      throw new Error('VAT number should be 8 digits');
    }

    if (options.remark && options.remark.length > 100) {
      throw new Error('Remark is too long, max: 100');
    }

    if (options.items.some((item) => item.name.length > 200)) {
      throw new Error('Item name is too long, max: 200');
    }

    if (options.items.some((item) => item.unit && item.unit?.length > 6)) {
      throw new Error('Item unit is too long, max: 6');
    }

    if (options.items.some((item) => item.quantity <= 0)) {
      throw new Error('Item quantity should more than zero');
    }

    if (options.items.some((item) => item.remark && item.remark.length > 100)) {
      throw new Error('Item remark is too long, max: 100');
    }

    if (options.items.some((item) => item.id && item.id.length > 40)) {
      throw new Error('Item ID is too long, max: 40');
    }

    if (options.items.some((item) => item.spec && item.spec.length > 100)) {
      throw new Error('Item spec is too long, max: 100');
    }

    const taxType = getTaxTypeFromItems(options.items);

    const rateType = BankProRateType[taxType];

    if (!rateType) {
      throw new Error(
        'Tax type not supported, you should split tax type in each invoice',
      );
    }

    const amount = options.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

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
          DonateMark:
            options.carrier?.type === InvoiceCarrierType.LOVE_CODE
              ? options.carrier.code
              : '',
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
          Members: isPosIssue(options)
            ? []
            : [
                {
                  ID: [InvoiceCarrierType.MEMBER, undefined].indexOf(
                    options.carrier?.type,
                  )
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
            UnitPrice: item.unitPrice,
            Qty: item.quantity,
            Amount: 0,
            TaxAmount: 0,
            TotalAmount: (item.unitPrice * item.quantity).toString(),
            HealthAmount: 0,
            RateType:
              BankProRateType[(item.taxType as TaxType) ?? TaxType.TAXED],
            DiscountAmount: 0,
            DetailRemark: item.remark ?? '',
          })),
        },
      ],
    };

    return {
      payload,
      taxType,
    };
  }
}
