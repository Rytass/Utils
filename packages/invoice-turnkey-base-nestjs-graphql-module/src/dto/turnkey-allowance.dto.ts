import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  TurnkeyAllowanceStatus,
  TurnkeyDeliveryMode,
  TurnkeySubmissionStatus,
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

/** 列表用的折讓摘要，不含明細；與 TurnkeyAllowance 是不同型別，Apollo 快取不會互相覆蓋 */
@ObjectType('TurnkeyAllowanceSummary')
export class TurnkeyAllowanceSummaryDto {
  /** 與 TurnkeyAllowance.id 相同 */
  @Field(() => ID)
  id: string;

  @Field()
  companyTaxId: string;

  @Field()
  allowanceNumber: string;

  @Field(() => String, { nullable: true })
  externalId: string | null;

  /** 原發票號碼 */
  @Field()
  invoiceNumber: string;

  /** STORAGE 為存證（G0401），EXCHANGE 為交換（B0101） */
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

  /** 這張折讓最新一筆送件（開立或作廢）的狀態 */
  @Field(() => TurnkeySubmissionStatus, { nullable: true })
  lastSubmissionStatus: TurnkeySubmissionStatus | null;

  /** 最新一筆送件被拒或失敗時的錯誤碼；之後重送成功就是 null */
  @Field(() => String, { nullable: true })
  lastErrorCode: string | null;

  @Field(() => String, { nullable: true })
  lastErrorMessage: string | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType('TurnkeyAllowanceCollection')
export class TurnkeyAllowanceCollectionDto {
  /** 由實際套用的查詢條件組成，同一查詢得到同一個 id */
  @Field(() => ID)
  id: string;

  /** 符合條件的總筆數（不受 limit／offset 影響） */
  @Field(() => Int)
  total: number;

  @Field(() => [TurnkeyAllowanceSummaryDto])
  items: TurnkeyAllowanceSummaryDto[];
}
