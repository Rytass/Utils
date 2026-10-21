import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  TurnkeyCarrierType,
  TurnkeyCustomsClearance,
  TurnkeyDeliveryMode,
  TurnkeyInvoiceStatus,
  TurnkeyTaxType,
} from '@rytass/invoice-turnkey-base-nestjs-module';

@ObjectType('TurnkeyInvoiceItem')
export class TurnkeyInvoiceItemDto {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  sequenceNumber: number;

  @Field()
  description: string;

  @Field(() => Float)
  quantity: number;

  @Field(() => String, { nullable: true })
  unit: string | null;

  @Field(() => Float)
  unitPrice: number;

  @Field(() => Float)
  amount: number;

  @Field(() => TurnkeyTaxType)
  taxType: TurnkeyTaxType;

  @Field(() => String, { nullable: true })
  remark: string | null;
}

@ObjectType('TurnkeyInvoice')
export class TurnkeyInvoiceDto {
  @Field(() => ID)
  id: string;

  @Field()
  companyTaxId: string;

  @Field()
  invoiceNumber: string;

  @Field(() => String, { nullable: true })
  externalId: string | null;

  @Field(() => TurnkeyDeliveryMode)
  deliveryMode: TurnkeyDeliveryMode;

  @Field(() => TurnkeyInvoiceStatus)
  status: TurnkeyInvoiceStatus;

  @Field()
  issuedAt: Date;

  @Field()
  buyerTaxId: string;

  @Field()
  buyerName: string;

  @Field(() => String, { nullable: true })
  buyerAddress: string | null;

  @Field(() => TurnkeyTaxType)
  taxType: TurnkeyTaxType;

  @Field(() => Float)
  taxRate: number;

  @Field(() => Float)
  salesAmount: number;

  @Field(() => Float)
  taxFreeSalesAmount: number;

  @Field(() => Float)
  zeroRatedSalesAmount: number;

  @Field(() => Float)
  taxAmount: number;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => TurnkeyCarrierType, { nullable: true })
  carrierType: TurnkeyCarrierType | null;

  @Field(() => String, { nullable: true })
  carrierCode: string | null;

  @Field(() => String, { nullable: true })
  carrierHiddenCode: string | null;

  @Field(() => String, { nullable: true })
  carrierTypeCode: string | null;

  @Field(() => String, { nullable: true })
  npoCode: string | null;

  @Field()
  printed: boolean;

  @Field(() => String, { nullable: true })
  randomNumber: string | null;

  @Field(() => String, { nullable: true })
  zeroRatedReasonCode: string | null;

  @Field(() => TurnkeyCustomsClearance, { nullable: true })
  customsClearance: TurnkeyCustomsClearance | null;

  @Field(() => String, { nullable: true })
  mainRemark: string | null;

  @Field(() => Date, { nullable: true })
  voidedAt: Date | null;

  @Field(() => String, { nullable: true })
  voidReason: string | null;

  @Field(() => [TurnkeyInvoiceItemDto])
  items: TurnkeyInvoiceItemDto[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
