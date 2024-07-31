import { Provider } from '@nestjs/common';
import {
  ACCESS_TOKEN_SECRET,
  GRAPHQL_CONTEXT_TOKEN_PARSER,
} from '../typings/member-base-providers';
import { BaseMemberEntity } from '../models/base-member.entity';
import { verify } from 'jsonwebtoken';

type TokenPayload = Pick<BaseMemberEntity, 'id' | 'account'> | null;

export const GraphQLContextTokenParserProvider: Provider = {
  provide: GRAPHQL_CONTEXT_TOKEN_PARSER,
  useFactory:
    (accessTokenSecret: string) =>
    async ({
      req,
    }: {
      req: { headers: Record<string, string> };
    }): Promise<TokenPayload> => {
      try {
        const token = (req.headers.authorization || '')
          .replace(/^Bearer\s/, '')
          .trim();

        const payload = verify(token, accessTokenSecret) as Pick<
          BaseMemberEntity,
          'id' | 'account'
        >;

        return {
          id: payload.id,
          account: payload.account,
        };
      } catch (ex) {
        return null;
      }
    },
  inject: [ACCESS_TOKEN_SECRET],
};

export type GraphQLContextTokenParser = (req: {
  headers: Record<string, string>;
}) => Promise<TokenPayload>;
