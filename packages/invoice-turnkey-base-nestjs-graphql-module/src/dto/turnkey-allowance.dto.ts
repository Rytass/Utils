import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  TurnkeyAllowanceStatus,
  TurnkeyDeliveryMode,
  TurnkeyTaxType,
} from '@rytass/invoice-turnkey-base-nestjs-module';

@ObjectType('TurnkeyAllowanceItem')
export class TurnkeyAllowanceItemDto {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  sequenceNumber: number;

  @Field(() => Int, { nullable: true })
  originalSequenceNumber: number | null;

  @Field()
  description: string;

  @Field(() => Float)
  quantity: number;

  @Field(() => Float)
  unitPrice: number;

  @Field(() => Float)
  amount: number;

  @Field(() => Float)
  tax: number;

  @Field(() => TurnkeyTaxType)
  taxType: TurnkeyTaxType;
}

@ObjectType('TurnkeyAllowance')
export class TurnkeyAllowanceDto {
  @Field(() => ID)
  id: string;

  @Field()
  companyTaxId: string;

  @Field()
  allowanceNumber: string;

  @Field(() => String, { nullable: true })
  externalId: string | null;

  @Field()
  invoiceNumber: string;

  @Field(() => TurnkeyDeliveryMode)
  deliveryMode: TurnkeyDeliveryMode;

  @Field(() => TurnkeyAllowanceStatus)
  status: TurnkeyAllowanceStatus;

  @Field()
  allowanceDate: Date;

  @Field()
  buyerTaxId: string;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => Float)
  taxAmount: number;

  @Field(() => Date, { nullable: true })
  voidedAt: Date | null;

  @Field(() => String, { nullable: true })
  voidReason: string | null;

  @Field(() => [TurnkeyAllowanceItemDto])
  items: TurnkeyAllowanceItemDto[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
