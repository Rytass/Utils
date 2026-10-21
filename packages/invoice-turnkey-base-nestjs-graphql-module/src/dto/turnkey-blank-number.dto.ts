import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('TurnkeyBlankNumberRange')
export class TurnkeyBlankNumberRangeDto {
  @Field()
  begin: string;

  @Field()
  end: string;
}

/** 空白號碼申報結果；每個字軌一筆，submissionId 可用來查送件狀態 */
@ObjectType('TurnkeyBlankNumberReport')
export class TurnkeyBlankNumberReportDto {
  @Field()
  track: string;

  @Field(() => ID)
  submissionId: string;

  @Field(() => [TurnkeyBlankNumberRangeDto])
  ranges: TurnkeyBlankNumberRangeDto[];
}
