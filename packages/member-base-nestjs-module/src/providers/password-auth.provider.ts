import { Inject, Injectable } from '@nestjs/common';
import { MemberBaseService } from '../services/member-base.service';
import { PASSWORD_CHANNEL } from '../constants/password-channel';
import type {
  AuthContext,
  AuthenticatedIdentity,
  AuthenticationProvider,
  AuthProviderKind,
} from '../typings/authentication-provider.interface';

export interface PasswordCredentials {
  account: string;
  password: string;
}

/**
 * The built-in account/password provider.
 *
 * Always registered, and the only provider registered by default, so existing
 * applications see no behavioural change from the gateway being introduced.
 *
 * It resolves the member itself (there is no external directory to map from),
 * which is why the identity it returns already carries `memberId`.
 */
@Injectable()
export class PasswordAuthProvider implements AuthenticationProvider<PasswordCredentials> {
  readonly channel = PASSWORD_CHANNEL;
  readonly kind: AuthProviderKind = 'credential';

  constructor(
    @Inject(MemberBaseService)
    private readonly memberBaseService: MemberBaseService,
  ) {}

  async authenticate(credentials: PasswordCredentials, context?: AuthContext): Promise<AuthenticatedIdentity> {
    const member = await this.memberBaseService.verifyCredentials(credentials.account, credentials.password, {
      ip: context?.ip,
    });

    return {
      channel: this.channel,
      identifier: member.account,
      memberId: member.id,
      identifierVerified: true,
    };
  }
}
