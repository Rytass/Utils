import { Field, ID, InputType } from '@nestjs/graphql';

@InputType('CustomFieldInput')
export class CustomFieldInput {
  @Field(() => ID)
  key: string;

  @Field(() => String)
  value: string;
}
