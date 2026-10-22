import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

/** 營業人資料：不含 QR Code 金鑰，只標示是否已設定 */
@ObjectType('TurnkeyCompany')
export class TurnkeyCompanyDto {
  /** 統編，供 Apollo Client 正規化快取 */
  @Field(() => ID)
  id: string;

  @Field()
  taxId: string;

  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  address: string | null;

  /** Turnkey 送方設定的繞送代碼 */
  @Field()
  routingId: string;

  @Field()
  exchangeEnabled: boolean;

  @Field(() => Date, { nullable: true })
  certificateExpiresAt: Date | null;

  @Field()
  qrAesKeyConfigured: boolean;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@InputType('RegisterTurnkeyCompanyInput')
export class RegisterTurnkeyCompanyInput {
  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  address?: string | null;

  @Field()
  routingId: string;

  /** 是否開立 B2B 交換發票（EXCHANGE） */
  @Field(() => Boolean, { nullable: true })
  exchangeEnabled?: boolean | null;

  /** 軟體憑證到期日；未設定時不會發 certificate.expiring */
  @Field(() => Date, { nullable: true })
  certificateExpiresAt?: Date | null;
}
