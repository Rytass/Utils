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

  @Field()
  createdAt: Date;
}
