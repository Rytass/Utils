import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('User')
export class User {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  account!: string;
}
