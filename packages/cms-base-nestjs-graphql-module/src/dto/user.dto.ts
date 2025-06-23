import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('User')
export class UserDto {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;
}
