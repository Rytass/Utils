import {
  Inject,
  Injectable,
  MiddlewareConsumer,
  NestMiddleware,
} from '@nestjs/common';
import {
  ACCESS_TOKEN_SECRET,
  CASBIN_ENFORCER,
  COOKIE_MODE,
  REFRESH_TOKEN_SECRET,
} from '../typings/member-base-providers';
import { Enforcer } from 'casbin';
import { BaseMemberEntity } from '../models/base-member.entity';
import type { Request } from 'express';
import { verify } from 'jsonwebtoken';
import { getTokenFromRequest } from '../utils/get-token-from-request';

@Injectable()
export class EnforcerMiddleware implements NestMiddleware {
  constructor(
    @Inject(COOKIE_MODE)
    private readonly cookieMode: boolean,
    @Inject(CASBIN_ENFORCER)
    private readonly enforcer: Enforcer,
    @Inject(ACCESS_TOKEN_SECRET)
    private readonly accessTokenSecret: string,
    @Inject(REFRESH_TOKEN_SECRET)
    private readonly refreshTokenSecret: string,
  ) {}

  async use(
    req: Request & {
      enforcer: Enforcer;
      payload?: Pick<BaseMemberEntity, 'id' | 'account'>;
      _injectedEnforcer: symbol;
    },
    res: Response,
    next: () => void,
  ): Promise<void> {
    req.enforcer = this.enforcer;
    req._injectedEnforcer = CASBIN_ENFORCER;

    const token = await getTokenFromRequest(req, this.cookieMode);

    if (token) {
      try {
        req.payload = verify(
          token,
          this.cookieMode ? this.refreshTokenSecret : this.accessTokenSecret,
        ) as Pick<BaseMemberEntity, 'id' | 'account'>;
      } catch (ex) {
        req.payload = undefined;
      }
    }

    next();
  }
}
