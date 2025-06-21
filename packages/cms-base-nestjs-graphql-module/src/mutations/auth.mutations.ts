import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  IsPublic,
  MemberBaseService,
  TokenPairGraphQLDto,
} from '@rytass/member-base-nestjs-module';

@Resolver()
export class AuthMutations {
  constructor(private readonly baseMemberService: MemberBaseService) {}

  @Mutation(() => Boolean, {
    description: 'Register a new account, and send a verification email',
  })
  @IsPublic()
  async register(): Promise<boolean> {
    await this.baseMemberService.register('luca', 'luca');

    return true;
  }

  @Mutation(() => TokenPairGraphQLDto)
  @IsPublic()
  async login(
    @Args('account', { type: () => String }) account: string,
    @Args('password', { type: () => String }) password: string,
  ): Promise<TokenPairGraphQLDto> {
    const tokenPair = await this.baseMemberService.login(account, password);

    return tokenPair;
  }
}
