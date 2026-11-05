import { ArticleResolver } from '../src/resolvers/article.resolver';
import { ArticleDto } from '../src/dto/article.dto';
import type { MemberDataLoader } from '../src/data-loaders/members.dataloader';
import type { ArticleDataLoader } from '../src/data-loaders/article.dataloader';
import type { ArticleBaseDto } from '@rytass/cms-base-nestjs-module';
import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { GraphQLObjectType, getNamedType } from 'graphql';

const createResolver = (load: jest.Mock): ArticleResolver =>
  new ArticleResolver({ loader: { load } } as unknown as MemberDataLoader, {} as unknown as ArticleDataLoader, false);

describe('ArticleResolver.releasedBy (public)', () => {
  it('exposes only the member id, never the account', async (): Promise<void> => {
    const load = jest.fn().mockResolvedValue({
      id: 'member-1',
      account: 'editor@example.com',
      password: 'hashed',
    });

    const result = await createResolver(load).releasedBy({ releasedBy: 'member-1' } as ArticleBaseDto);

    expect(load).toHaveBeenCalledWith('member-1');
    expect(result).toEqual({ id: 'member-1' });
    expect(result).not.toHaveProperty('account');
  });

  it('returns null when the article has no releaser', async (): Promise<void> => {
    const load = jest.fn();

    const result = await createResolver(load).releasedBy({ releasedBy: null } as unknown as ArticleBaseDto);

    expect(result).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('returns null when the member no longer exists', async (): Promise<void> => {
    const load = jest.fn().mockResolvedValue(null);

    const result = await createResolver(load).releasedBy({ releasedBy: 'gone' } as ArticleBaseDto);

    expect(result).toBeNull();
  });
});

describe('Public Article schema', () => {
  it('types releasedBy as PublicUser, which exposes only id', async (): Promise<void> => {
    const app = await NestFactory.create(GraphQLSchemaBuilderModule, { logger: false });

    try {
      await app.init();

      const schema = await app.get(GraphQLSchemaFactory).create([ArticleResolver], {
        skipCheck: true,
        orphanedTypes: [ArticleDto],
      });

      const article = schema.getType('Article') as GraphQLObjectType;
      const releasedBy = getNamedType(article.getFields().releasedBy.type) as GraphQLObjectType;

      expect(releasedBy.name).toBe('PublicUser');
      expect(Object.keys(releasedBy.getFields())).toEqual(['id']);
    } finally {
      await app.close();
    }
  });
});
