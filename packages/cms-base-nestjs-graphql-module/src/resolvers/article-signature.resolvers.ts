import { ResolveField, Resolver, Root } from '@nestjs/graphql';

import { Logger } from '@nestjs/common';
import { ArticleSignature } from '../dto/article.dto';
import { ArticleSignatureEntity } from '@rytass/cms-base-nestjs-module';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import { User } from '../dto/user.dto';
import { MemberDataLoader } from '../data-loaders/members.dataloader';

@Resolver(() => ArticleSignature)
export class ArticleSignatureResolvers {
  constructor(private readonly memberDataLoader: MemberDataLoader) {}

  Logger = new Logger(ArticleSignatureResolvers.name);

  @ResolveField(() => Boolean)
  @IsPublic()
  async result(@Root() signature: ArticleSignatureEntity): Promise<boolean> {
    return signature.result === 'APPROVED';
  }

  @ResolveField(() => Date, { nullable: true })
  @IsPublic()
  async rejectedAt(
    @Root() signature: ArticleSignatureEntity,
  ): Promise<Date | null> {
    return signature.result === 'REJECTED' ? signature.signedAt : null;
  }

  @ResolveField(() => User, { nullable: true })
  @IsPublic()
  async signer(
    @Root() signature: ArticleSignatureEntity,
  ): Promise<User | null> {
    return signature.signerId
      ? await this.memberDataLoader.loader.load(signature.signerId)
      : null;
  }
}
