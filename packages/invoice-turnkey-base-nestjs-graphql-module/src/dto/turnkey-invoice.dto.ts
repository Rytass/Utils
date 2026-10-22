import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  TurnkeyCarrierType,
  TurnkeyCustomsClearance,
  TurnkeyDeliveryMode,
  TurnkeyInvoiceStatus,
  TurnkeySubmissionStatus,
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

/** 列表用的發票摘要，不含明細；與 TurnkeyInvoice 是不同型別，Apollo 快取不會互相覆蓋 */
@ObjectType('TurnkeyInvoiceSummary')
export class TurnkeyInvoiceSummaryDto {
  /** 與 TurnkeyInvoice.id 相同 */
  @Field(() => ID)
  id: string;

  @Field()
  companyTaxId: string;

  @Field()
  invoiceNumber: string;

  @Field(() => String, { nullable: true })
  externalId: string | null;

  /** STORAGE 為存證（F0401），EXCHANGE 為交換（A0101） */
  @Field(() => TurnkeyDeliveryMode)
  deliveryMode: TurnkeyDeliveryMode;

  @Field(() => TurnkeyInvoiceStatus)
  status: TurnkeyInvoiceStatus;

  /** 發票日期 */
  @Field()
  issuedAt: Date;

  @Field()
  buyerTaxId: string;

  @Field()
  buyerName: string;

  @Field(() => TurnkeyTaxType)
  taxType: TurnkeyTaxType;

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

  @Field(() => Date, { nullable: true })
  voidedAt: Date | null;

  /** 這張發票最新一筆送件（開立、作廢、註銷等）的狀態 */
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

@ObjectType('TurnkeyInvoiceCollection')
export class TurnkeyInvoiceCollectionDto {
  /** 由實際套用的查詢條件組成，同一查詢得到同一個 id */
  @Field(() => ID)
  id: string;

  /** 符合條件的總筆數（不受 limit／offset 影響） */
  @Field(() => Int)
  total: number;

  @Field(() => [TurnkeyInvoiceSummaryDto])
  items: TurnkeyInvoiceSummaryDto[];
}
