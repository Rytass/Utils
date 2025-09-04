# Rytass Utils - CMS Base NestJS GraphQL Module

Comprehensive GraphQL API layer for the CMS Base NestJS Module, providing a complete content management system with GraphQL queries, mutations, and resolvers. Features multi-language support, approval workflows, version control, and optimized DataLoader patterns for high-performance content delivery.

## Features

### Core GraphQL API

- [x] Complete GraphQL schema for articles and categories
- [x] Public and backstage (admin) API endpoints
- [x] Multi-language content delivery
- [x] Real-time content queries with filters
- [x] Paginated collections with metadata

### Advanced Content Management

- [x] Article approval workflow resolvers
- [x] Version control and draft management
- [x] Category hierarchical relationships
- [x] Custom field support in GraphQL
- [x] Full-text search integration

### Performance Optimization

- [x] DataLoader pattern for N+1 query prevention
- [x] Member data caching with LRU cache
- [x] Article relationship optimization
- [x] Efficient batch loading for categories
- [x] Query complexity analysis

### Integration Features

- [x] Member system integration (@rytass/member-base-nestjs-module)
- [x] Permission-based access control
- [x] Quadrats rich content editor support
- [x] Multi-language decorator system
- [x] TypeORM entity relationships

## Installation

```bash
npm install @rytass/cms-base-nestjs-graphql-module @rytass/cms-base-nestjs-module
# Peer dependencies
npm install @nestjs/common @nestjs/typeorm @nestjs/graphql typeorm
# or
yarn add @rytass/cms-base-nestjs-graphql-module @rytass/cms-base-nestjs-module
```

## Basic Setup

### Module Configuration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CMSBaseGraphQLModule } from '@rytass/cms-base-nestjs-graphql-module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'username',
      password: 'password',
      database: 'cms_database',
      autoLoadEntities: true,
      synchronize: true, // Development only
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.gql',
      sortSchema: true,
      playground: true,
      introspection: true,
    }),
    CMSBaseGraphQLModule.forRoot({
      multipleLanguageMode: true,
      draftMode: true,
      signatureLevels: [
        { id: 1, name: 'Editor', level: 1 },
        { id: 2, name: 'Senior Editor', level: 2 },
        { id: 3, name: 'Chief Editor', level: 3 },
      ],
      fullTextSearchMode: true,
      autoReleaseAfterApproved: false,
    }),
  ],
})
export class AppModule {}
```

### Async Configuration

```typescript
// app.module.ts
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CMSBaseGraphQLModule } from '@rytass/cms-base-nestjs-graphql-module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    CMSBaseGraphQLModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        multipleLanguageMode: configService.get('CMS_MULTI_LANGUAGE') === 'true',
        draftMode: configService.get('CMS_DRAFT_MODE') === 'true',
        signatureLevels: JSON.parse(configService.get('CMS_SIGNATURE_LEVELS') || '[]'),
        fullTextSearchMode: configService.get('CMS_FULL_TEXT_SEARCH') === 'true',
        autoReleaseAfterApproved: configService.get('CMS_AUTO_RELEASE') === 'true',
      }),
    }),
  ],
})
export class AppModule {}
```

## GraphQL API Usage

### Public Queries

#### Query Single Article

```graphql
query GetArticle($id: ID!, $language: String) {
  article(id: $id) {
    articleId
    title
    description
    content
    publishedAt
    releasedBy {
      id
      username
      email
    }
    categories {
      id
      name
      slug
      parentCategory {
        id
        name
      }
    }
  }
}
```

```typescript
// Apollo Client usage
import { gql, useQuery } from '@apollo/client';

const GET_ARTICLE = gql`
  query GetArticle($id: ID!) {
    article(id: $id) {
      articleId
      title
      description
      content
      publishedAt
      categories {
        id
        name
        slug
      }
    }
  }
`;

