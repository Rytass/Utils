import { ResolveField, Resolver, Root } from '@nestjs/graphql';
import { ArticleSignatureDto } from '../dto/article-signature.dto';
import { UserDto } from '../dto/user.dto';
import { Authenticated } from '@rytass/member-base-nestjs-module';
import { MemberDataLoader } from '../data-loaders/members.dataloader';
import {
  ArticleSignatureEntity,
  DEFAULT_SIGNATURE_LEVEL,
} from '@rytass/cms-base-nestjs-module';
import { ArticleSignatureStepDto } from '../dto/article-signature-step.dto';

@Resolver(() => ArticleSignatureDto)
export class ArticleSignatureResolver {
  constructor(private readonly memberDataloader: MemberDataLoader) {}

  @ResolveField(() => UserDto, { nullable: true })
  @Authenticated()
  signer(
    @Root() signature: ArticleSignatureEntity,
  ): Promise<UserDto | null> | null {
    return signature.signerId
      ? this.memberDataloader.loader.load(signature.signerId)
      : null;
  }

  @ResolveField(() => ArticleSignatureStepDto)
  @Authenticated()
  step(@Root() signature: ArticleSignatureEntity): ArticleSignatureStepDto {
    return (
      signature.signatureLevel ?? {
        id: DEFAULT_SIGNATURE_LEVEL,
        name: DEFAULT_SIGNATURE_LEVEL,
      }
    );
  }
}
