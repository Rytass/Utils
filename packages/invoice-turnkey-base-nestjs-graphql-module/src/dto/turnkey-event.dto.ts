import { Field, ObjectType } from '@nestjs/graphql';
import './turnkey-json.scalar';

@ObjectType('TurnkeyEvent')
export class TurnkeyEventDto {
  /** 流水號，作為游標使用 */
  @Field()
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
  @Field(() => [TurnkeyEventDto])
  events: TurnkeyEventDto[];

  @Field(() => String, { nullable: true })
  nextCursor: string | null;
}
