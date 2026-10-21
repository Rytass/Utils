import { Field, Float, InputType, Int } from '@nestjs/graphql';
import {
  TurnkeyCarrierType,
  TurnkeyCustomsClearance,
  TurnkeyDeliveryMode,
  TurnkeyTaxType,
} from '@rytass/invoice-turnkey-base-nestjs-module';

@InputType('TurnkeyBuyerInput')
export class TurnkeyBuyerInput {
  /** 消費者不填 */
  @Field(() => String, { nullable: true })
  taxId?: string | null;

  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => String, { nullable: true })
  address?: string | null;
}

@InputType('TurnkeyInvoiceItemInput')
export class TurnkeyInvoiceItemInput {
  @Field()
  description: string;

  @Field(() => Float)
  quantity: number;

  /** B2B 為未稅單價；B2C 為含稅單價 */
  @Field(() => Float)
  unitPrice: number;

  /** MIXED 不可用於明細，送出會回 TAX_TYPE_NOT_ALLOWED */
  @Field(() => TurnkeyTaxType)
  taxType: TurnkeyTaxType;

  @Field(() => Float, { nullable: true })
  amount?: number | null;

  @Field(() => String, { nullable: true })
  unit?: string | null;

  @Field(() => String, { nullable: true })
  remark?: string | null;
}

@InputType('TurnkeyCarrierInput')
export class TurnkeyCarrierInput {
  @Field(() => TurnkeyCarrierType)
  type: TurnkeyCarrierType;

  @Field()
  code: string;

  @Field(() => String, { nullable: true })
  hiddenCode?: string | null;

  @Field(() => String, { nullable: true })
  typeCode?: string | null;
}

@InputType('TurnkeyDonationInput')
export class TurnkeyDonationInput {
  @Field()
  npoCode: string;
}

@InputType('TurnkeyZeroRatedInput')
export class TurnkeyZeroRatedInput {
  /** 71–79 */
  @Field()
  reasonCode: string;

  @Field(() => TurnkeyCustomsClearance)
  customsClearance: TurnkeyCustomsClearance;
}

@InputType('IssueTurnkeyInvoiceInput')
export class IssueTurnkeyInvoiceInput {
  @Field(() => TurnkeyDeliveryMode)
  deliveryMode: TurnkeyDeliveryMode;

  @Field(() => String, { nullable: true })
  externalId?: string | null;

  @Field(() => TurnkeyBuyerInput, { nullable: true })
  buyer?: TurnkeyBuyerInput | null;

  @Field(() => [TurnkeyInvoiceItemInput])
  items: TurnkeyInvoiceItemInput[];

  /** ISO 8601，省略時為現在 */
  @Field(() => String, { nullable: true })
  issuedAt?: string | null;

  @Field(() => TurnkeyCarrierInput, { nullable: true })
  carrier?: TurnkeyCarrierInput | null;

  @Field(() => TurnkeyDonationInput, { nullable: true })
  donation?: TurnkeyDonationInput | null;

  @Field(() => Boolean, { nullable: true })
  printed?: boolean | null;

  @Field(() => TurnkeyZeroRatedInput, { nullable: true })
  zeroRated?: TurnkeyZeroRatedInput | null;

  /** 課稅別 SPECIAL 時使用，例如 0.25 */
  @Field(() => Float, { nullable: true })
  specialTaxRate?: number | null;

  @Field(() => String, { nullable: true })
  mainRemark?: string | null;
}

@InputType('VoidTurnkeyInvoiceInput')
export class VoidTurnkeyInvoiceInput {
  /** 最多 20 字 */
  @Field()
  reason: string;

  @Field(() => String, { nullable: true })
  remark?: string | null;
}

@InputType('TurnkeyAllowanceItemInput')
export class TurnkeyAllowanceItemInput {
  /** 對應原發票明細序號；省略時以品名比對 */
  @Field(() => Int, { nullable: true })
  originalSequenceNumber?: number | null;

  @Field()
  description: string;

  @Field(() => Float)
  quantity: number;

  /** 金額慣例同原發票：B2B 未稅、B2C 含稅 */
  @Field(() => Float)
  unitPrice: number;

  /** MIXED 不可用於明細 */
  @Field(() => TurnkeyTaxType)
  taxType: TurnkeyTaxType;

  @Field(() => Float, { nullable: true })
  amount?: number | null;
}

@InputType('IssueTurnkeyAllowanceInput')
export class IssueTurnkeyAllowanceInput {
  @Field()
  invoiceNumber: string;

  @Field(() => String, { nullable: true })
  externalId?: string | null;

  /** 自訂折讓單號（最多 16 碼）；省略時自動產生 */
  @Field(() => String, { nullable: true })
  allowanceNumber?: string | null;

  /** ISO 8601，省略時為現在 */
  @Field(() => String, { nullable: true })
  allowanceDate?: string | null;

  @Field(() => [TurnkeyAllowanceItemInput])
  items: TurnkeyAllowanceItemInput[];
}

@InputType('RegisterTurnkeyInvoiceTrackInput')
export class RegisterTurnkeyInvoiceTrackInput {
  /** 民國年 3 碼＋雙數月，例如 11510 */
  @Field()
  period: string;

  /** 2 碼大寫英文，例如 LP */
  @Field()
  track: string;

  @Field()
  beginNumber: string;

  @Field()
  endNumber: string;
}

@InputType()
export class AnnulTurnkeyInvoiceInput {
  @Field()
  reason: string;

  @Field(() => String, { nullable: true })
  remark?: string | null;
}

/** 確認收到的文件（確認發票、確認作廢、確認折讓、確認折讓作廢）；reason 可省略 */
@InputType()
export class TurnkeyReceivedReplyInput {
  @Field(() => String, { nullable: true })
  reason?: string | null;

  @Field(() => String, { nullable: true })
  remark?: string | null;
}

/** 退回發票時 reason 必填（同 base 的 rejectInvoice 規則） */
@InputType()
export class RejectTurnkeyReceivedInvoiceInput {
  @Field()
  reason: string;

  @Field(() => String, { nullable: true })
  remark?: string | null;
}
