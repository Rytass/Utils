import { Field, ID, ObjectType } from '@nestjs/graphql';
import { TurnkeyNumberStatus } from '@rytass/invoice-turnkey-base-nestjs-module';

@ObjectType('TurnkeyInvoiceNumber')
export class TurnkeyInvoiceNumberDto {
  @Field(() => ID)
  id: string;

  @Field()
  companyTaxId: string;

  /** 期別，民國年 3 碼＋雙數月 */
  @Field()
  period: string;

  @Field()
  invoiceNumber: string;

  @Field(() => TurnkeyNumberStatus)
  status: TurnkeyNumberStatus;

  @Field()
  updatedAt: Date;
}
