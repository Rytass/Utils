import { Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * Member reference exposed on public (unauthenticated) queries.
 * Only the id is exposed: `account` is often an e-mail address and must not
 * be readable by anonymous visitors. Backstage queries keep using `UserDto`.
 */
@ObjectType('PublicUser')
export class PublicUserDto {
  @Field(() => ID)
  id: string;
}
