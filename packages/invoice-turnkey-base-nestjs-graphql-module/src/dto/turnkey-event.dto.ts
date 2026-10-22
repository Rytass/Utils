import { Field, ID, ObjectType } from '@nestjs/graphql';
import './turnkey-json.scalar';

@ObjectType('TurnkeyEvent')
export class TurnkeyEventDto {
  /** 流水號，作為游標使用 */
  @Field(() => ID)
  id: string;

  @Field()
  type: string;

  @Field()
  companyTaxId: string;

  @Field(() => Object)
  data: Record<string, unknown>;

  @Field()
  createdAt: Date;
}

@ObjectType('TurnkeyEventCollection')
export class TurnkeyEventCollectionDto {
  /** 由查詢條件組成（營業人、after、limit），同一查詢得到同一個 id */
  @Field(() => ID)
  id: string;

  @Field(() => [TurnkeyEventDto])
  events: TurnkeyEventDto[];

  @Field(() => String, { nullable: true })
  nextCursor: string | null;
}
