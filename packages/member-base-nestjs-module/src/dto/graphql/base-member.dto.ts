import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { BaseMemberEntity } from '../../models/base-member.entity';

@ObjectType('Member')
export class BaseMemberGraphQLDto
  implements Omit<BaseMemberEntity, 'password' | 'loginLogs'>
{
  @Field(() => ID)
  id: string;

  @Field(() => String)
  account: string;

  @Field(() => Date)
  passwordChangedAt: Date;

  @Field(() => Date, { nullable: true })
  resetPasswordRequestedAt: Date | null;

  @Field(() => Int)
  loginFailedCounter: number;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => Date, { nullable: true })
  deletedAt: Date | null;
}
