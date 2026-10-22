import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('TurnkeyBlankNumberRange')
export class TurnkeyBlankNumberRangeDto {
  /** 所屬申報的 submissionId 加上區間起訖 */
  @Field(() => ID)
  id: string;

  @Field()
  begin: string;

  @Field()
  end: string;
}

/** 空白號碼申報結果；每個字軌一筆，submissionId 可用來查送件狀態 */
@ObjectType('TurnkeyBlankNumberReport')
export class TurnkeyBlankNumberReportDto {
  /** 每個字軌的申報對應一筆送件，以 submissionId 作為 id */
  @Field(() => ID)
  id: string;

  @Field()
  track: string;

  @Field(() => ID)
  submissionId: string;

  @Field(() => [TurnkeyBlankNumberRangeDto])
  ranges: TurnkeyBlankNumberRangeDto[];
}
