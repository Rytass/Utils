import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { TurnkeyTrackSource } from '@rytass/invoice-turnkey-base-nestjs-module';

@ObjectType('TurnkeyInvoiceTrack')
export class TurnkeyInvoiceTrackDto {
  @Field(() => ID)
  id: string;

  @Field()
  companyTaxId: string;

  /** 期別，民國年 3 碼＋雙數月，例如 11510 */
  @Field()
  period: string;

  @Field()
  track: string;

  @Field()
  beginNumber: string;

  @Field()
  endNumber: string;

  /** 同期別尚未取號的剩餘數量 */
  @Field(() => Int, { nullable: true })
  remaining: number | null;

  /** 這條字軌尚未取號的數量；冪等重送舊版回應時可能為 null */
  @Field(() => Int, { nullable: true })
  trackRemaining: number | null;

  /** MANUAL：手動登錄；ASSIGNMENT_FILE：由 E0501 配號檔匯入 */
  @Field(() => TurnkeyTrackSource)
  source: TurnkeyTrackSource;

  /** 配號檔的發票類別（07 一般稅額、08 特種稅額）；手動登錄為 null */
  @Field(() => String, { nullable: true })
  invoiceType: string | null;

  /** 匯入來源的 E0501 檔名；手動登錄為 null */
  @Field(() => String, { nullable: true })
  sourceFileName: string | null;

  /** Turnkey 收到配號檔的時間；手動登錄為 null */
  @Field(() => Date, { nullable: true })
  receivedAt: Date | null;

  @Field()
  createdAt: Date;
}
