import { ArgsType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { CategorySorter } from '@rytass/cms-base-nestjs-module';

@ArgsType()
export class CategoriesArgs {
  @Field(() => [ID], { nullable: true })
  parentIds?: string[] | null;

  @Field(() => [ID], { nullable: true })
  ids?: string[] | null;

  @Field(() => String, { nullable: true })
  searchTerm?: string | null;

  @Field(() => Boolean, {
    description: 'If true, return only top level categories',
    nullable: true,
  })
  fromTop?: boolean | null;

  @Field(() => CategorySorter, { nullable: true })
  sorter?: CategorySorter | null;
}

registerEnumType(CategorySorter, {
  name: 'CategorySorter',
});
