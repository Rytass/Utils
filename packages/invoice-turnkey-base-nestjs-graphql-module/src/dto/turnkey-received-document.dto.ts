import { Field, ID, ObjectType } from '@nestjs/graphql';
import { TurnkeyMigMessageType, TurnkeyReceivedDocumentStatus } from '@rytass/invoice-turnkey-base-nestjs-module';

/** 我方為買方時收到的交換文件；不含 xml（同 TurnkeySubmission 的做法） */
@ObjectType('TurnkeyReceivedDocument')
export class TurnkeyReceivedDocumentDto {
  @Field(() => ID)
  id: string;

  @Field()
  buyerTaxId: string;

  @Field()
  sellerTaxId: string;

  @Field(() => TurnkeyMigMessageType)
  messageType: TurnkeyMigMessageType;

  @Field()
  documentNumber: string;

  /** yyyyMMdd */
  @Field()
  documentDate: string;

  @Field(() => Date, { nullable: true })
  occurredAt: Date | null;

  @Field(() => String, { nullable: true })
  reason: string | null;

  @Field(() => TurnkeyReceivedDocumentStatus)
  status: TurnkeyReceivedDocumentStatus;

  @Field()
  fileName: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
