import { BadRequestException } from '@nestjs/common';
import { sign, verify } from 'jsonwebtoken';
import { createHmac } from 'node:crypto';
import type { Response } from 'express';
import { OAuthCallbacksController } from '../src/controllers/oauth-callbacks.controller';
import type { OAuthService } from '../src/services/oauth.service';

const SECRET = 'transaction-test-secret';
const build = (
  cookieMode = true,
): {
  controller: OAuthCallbacksController;
  service: { getGoogleOAuthLoginUrl: jest.Mock; loginWithGoogleOAuth2Code: jest.Mock };
  res: Response;
} => {
  const service = {
    getGoogleOAuthLoginUrl: jest.fn(async (state: string) => `https://accounts.example.com?state=${state}`),
    loginWithGoogleOAuth2Code: jest.fn(async () => ({ accessToken: 'access', refreshToken: 'refresh' })),
  };

  const res = {
    req: { cookies: {}, headers: { host: 'localhost' } },
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  } as unknown as Response;

  return {
    controller: new OAuthCallbacksController(
      [
        {
          channel: 'google',
          clientId: 'client',
          clientSecret: 'secret',
          redirectUri: 'https://app.example.com/callback',
        },
      ],
      '/home',
      cookieMode,
      'access_token',
      'refresh_token',
      { path: '/', sameSite: 'strict' },
      900,
      3600,
      service as unknown as OAuthService,
      SECRET,
    ),
    service,
    res,
  };
};

describe('legacy browser OAuth transaction security', () => {
  it('binds the callback to the signed transaction and writes tokens only as HttpOnly cookies', async () => {
    const { controller, service, res } = build();

    await controller.redirectURL('google', res);
    const [name, transaction, options] = (res.cookie as jest.Mock).mock.calls[0] as [string, string, object];
    const state = service.getGoogleOAuthLoginUrl.mock.calls[0][0] as string;

    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', maxAge: 600_000 });
    expect(() => verify(transaction, SECRET)).toThrow();
    res.req.cookies = { [name]: transaction };
    await controller.callback('code', state, 'google', res);
    expect(service.loginWithGoogleOAuth2Code).toHaveBeenCalledWith('code', state);
    expect(res.redirect).toHaveBeenLastCalledWith('/home');
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh', expect.objectContaining({ httpOnly: true }));
  });

  it.each(['missing', 'tampered', 'expired', 'wrong-channel', 'wrong-state'])(
    'rejects %s transactions before exchanging the code',
    async variant => {
      const { controller, service, res } = build();
      const claims = { state: 'expected', channel: variant === 'wrong-channel' ? 'facebook' : 'google' };
      const transaction = sign(
        claims,
        variant === 'tampered'
          ? 'wrong-secret'
          : createHmac('sha256', SECRET).update('member-oauth-transaction:v1').digest(),
        {
          audience: 'member-oauth-transaction',
          expiresIn: variant === 'expired' ? -1 : 600,
        },
      );

      res.req.cookies = variant === 'missing' ? {} : { member_oauth_tx: transaction };
      await expect(
        controller.callback('code', variant === 'wrong-state' ? 'other' : 'expected', 'google', res),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(service.loginWithGoogleOAuth2Code).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
    },
  );

  it('rejects browser bearer delivery in header mode before setting a transaction or exchanging a code', async () => {
    const { controller, service, res } = build(false);

    await expect(controller.redirectURL('google', res)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.callback('code', 'state', 'google', res)).rejects.toBeInstanceOf(BadRequestException);
    expect(res.cookie).not.toHaveBeenCalled();
    expect(service.loginWithGoogleOAuth2Code).not.toHaveBeenCalled();
  });
});