function ArticlePage({ articleId }: { articleId: string }) {
  const { loading, error, data } = useQuery(GET_ARTICLE, {
    variables: { id: articleId }
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <article>
      <h1>{data.article.title}</h1>
      <p>{data.article.description}</p>
      {/* Render Quadrats content */}
    </article>
  );
}
```

#### Query Article Collection

```graphql
query GetArticles($page: Int, $limit: Int, $categoryId: ID, $search: String, $language: String) {
  articles(page: $page, limit: $limit, categoryId: $categoryId, search: $search) {
    items {
      articleId
      title
      description
      publishedAt
      categories {
        id
        name
        slug
      }
    }
    meta {
      totalCount
      pageCount
      currentPage
      hasNextPage
      hasPreviousPage
    }
  }
}
```

```typescript
// React component with pagination
import { gql, useQuery } from '@apollo/client';

const GET_ARTICLES = gql`
  query GetArticles($page: Int, $limit: Int, $categoryId: ID) {
    articles(page: $page, limit: $limit, categoryId: $categoryId) {
      items {
        articleId
        title
        description
        publishedAt
      }
      meta {
        totalCount
        currentPage
        hasNextPage
      }
    }
  }
`;

function ArticleList() {
  const [page, setPage] = useState(1);
  const { loading, error, data } = useQuery(GET_ARTICLES, {
    variables: { page, limit: 10 }
  });

  return (
    <div>
      {data?.articles.items.map((article) => (
        <ArticleCard key={article.articleId} article={article} />
      ))}

      <Pagination
        currentPage={data?.articles.meta.currentPage}
        hasNextPage={data?.articles.meta.hasNextPage}
        onPageChange={setPage}
      />
    </div>
  );
}
```

### Backstage (Admin) Queries

#### Query Articles with Management Data

```graphql
query GetBackstageArticles($page: Int, $limit: Int, $stage: String, $authorId: ID) {
  backstageArticles(page: $page, limit: $limit, stage: $stage, authorId: $authorId) {
    items {
      articleId
      title
      stage
      createdAt
      updatedAt
      author {
        id
        username
      }
      signature {
        id
        approved
        approvedAt
        level
        reviewer {
          id
          username
        }
      }
    }
    meta {
      totalCount
      pageCount
    }
  }
}
```

#### Query Article Versions

```graphql
query GetArticleVersions($articleId: ID!) {
  backstageArticle(id: $articleId) {
    articleId
    title
    stage
    versions {
      id
      versionNumber
      createdAt
      author {
        username
      }
      changes {
        field
        oldValue
        newValue
      }
    }
  }
}
```

### Mutations

#### Create Article

```graphql
mutation CreateArticle($input: CreateArticleInput!) {
  createArticle(input: $input) {
    articleId
    title
    stage
    createdAt
  }
}
```

```typescript
// Apollo Client mutation
import { gql, useMutation } from '@apollo/client';

const CREATE_ARTICLE = gql`
  mutation CreateArticle($input: CreateArticleInput!) {
    createArticle(input: $input) {
      articleId
      title
      stage
    }
  }
`;

function CreateArticleForm() {
  const [createArticle, { loading, error }] = useMutation(CREATE_ARTICLE);

  const handleSubmit = async (formData: any) => {
    try {
      const { data } = await createArticle({
        variables: {
          input: {
            title: {
              'en-US': formData.titleEn,
              'zh-TW': formData.titleZh
            },
            content: formData.content,
            categoryIds: formData.categories,
            customFields: formData.customFields
          }
        }
      });

      console.log('Article created:', data.createArticle);
    } catch (err) {
      console.error('Error creating article:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

#### Update Article

```graphql
mutation UpdateArticle($id: ID!, $input: UpdateArticleInput!) {
  updateArticle(id: $id, input: $input) {
    articleId
    title
    stage
    updatedAt
  }
}
```

#### Approve Article

```graphql
mutation ApproveArticle($articleId: ID!, $level: Int!, $comments: String) {
  approveArticle(articleId: $articleId, level: $level, comments: $comments) {
    id
    approved
    approvedAt
    level
    comments
  }
}
```

## Multi-Language Support

### Language Context

```typescript
// Custom decorator for language detection
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const Language = createParamDecorator((data: unknown, context: ExecutionContext) => {
  const ctx = GqlExecutionContext.create(context);
  const request = ctx.getContext().req;

  // Extract language from headers, query params, or JWT token
  return request.headers['accept-language'] || request.query.language || 'en-US';
});
```

### Multi-Language Queries

```graphql
query GetMultiLanguageArticle($id: ID!) {
  article(id: $id) {
    articleId
    title # Returns title in requested language
    description
    content
    multiLanguageTitle {
      language
      value
    }
    multiLanguageContent {
      language
      value
    }
  }
}
```

```typescript
// Frontend language switching
function ArticleWithLanguage({ articleId }: { articleId: string }) {
  const [language, setLanguage] = useState('en-US');

  const { data } = useQuery(GET_ARTICLE, {
    variables: { id: articleId },
    context: {
      headers: {
        'Accept-Language': language
      }
    }
  });

  return (
    <div>
      <LanguageSelector onChange={setLanguage} />
      <article>
        <h1>{data?.article.title}</h1>
        <div>{data?.article.content}</div>
      </article>
    </div>
  );
}
```

## Advanced Features

### Custom Resolvers

```typescript
// custom-article.resolver.ts
import { Resolver, Query, ResolveField, Parent } from '@nestjs/graphql';
import { ArticleDto } from '@rytass/cms-base-nestjs-graphql-module';

@Resolver(() => ArticleDto)
export class CustomArticleResolver {
  @ResolveField(() => String, { nullable: true })
  async seoTitle(@Parent() article: ArticleDto): Promise<string | null> {
    // Custom SEO title logic
    return article.title + ' | Your Site Name';
  }

  @ResolveField(() => [String])
  async tags(@Parent() article: ArticleDto): Promise<string[]> {
    // Extract tags from content or custom fields
    return article.customFields?.tags || [];
  }

  @ResolveField(() => Int)
  async readingTime(@Parent() article: ArticleDto): Promise<number> {
    // Calculate reading time based on content
    const wordCount = this.countWords(article.content);
    return Math.ceil(wordCount / 200); // Assuming 200 WPM
  }

  private countWords(content: any[]): number {
    // Implement word counting logic for Quadrats content
    return content.reduce((count, block) => {
      if (block.type === 'text') {
        return count + (block.text?.split(' ').length || 0);
      }
      return count;
    }, 0);
  }
}
```

### DataLoader Optimization

```typescript
// custom-dataloader.service.ts
import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

@Injectable()
export class CustomDataLoaderService {
  // Article view count loader
  public readonly articleViewsLoader = new DataLoader<string, number>(async (articleIds: string[]) => {
    const viewCounts = await this.getArticleViewCounts(articleIds);
    return articleIds.map(id => viewCounts[id] || 0);
  });

  // Related articles loader
  public readonly relatedArticlesLoader = new DataLoader<string, ArticleDto[]>(async (articleIds: string[]) => {
    const relatedArticles = await this.getRelatedArticles(articleIds);
    return articleIds.map(id => relatedArticles[id] || []);
  });

  private async getArticleViewCounts(articleIds: string[]): Promise<Record<string, number>> {
    // Implement batch view count fetching
    return {};
  }

  private async getRelatedArticles(articleIds: string[]): Promise<Record<string, ArticleDto[]>> {
    // Implement batch related articles fetching
    return {};
  }
}
```

### Search Integration

```graphql
query SearchArticles($query: String!, $filters: SearchFiltersInput, $page: Int, $limit: Int) {
  searchArticles(query: $query, filters: $filters, page: $page, limit: $limit) {
    items {
      articleId
      title
      description
      searchScore
      highlights {
        field
        snippets
      }
    }
    meta {
      totalCount
      searchTime
      suggestions
    }
    facets {
      categories {
        id
        name
        count
      }
      authors {
        id
        name
        count
      }
    }
  }
}
```

## Permission-Based Access

### Role-Based Queries

```typescript
// permissions.resolver.ts
import { Resolver, Query, UseGuards } from '@nestjs/graphql';
import { AllowActions, RequireActions } from '@rytass/member-base-nestjs-module';
import { BaseAction } from './constants/enum/base-action.enum';
import { BaseResource } from './constants/enum/base-resource.enum';

@Resolver()
export class PermissionResolver {
  @Query(() => [BackstageArticleDto])
  @RequireActions([BaseAction.READ], BaseResource.ARTICLE)
  async getAllArticles(): Promise<BackstageArticleDto[]> {
    // Only accessible to users with READ permission on ARTICLE resource
    return this.articleService.findAll();
  }

  @Query(() => BackstageArticleDto)
  @RequireActions([BaseAction.UPDATE], BaseResource.ARTICLE)
  async getEditableArticle(@Args('id') id: string): Promise<BackstageArticleDto> {
    // Only accessible to users with UPDATE permission
    return this.articleService.findEditableById(id);
  }
}
```

### Context-Based Security

```typescript
// security.resolver.ts
import { Resolver, Query, Context } from '@nestjs/graphql';

@Resolver()
export class SecurityResolver {
  @Query(() => [ArticleDto])
  async getUserArticles(@Context() context: any): Promise<ArticleDto[]> {
    const userId = context.req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.articleService.findByAuthor(userId);
  }
}
```

## Integration Examples

### Frontend Integration (React + Apollo)

```typescript
// ArticleManagement.tsx
import React from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_BACKSTAGE_ARTICLES, APPROVE_ARTICLE } from './queries';

export function ArticleManagement() {
  const { data, loading, refetch } = useQuery(GET_BACKSTAGE_ARTICLES, {
    variables: { page: 1, limit: 20, stage: 'PENDING' }
  });

  const [approveArticle] = useMutation(APPROVE_ARTICLE, {
    onCompleted: () => refetch()
  });

  const handleApprove = async (articleId: string) => {
    await approveArticle({
      variables: {
        articleId,
        level: 2,
        comments: 'Approved for publication'
      }
    });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Pending Articles</h2>
      {data?.backstageArticles.items.map((article: any) => (
        <ArticleCard
          key={article.articleId}
          article={article}
          onApprove={() => handleApprove(article.articleId)}
        />
      ))}
    </div>
  );
}
```

### Mobile App Integration (React Native + Apollo)

```typescript
// ArticleList.tsx
import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { useQuery } from '@apollo/client';
import { GET_ARTICLES } from './queries';

export function ArticleList() {
  const { data, loading, fetchMore } = useQuery(GET_ARTICLES, {
    variables: { page: 1, limit: 10 }
  });

  const loadMore = () => {
    if (data?.articles.meta.hasNextPage) {
      fetchMore({
        variables: {
          page: data.articles.meta.currentPage + 1
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;

          return {
            articles: {
              ...fetchMoreResult.articles,
              items: [
                ...prev.articles.items,
                ...fetchMoreResult.articles.items
              ]
            }
          };
        }
      });
    }
  };

  return (
    <FlatList
      data={data?.articles.items}
      renderItem={({ item }) => (
        <View>
          <Text>{item.title}</Text>
          <Text>{item.description}</Text>
        </View>
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
    />
  );
}
```

### Next.js SSR Integration

```typescript
// pages/articles/[id].tsx
import { GetServerSideProps } from 'next';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

export default function ArticlePage({ article }: { article: any }) {
  return (
    <div>
      <h1>{article.title}</h1>
      <div>{article.description}</div>
      {/* Render article content */}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params, req }) => {
  const client = new ApolloClient({
    uri: process.env.GRAPHQL_ENDPOINT,
    cache: new InMemoryCache(),
    headers: {
      'Accept-Language': req.headers['accept-language'] || 'en-US'
    }
  });

  const { data } = await client.query({
    query: gql`
      query GetArticle($id: ID!) {
        article(id: $id) {
          articleId
          title
          description
          content
        }
      }
    `,
    variables: { id: params?.id }
  });

  return {
    props: {
      article: data.article
    }
  };
};
```

## Performance Optimization

### Query Complexity Analysis

```typescript
// complexity.config.ts
import { createComplexityLimitRule } from 'graphql-query-complexity';

export const complexityConfig = {
  maximumComplexity: 1000,
  validators: [createComplexityLimitRule(1000)],
  createError: (max: number, actual: number) => {
    return new Error(`Query is too complex: ${actual}. Maximum allowed complexity: ${max}`);
  },
};
```

### Caching Strategy

```typescript
// cache.config.ts
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      host: 'localhost',
      port: 6379,
      ttl: 600, // 10 minutes
    }),
  ],
})
export class CacheConfig {}

// Cached resolver
@Resolver()
export class CachedArticleResolver {
  @Query(() => [ArticleDto])
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) // 5 minutes
  async popularArticles(): Promise<ArticleDto[]> {
    return this.articleService.findPopular();
  }
}
```

## Testing

### GraphQL Testing

```typescript
// article.resolver.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { GraphQLModule } from '@nestjs/graphql';

describe('Article Resolver (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot({
          autoSchemaFile: true,
        }),
        CMSBaseGraphQLModule.forRoot({
          multipleLanguageMode: false,
          draftMode: true,
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('should get article by id', () => {
    const query = `
      query {
        article(id: "test-id") {
          articleId
          title
          description
        }
      }
    `;

    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query })
      .expect(200)
      .expect(res => {
        expect(res.body.data.article).toBeDefined();
        expect(res.body.data.article.articleId).toBe('test-id');
      });
  });
});
```

### DataLoader Testing

```typescript
// dataloader.spec.ts
import { Test } from '@nestjs/testing';
import { ArticleDataLoader } from '../data-loaders/article.dataloader';

describe('ArticleDataLoader', () => {
  let dataLoader: ArticleDataLoader;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ArticleDataLoader],
    }).compile();

    dataLoader = module.get<ArticleDataLoader>(ArticleDataLoader);
  });

  it('should batch load categories', async () => {
    const articleIds = ['article1', 'article2'];
    const categories = await dataLoader.categoriesLoader.loadMany(
      articleIds.map(id => ({ articleId: id, language: 'en-US' })),
    );

    expect(categories).toHaveLength(2);
    expect(categories[0]).toBeInstanceOf(Array);
  });
});
```

## Best Practices

### Schema Design

- Use consistent naming conventions for all GraphQL types
- Implement proper pagination for all collection queries
- Design efficient DataLoader patterns to prevent N+1 queries
- Use nullable fields appropriately to handle missing data

### Performance

- Implement query complexity analysis to prevent expensive queries
- Use DataLoader for all relationship queries
- Cache frequently accessed data with appropriate TTL
- Optimize database queries with proper indexing

### Security

- Implement proper authentication and authorization
- Validate all input parameters and payloads
- Use rate limiting to prevent abuse
- Sanitize user-generated content

### Development

- Write comprehensive tests for all resolvers
- Use TypeScript for type safety across the GraphQL schema
- Implement proper error handling and logging
- Follow GraphQL best practices for schema evolution

## Environment Configuration

```bash
# .env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=cms_db
DATABASE_USER=cms_user
DATABASE_PASSWORD=secure_password

CMS_MULTI_LANGUAGE=true
CMS_DRAFT_MODE=true
CMS_FULL_TEXT_SEARCH=true
CMS_AUTO_RELEASE=false

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

GRAPHQL_PLAYGROUND=true
GRAPHQL_INTROSPECTION=true
```

## License

MIT
