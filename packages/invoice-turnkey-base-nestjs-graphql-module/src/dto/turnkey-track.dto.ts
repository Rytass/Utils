import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

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

  @Field()
  createdAt: Date;
}
