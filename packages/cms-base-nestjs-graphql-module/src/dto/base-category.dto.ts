import { Field, ID, InterfaceType } from '@nestjs/graphql';

@InterfaceType('BaseCategory')
export class BaseCategoryDto {
  @Field(() => ID)
  id: string;
}
