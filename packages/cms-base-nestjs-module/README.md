# Rytass Utils - CMS Base NestJS Module

Powerful content management system base module designed specifically for NestJS applications. Provides complete multi-language article management, version control, approval workflows, and category management functionality, making it the ideal choice for building enterprise-grade CMS systems.

## Features

- [x] Multi-language article and category management
- [x] Article version control system
- [x] Hierarchical category structure (N:M relationships)
- [x] Article review and publishing workflows
- [x] Draft mode support
- [x] Full-text search functionality
- [x] Custom field support
- [x] DataLoader query performance optimization
- [x] TypeORM entities and repositories
- [x] Built-in error handling
- [x] Flexible permission control
- [x] GraphQL query support

## Installation

```bash
npm install @rytass/cms-base-nestjs-module @nestjs/typeorm typeorm
# or
yarn add @rytass/cms-base-nestjs-module @nestjs/typeorm typeorm
```

## Basic Usage

### Module Configuration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CmsBaseModule } from '@rytass/cms-base-nestjs-module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      // Database configuration
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'username',
      password: 'password',
      database: 'cms_database',
      entities: [
        /* other entities */
      ],
      synchronize: true, // Development environment only
    }),
    CmsBaseModule.forRoot({
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
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CmsBaseModule } from '@rytass/cms-base-nestjs-module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    CmsBaseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        multipleLanguageMode: configService.get('CMS_MULTI_LANGUAGE') === 'true',
        draftMode: configService.get('CMS_DRAFT_MODE') === 'true',
        signatureLevels: JSON.parse(configService.get('CMS_SIGNATURE_LEVELS')),
        fullTextSearchMode: configService.get('CMS_FULL_TEXT_SEARCH') === 'true',
      }),
    }),
  ],
})
export class AppModule {}
```

## Core Services

### Article Management

```typescript
// article.service.ts
import { Injectable } from '@nestjs/common';
import { ArticleBaseService } from '@rytass/cms-base-nestjs-module';

@Injectable()
export class ArticleService {
  constructor(private readonly articleBaseService: ArticleBaseService) {}

  async createArticle(data: CreateArticleDto) {
    return await this.articleBaseService.create({
      title: data.title,
      content: data.content,
      categoryIds: data.categoryIds,
      language: data.language || 'zh-TW',
      authorId: data.authorId,
      customFields: data.customFields,
    });
  }

  async publishArticle(articleId: string, userId: string) {
    return await this.articleBaseService.release(articleId, { userId });
  }

  async getArticleWithVersions(articleId: string) {
    return await this.articleBaseService.findById(articleId);
  }
}
```

### Category Management

```typescript
// category.service.ts
import { Injectable } from '@nestjs/common';
import { CategoryBaseService } from '@rytass/cms-base-nestjs-module';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryBaseService: CategoryBaseService) {}

  async createCategory(data: CreateCategoryDto) {
    return await this.categoryBaseService.create({
      names: data.names, // Multi-language names
      parentId: data.parentId,
      description: data.description,
      sortOrder: data.sortOrder,
    });
  }

  async getCategoryTree() {
    return await this.categoryBaseService.findAll();
  }

  async getArticlesByCategory(categoryId: string, options = {}) {
    return await this.categoryBaseService.findArticles(categoryId, {
      page: options.page || 1,
      limit: options.limit || 10,
      includeSubCategories: true,
    });
  }
}
```

## Data Models

### Article Entity

```typescript
import { BaseArticleEntity } from '@rytass/cms-base-nestjs-module';
import { Entity, Column } from 'typeorm';

@Entity('articles')
export class Article extends BaseArticleEntity {
  @Column({ type: 'jsonb', nullable: true })
  customFields?: Record<string, any>;

  @Column({ nullable: true })
  featuredImage?: string;

  @Column({ type: 'text', array: true, default: [] })
  tags: string[];
}
```

### Category Entity

```typescript
import { BaseCategoryEntity } from '@rytass/cms-base-nestjs-module';
import { Entity, Column } from 'typeorm';

@Entity('categories')
export class Category extends BaseCategoryEntity {
  @Column({ nullable: true })
  icon?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;
}
```

## Multi-Language Support

```typescript
// Create multi-language article
const article = await articleService.createArticle({
  title: {
    'zh-TW': '中文標題',
    'en-US': 'English Title',
    'ja-JP': '日本語タイトル',
  },
  content: {
    'zh-TW': '中文內容...',
    'en-US': 'English content...',
    'ja-JP': '日本語の内容...',
  },
  categoryIds: ['category-1', 'category-2'],
  language: 'zh-TW', // Primary language
});

