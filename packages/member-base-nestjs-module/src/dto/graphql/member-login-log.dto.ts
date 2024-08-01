import { ObjectType, Field, ID } from '@nestjs/graphql';
import { MemberLoginLogEntity } from '../../models/member-login-log.entity';

@ObjectType('MemberLoginLog')
export class MemberLoginLogGraphQLDto
  implements Omit<MemberLoginLogEntity, 'memberId' | 'member'>
{
  @Field(() => ID)
  id: string;

  @Field(() => Boolean)
  success: boolean;

  @Field(() => String, { nullable: true })
  ip: string | null;

  @Field(() => Date)
  createdAt: Date;
}
