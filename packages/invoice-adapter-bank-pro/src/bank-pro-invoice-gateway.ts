import {
  getTaxTypeFromItems,
  InvoiceCarrierType,
  InvoiceGateway,
  TaxType,
} from '@rytass/invoice';
import { DateTime } from 'luxon';
import isEmail from 'validator/lib/isEmail';
import { BankProInvoice } from './bank-pro-invoice';
import {
  BankProBaseUrls,
  BankProInvoiceGatewayOptions,
  BankProInvoiceIssueOptions,
  BankProInvoiceQueryArgs,
  BankProInvoiceQueryFromInvoiceNumberArgs,
  BankProInvoiceQueryFromOrderIdArgs,
  BankProInvoiceStatus,
  BankProIssueInvoicePayload,
  BankProIssueInvoiceResponse,
  BankProPaymentItem,
  BankProRateType,
} from './typings';
import { BadRequestException } from '@nestjs/common';
import axios from 'axios';

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
      throw new BadRequestException('Seller BAN should be 8 digits');
    }
  }

  async issue(options: BankProInvoiceIssueOptions): Promise<BankProInvoice> {
    if (options.orderId.length > 40) {
      throw new BadRequestException('Order ID is too long, max: 40');
    }

    if (options.vatNumber && !/^\d{8}$/.test(options.vatNumber)) {
      throw new BadRequestException('VAT number should be 8 digits');
    }

    if (options.remark && options.remark.length > 100) {
      throw new BadRequestException('Remark is too long, max: 100');
    }

    if (options.buyerName && options.buyerName.length > 80) {
      throw new BadRequestException('Buyer name is too long, max: 80');
    }

    if (options.buyerZipCode && !/\d{1,5}/.test(options.buyerZipCode)) {
      throw new BadRequestException('Buyer zip code should be 1-5 digits');
    }

    if (options.buyerAddress && options.buyerAddress.length > 240) {
      throw new BadRequestException('Buyer address is too long, max: 240');
    }

    if (options.buyerMobile && options.buyerMobile.length > 20) {
      throw new BadRequestException('Buyer mobile is too long, max: 20');
    }

    if (options.items.some((item) => item.name.length > 200)) {
      throw new BadRequestException('Item name is too long, max: 200');
    }

    if (options.items.some((item) => item.unit && item.unit?.length > 6)) {
      throw new BadRequestException('Item unit is too long, max: 6');
    }

    if (options.items.some((item) => item.quantity <= 0)) {
      throw new BadRequestException('Item quantity should more than zero');
    }

    if (options.items.some((item) => item.unitPrice <= 0)) {
      throw new BadRequestException('Item unit price should more than zero');
    }

    if (options.items.some((item) => item.remark && item.remark.length > 100)) {
      throw new BadRequestException('Item remark is too long, max: 100');
    }

    if (options.items.some((item) => item.id && item.id.length > 40)) {
      throw new BadRequestException('Item ID is too long, max: 40');
    }

    if (options.items.some((item) => item.spec && item.spec.length > 100)) {
      throw new BadRequestException('Item spec is too long, max: 100');
    }

    if (!isEmail(options.buyerEmail)) {
      throw new BadRequestException('Buyer email is invalid');
    }

    const taxType = getTaxTypeFromItems(options.items);

    const rateType = BankProRateType[taxType];

    if (!rateType) {
      throw new BadRequestException(
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
          return undefined;
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
          SellerCode: options.sellerCode ?? undefined,
          BuyerBAN: options.vatNumber ?? undefined,
          BuyerCompanyName: options.companyName ?? undefined,
          PaperInvoiceMark: 'N',
          DonateMark:
            options.carrier?.type === InvoiceCarrierType.LOVE_CODE
              ? options.carrier.code
              : undefined,
          MainRemark: options.remark ?? undefined,
          CarrierType: ((): '3J0002' | 'CQ0001' | undefined => {
            switch (options.carrier?.type) {
              case InvoiceCarrierType.MOBILE:
                return '3J0002';

              case InvoiceCarrierType.MOICA:
                return 'CQ0001';

              default:
                return undefined;
            }
          })(),
          CarrierId1: carrierId,
          CarrierId2: carrierId,
          Members: [
            {
              ID: [InvoiceCarrierType.MEMBER, undefined].indexOf(
                options.carrier?.type,
              )
                ? options.buyerEmail
                : options.orderId,
              Name: options.buyerName ?? undefined,
              ZipCode: options.buyerZipCode ?? undefined,
              Address: options.buyerAddress ?? undefined,
              Mobilephone: options.buyerMobile ?? undefined,
              Email: options.buyerEmail,
            },
          ],
          OrderDetails: options.items.map((item, index) => ({
            SeqNo: (index + 1).toString(),
            ItemID: item.id ?? undefined,
            Barcode: item.barcode ?? undefined,
            ItemName: item.name,
            ItemSpec: item.spec ?? undefined,
            Unit: item.unit ?? undefined,
            UnitPrice: item.unitPrice,
            Qty: item.quantity,
            TotalAmount: (item.unitPrice * item.quantity).toString(),
            RateType:
              BankProRateType[(item.taxType as TaxType) ?? TaxType.TAXED],
            DetailRemark: item.remark ?? undefined,
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
      throw new BadRequestException('Failed to issue invoice');
    }

    if (data.some((response) => response.ErrorMessage)) {
      throw new BadRequestException(
        data.map((response) => response.ErrorMessage).join(', '),
      );
    }

    return new BankProInvoice({
      issuedOn: DateTime.fromFormat(data[0].InvoiceDate, 'yyyy/MM/dd')
        .startOf('day')
        .toJSDate(),
      items: options.items,
      randomCode: data[0].RandomNumber,
      invoiceNumber: data[0].InvoiceNo,
      orderId: options.orderId,
      taxType,
    });
  }

  async isMobileBarcodeValid(code: string): Promise<boolean> {
    throw new BadRequestException(
      'Bank Pro does not support mobile barcode validation',
    );
  }

  async isLoveCodeValid(code: string): Promise<boolean> {
    throw new BadRequestException(
      'Bank Pro does not support love code validation',
    );
  }

  public async void(invoice: BankProInvoice): Promise<BankProInvoice> {
    throw new BadRequestException('Bank Pro does not support voiding invoice');
  }

  public async allowance(invoice: BankProInvoice): Promise<BankProInvoice> {
    throw new BadRequestException(
      'Bank Pro does not support allowance invoice',
    );
  }

  async invalidAllowance(): Promise<BankProInvoice> {
    throw new BadRequestException(
      'Bank Pro does not support invalid allowance',
    );
  }

  async query(
    options: BankProInvoiceQueryFromOrderIdArgs,
  ): Promise<BankProInvoice>;
  async query(
    options: BankProInvoiceQueryFromInvoiceNumberArgs,
  ): Promise<BankProInvoice>;
  async query(options: BankProInvoiceQueryArgs): Promise<BankProInvoice> {
    throw new BadRequestException('Bank Pro does not support query invoice');
  }
}
