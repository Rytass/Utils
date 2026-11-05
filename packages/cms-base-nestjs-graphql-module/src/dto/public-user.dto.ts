import { ObjectType, PickType } from '@nestjs/graphql';
import { UserDto } from './user.dto';

/**
 * Member reference exposed on public (unauthenticated) queries.
 * Only the id is exposed: `account` is often an e-mail address and must not
 * be readable by anonymous visitors. Backstage queries keep using `UserDto`.
 */
@ObjectType('PublicUser')
export class PublicUserDto extends PickType(UserDto, ['id'] as const, ObjectType) {}