// Query articles in specific language
const articles = await articleService.findArticles({
  language: 'en-US',
  status: 'published',
});
```

## Version Control

```typescript
// Add a new version to an article
const article = await articleService.addVersion(articleId, {
  title: 'Updated Title',
  content: 'Updated content',
});

// Get specific version of an article
const articleWithVersion = await articleService.findById(articleId, {
  version: 2, // Specific version number
});

// Delete a version
await articleService.deleteVersion(articleId, versionNumber);
```

## Approval Workflow

```typescript
// Submit article for approval
await articleService.submit(articleId, { userId });

// Approve a specific article version
await articleService.approveVersion(
  { id: articleId, version: 1 },
  { userId: managerId, signatureLevelId: 'level-2' },
);

// Reject a specific article version
await articleService.rejectVersion(
  { id: articleId },
  { userId: managerId, signatureLevelId: 'level-2', reason: 'Content needs revision' },
);
```

## Full-Text Search

```typescript
import { ArticleSearchMode } from '@rytass/cms-base-nestjs-module';

// Full-text search using findCollection with searchTerm
const searchResults = await articleService.findCollection({
  searchTerm: 'search keywords',
  searchMode: ArticleSearchMode.FULL_TEXT, // FULL_TEXT | TITLE | TITLE_AND_TAG
  offset: 0,
  limit: 20,
});

// Title and tag search
const titleResults = await articleService.findCollection({
  searchTerm: 'keywords',
  searchMode: ArticleSearchMode.TITLE_AND_TAG,
  requiredCategoryIds: ['tech-category-id'],
});
```

## DataLoader Integration

```typescript
// Use DataLoader to optimize N+1 query problems
import { ArticleDataloader, CategoryDataloader } from '@rytass/cms-base-nestjs-module';

@Injectable()
export class ArticleResolver {
  constructor(
    private readonly articleDataloader: ArticleDataloader,
    private readonly categoryDataloader: CategoryDataloader,
  ) {}

  @ResolveField()
  async categories(@Parent() article: Article) {
    return this.categoryDataloader.loadMany(article.categoryIds);
  }

  @ResolveField()
  async relatedArticles(@Parent() article: Article) {
    return this.articleDataloader.loadRelated(article.id);
  }
}
```

## Configuration Options

### CmsBaseModuleOptions

| Option                       | Type               | Default | Description                        |
| ---------------------------- | ------------------ | ------- | ---------------------------------- |
| `multipleLanguageMode`       | `boolean`          | `false` | Enable multi-language support      |
| `draftMode`                  | `boolean`          | `true`  | Enable draft mode                  |
| `signatureLevels`            | `SignatureLevel[]` | `[]`    | Approval level settings            |
| `fullTextSearchMode`         | `boolean`          | `false` | Enable full-text search            |
| `autoReleaseAfterApproved`   | `boolean`          | `false` | Auto-publish after approval        |
| `circularCategoryMode`       | `boolean`          | `false` | Allow circular category references |
| `multipleCategoryParentMode` | `boolean`          | `false` | Allow multiple parent categories   |

## Error Handling

```typescript
import {
  ArticleNotFoundError,
  CategoryNotFoundError,
  InsufficientPermissionError,
} from '@rytass/cms-base-nestjs-module';

try {
  await articleService.publishArticle(articleId, userId);
} catch (error) {
  if (error instanceof ArticleNotFoundError) {
    throw new NotFoundException('Article not found');
  } else if (error instanceof InsufficientPermissionError) {
    throw new ForbiddenException('Insufficient permissions');
  }
  throw error;
}
```

## Best Practices

### Performance

- Use DataLoader to avoid N+1 query problems
- Set up appropriate database indexes
- Use pagination for large data queries
- Enable query caching mechanisms

### Security

- Implement proper permission controls
- Validate user inputs
- Use parameterized queries to prevent SQL injection
- Log sensitive operation activities

### Scalability

- Separate read and write operations
- Use Redis caching for hot content
- Implement content delivery networks (CDN)
- Consider database sharding strategies

## Migration

```bash
# Generate migration files
npm run typeorm:migration:generate -- -n CreateCmsBaseTables

# Run migrations
npm run typeorm:migration:run

# Revert migrations
npm run typeorm:migration:revert
```

## License

MIT
