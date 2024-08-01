import { Field, ObjectType } from '@nestjs/graphql';
import { TokenPairDto } from '../token-pair.dto';

@ObjectType('TokenPair')
export class TokenPairGraphQLDto implements TokenPairDto {
  @Field(() => String)
  accessToken: string;

  @Field(() => String)
  refreshToken: string;
}
