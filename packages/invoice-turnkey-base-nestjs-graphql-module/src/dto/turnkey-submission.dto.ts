import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  TurnkeyMessageCategory,
  TurnkeyMigMessageType,
  TurnkeySubmissionStatus,
} from '@rytass/invoice-turnkey-base-nestjs-module';

/** 不含 xml 內容，避免列表回傳過大的文件 */
@ObjectType('TurnkeySubmission')
export class TurnkeySubmissionDto {
  @Field(() => ID)
  id: string;

  @Field()
  companyTaxId: string;

  @Field(() => TurnkeyMigMessageType)
  messageType: TurnkeyMigMessageType;

  @Field(() => TurnkeyMessageCategory)
  category: TurnkeyMessageCategory;

  @Field()
  documentNumber: string;

  @Field(() => TurnkeySubmissionStatus)
  status: TurnkeySubmissionStatus;

  @Field(() => String, { nullable: true })
  turnkeyUuid: string | null;

  @Field(() => String, { nullable: true })
  resultCode: string | null;

  @Field(() => String, { nullable: true })
  resultMessage: string | null;

  @Field(() => ID, { nullable: true })
  previousSubmissionId: string | null;

  @Field(() => Date, { nullable: true })
  writtenAt: Date | null;

  @Field(() => Date, { nullable: true })
  resolvedAt: Date | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType('TurnkeySubmissionCollection')
export class TurnkeySubmissionCollectionDto {
  @Field(() => [TurnkeySubmissionDto])
  items: TurnkeySubmissionDto[];
}
