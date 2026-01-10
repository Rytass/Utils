# CMS Modules API Reference

## @rytass/cms-base-nestjs-module

### CMSBaseModule

```typescript
@Global()
@Module({})
class CMSBaseModule {
  static forRoot(options?: CMSBaseModuleOptionsDto): DynamicModule;
  static forRootAsync(options: CMSBaseModuleAsyncOptionsDto): DynamicModule;
}
```

### CMSBaseModuleOptionsDto

```typescript
interface CMSBaseModuleOptionsDto {
  multipleLanguageMode?: boolean;              // 多語言模式
  allowMultipleParentCategories?: boolean;     // 多父分類
  allowCircularCategories?: boolean;           // 循環分類
  fullTextSearchMode?: boolean;                // 全文搜尋
  enableDraftMode?: boolean;                   // 草稿模式
  autoReleaseWhenLatestSignatureApproved?: boolean;

  signatureLevels?: string[] | BaseSignatureLevelEntity[];

  // 自訂實體
  articleEntity?: new () => BaseArticleEntity;
  articleVersionEntity?: new () => BaseArticleVersionEntity;
  articleVersionContentEntity?: new () => BaseArticleVersionContentEntity;
  categoryEntity?: new () => BaseCategoryEntity;
  categoryMultiLanguageNameEntity?: new () => BaseCategoryMultiLanguageNameEntity;
  signatureLevelEntity?: new () => BaseSignatureLevelEntity;
}
```

---

## Entity Definitions

### BaseArticleEntity

```typescript
@Entity('articles')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
class BaseArticleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToMany(() => BaseArticleVersionEntity, v => v.article)
  versions: Relation<BaseArticleVersionEntity[]>;

  @ManyToMany(() => BaseCategoryEntity)
  @JoinTable()
  categories: Relation<BaseCategoryEntity[]>;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
```

### BaseArticleVersionEntity

```typescript
@Entity('article_versions')
class BaseArticleVersionEntity {
  @PrimaryColumn('uuid')
  articleId: string;

  @PrimaryColumn('int')
  version: number;

  @Column({ type: 'jsonb', default: [] })
  tags: string[];

  @Column({ nullable: true })
  submittedAt: Date | null;

  @Column({ nullable: true })
  submittedBy: string | null;

  @Column({ nullable: true })
  releasedAt: Date | null;

  @Column({ nullable: true })
  releasedBy: string | null;

  @ManyToOne(() => BaseArticleEntity, { onDelete: 'CASCADE' })
  article: Relation<BaseArticleEntity>;

  @OneToMany(() => BaseArticleVersionContentEntity, c => c.version)
  multiLanguageContents: Relation<BaseArticleVersionContentEntity[]>;

  @OneToMany(() => ArticleSignatureEntity, s => s.version)
  signatures: Relation<ArticleSignatureEntity[]>;
}
```

### BaseArticleVersionContentEntity

```typescript
@Entity('article_version_contents')
class BaseArticleVersionContentEntity {
  @PrimaryColumn('uuid')
  articleId: string;

  @PrimaryColumn('int')
  version: number;

  @PrimaryColumn()
  language: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ nullable: true })
  searchTokens: string;
}
```

### BaseCategoryEntity

```typescript
@Entity('categories')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
class BaseCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: false })
  bindable: boolean;

  @ManyToMany(() => BaseCategoryEntity)
  parents: Relation<BaseCategoryEntity[]>;

  @ManyToMany(() => BaseCategoryEntity)
  children: Relation<BaseCategoryEntity[]>;

  @OneToMany(() => BaseCategoryMultiLanguageNameEntity, n => n.category)
  multiLanguageNames: Relation<BaseCategoryMultiLanguageNameEntity[]>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
```

---

## Services

### ArticleBaseService

```typescript
class ArticleBaseService<
  ArticleEntity,
  ArticleVersionEntity,
  ArticleVersionContentEntity,
  SignatureLevelEntity
> {
  // CRUD
  create(data: CreateDto): Promise<ArticleBaseDto>;
  findById(id: string, options?: FindOptions): Promise<ArticleBaseDto>;
  findCollection(options: FindAllDto): Promise<ArticleCollectionDto>;
  addVersion(id: string, data: VersionDto): Promise<ArticleBaseDto>;

  // Workflow
  submit(id: string, options: SignatureInfoDto): Promise<ArticleBaseDto>;
  approveVersion(options: ApproveOptions): Promise<ArticleBaseDto>;
  rejectVersion(options: RejectOptions, metadata?: object): Promise<ArticleBaseDto>;
  release(id: string, options: ReleaseOptions): Promise<ArticleBaseDto>;
  putBack(id: string): Promise<ArticleBaseDto>;
  withdraw(id: string, version: number): Promise<ArticleBaseDto>;

  // Management
  archive(id: string): Promise<void>;
  deleteVersion(id: string, version: number): Promise<void>;
}
```

### CategoryBaseService

```typescript
class CategoryBaseService<CategoryEntity, CategoryMultiLanguageName> {
  create(data: CreateCategoryDto): Promise<CategoryBaseDto>;
  findById(id: string): Promise<CategoryBaseDto>;
  findAll(options?: FindAllOptions): Promise<CategoryBaseDto[]>;
  update(id: string, data: UpdateCategoryDto): Promise<CategoryBaseDto>;
  delete(id: string): Promise<void>;
}
```

---

## DataLoaders

### ArticleDataLoader

```typescript
class ArticleDataLoader {
  // 文章階段 (5秒 TTL)
  stageLoader: DataLoader<{id: string; version: number}, ArticleStage>;

  // 文章分類 (60秒 TTL)
  categoriesLoader: DataLoader<string, BaseCategoryEntity[]>;
}
```

### ArticleSignatureDataLoader

```typescript
class ArticleSignatureDataLoader {
  // 版本簽核 (15秒 TTL)
  versionSignaturesLoader: DataLoader<
    {id: string; version: number},
    ArticleSignatureEntity[]
  >;
}
```

### CategoryDataLoader

```typescript
class CategoryDataLoader<T extends BaseCategoryEntity> {
  // 含父分類 (15秒 TTL)
  withParentsLoader: DataLoader<string, T | null>;
}
```

### ArticleVersionDataLoader

```typescript
class ArticleVersionDataLoader<
  A extends BaseArticleEntity = BaseArticleEntity,
  AV extends BaseArticleVersionEntity = BaseArticleVersionEntity,
  AVC extends BaseArticleVersionContentEntity = BaseArticleVersionContentEntity,
> {
  // 依文章 ID 取得各階段版本 (10秒 TTL)
  stageVersionsLoader: DataLoader<
    string,
    Record<ArticleStage, ArticleBaseDto<A, AV, AVC> | null>
  >;

  // 依文章 ID 取得所有版本 (10秒 TTL)
  versionsLoader: DataLoader<string, ArticleBaseDto<A, AV, AVC>[]>;
}
```

**使用範例：**

```typescript
import { ArticleVersionDataLoader } from '@rytass/cms-base-nestjs-module';

@Resolver()
class ArticleResolver {
  constructor(
    private readonly versionDataLoader: ArticleVersionDataLoader,
  ) {}

  @ResolveField()
  async versions(@Parent() article: Article) {
    return this.versionDataLoader.versionsLoader.load(article.id);
  }

  @ResolveField()
  async stageVersions(@Parent() article: Article) {
    const stages = await this.versionDataLoader.stageVersionsLoader.load(article.id);
    // stages = { DRAFT: ArticleDto | null, REVIEWING: ..., VERIFIED: ..., ... }
    return stages;
  }
}
```

---

## Enums

### ArticleStage

```typescript
enum ArticleStage {
  DRAFT = 'DRAFT',
  REVIEWING = 'REVIEWING',
  VERIFIED = 'VERIFIED',
  SCHEDULED = 'SCHEDULED',
  RELEASED = 'RELEASED',
  DELETED = 'DELETED',
  UNKNOWN = 'UNKNOWN',
}
```

### ArticleSorter

```typescript
enum ArticleSorter {
  CREATED_AT_DESC = 'CREATED_AT_DESC',
  CREATED_AT_ASC = 'CREATED_AT_ASC',
  UPDATED_AT_DESC = 'UPDATED_AT_DESC',
  UPDATED_AT_ASC = 'UPDATED_AT_ASC',
  SUBMITTED_AT_DESC = 'SUBMITTED_AT_DESC',
  SUBMITTED_AT_ASC = 'SUBMITTED_AT_ASC',
  RELEASED_AT_DESC = 'RELEASED_AT_DESC',
  RELEASED_AT_ASC = 'RELEASED_AT_ASC',
}
```

---

## Injection Tokens

```typescript
// 模組設定
CMS_BASE_MODULE_OPTIONS
MULTIPLE_LANGUAGE_MODE
MULTIPLE_CATEGORY_PARENT_MODE
CIRCULAR_CATEGORY_MODE
FULL_TEXT_SEARCH_MODE
SIGNATURE_LEVELS
DRAFT_MODE
AUTO_RELEASE_AFTER_APPROVED

// Repository
RESOLVED_ARTICLE_REPO
RESOLVED_ARTICLE_VERSION_REPO
RESOLVED_ARTICLE_VERSION_CONTENT_REPO
RESOLVED_CATEGORY_REPO
RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO
RESOLVED_SIGNATURE_LEVEL_REPO

// 服務與 DataLoader
ARTICLE_BASE_SERVICE
CATEGORY_DATA_LOADER
ARTICLE_SIGNATURE_DATALOADER
```

---

## @rytass/cms-base-nestjs-graphql-module

### CMSBaseGraphQLModule

```typescript
@Module({})
class CMSBaseGraphQLModule {
  static forRoot(options: CMSGraphqlBaseModuleOptionsDto): DynamicModule;
  static forRootAsync(options: CMSGraphqlBaseModuleAsyncOptionsDto): DynamicModule;
}
```

### CMSGraphqlBaseModuleOptionsDto

```typescript
interface CMSGraphqlBaseModuleOptionsDto extends CMSBaseModuleOptionsDto {
  mapArticleCustomFieldsToEntityColumns?: (
    fields: CustomFieldInput[]
  ) => Promise<Record<string, string | object>>;

  mapCategoryCustomFieldsToEntityColumns?: (
    fields: CustomFieldInput[]
  ) => Promise<Record<string, string | object>>;
}
```

---

## GraphQL Types

### ArticleDto / BackstageArticleDto

```graphql
type ArticleDto {
  articleId: ID!
  title: String!
  description: String
  content: String
  tags: [String!]!
  releasedAt: DateTime
  releasedBy: UserDto
  categories: [CategoryDto!]!
}

type BackstageArticleDto extends ArticleDto {
  stage: ArticleStage!
  version: Int!
  signatures: [ArticleSignatureDto!]!
  multiLanguageContents: [ArticleVersionContentDto!]!
}
```

### CategoryDto / BackstageCategoryDto

```graphql
type CategoryDto {
  id: ID!
  name: String!
  bindable: Boolean!
  parents: [CategoryDto!]!
  children: [CategoryDto!]!
}

type BackstageCategoryDto extends CategoryDto {
  multiLanguageNames: [CategoryMultiLanguageNameDto!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

---

## GraphQL Operations

### Queries

```graphql
# 公開
article(id: ID!, language: String): ArticleDto
articles(page: Int, limit: Int, categoryId: ID, search: String): ArticleCollectionDto
category(id: ID!, language: String): CategoryDto
categories(parentId: ID, bindableOnly: Boolean): [CategoryDto!]!

# 後台
backstageArticle(id: ID!, version: Int): BackstageArticleDto
backstageArticles(page: Int, limit: Int, stage: ArticleStage): BackstageArticleCollectionDto
backstageCategory(id: ID!): BackstageCategoryDto
backstageCategories(parentId: ID): [BackstageCategoryDto!]!
```

### Mutations

```graphql
# 文章
createArticle(input: CreateArticleInput!): BackstageArticleDto!
updateArticle(input: UpdateArticleInput!): BackstageArticleDto!
deleteArticle(id: ID!): Boolean!
deleteArticleVersion(id: ID!, version: Int!): Boolean!
submitArticle(id: ID!): BackstageArticleDto!
putBackArticle(id: ID!): BackstageArticleDto!
approveArticle(id: ID!, version: Int): BackstageArticleDto!
rejectArticle(id: ID!, reason: String): BackstageArticleDto!
releaseArticle(id: ID!, releasedAt: DateTime!, version: Int): BackstageArticleDto!
withdrawArticle(id: ID!, version: Int!): BackstageArticleDto!

# 分類
createCategory(input: CreateCategoryInput!): BackstageCategoryDto!
updateCategory(input: UpdateCategoryInput!): BackstageCategoryDto!
deleteCategory(id: ID!): Boolean!
```

---

## Permission Decorators

```typescript
// 資源類型
enum BaseResource {
  ARTICLE = 'ARTICLE',
  CATEGORY = 'CATEGORY',
}

// 操作類型
enum BaseAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LIST = 'LIST',
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  RELEASE = 'RELEASE',
  WITHDRAW = 'WITHDRAW',
  DELETE_VERSION = 'DELETE_VERSION',
  PUT_BACK = 'PUT_BACK',
}
```

---

## Complete Example

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CMSBaseGraphQLModule } from '@rytass/cms-base-nestjs-graphql-module';
import { MemberBaseModule } from '@rytass/member-base-nestjs-module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      // ... 連線配置
      autoLoadEntities: true,
    }),

    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.gql',
      context: ({ req }) => ({ req }),
    }),

    MemberBaseModule.forRoot({
      // 認證配置...
    }),

    CMSBaseGraphQLModule.forRoot({
      multipleLanguageMode: true,
      enableDraftMode: true,
      signatureLevels: [
        { id: 'editor', name: '編輯', level: 1 },
        { id: 'chief', name: '主編', level: 2 },
      ],
      mapArticleCustomFieldsToEntityColumns: async (fields) => {
        return fields.reduce((acc, f) => ({
          ...acc,
          [f.key]: f.value,
        }), {});
      },
    }),
  ],
})
export class AppModule {}

// custom-article.entity.ts
import { Entity, Column, ChildEntity } from 'typeorm';
import { BaseArticleEntity } from '@rytass/cms-base-nestjs-module';

@Entity('articles')
@ChildEntity()
export class CustomArticle extends BaseArticleEntity {
  @Column({ nullable: true })
  featuredImage?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}

// article.resolver.ts
import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import {
  ARTICLE_BASE_SERVICE,
  ArticleBaseService,
} from '@rytass/cms-base-nestjs-module';
import { IsPublic } from '@rytass/member-base-nestjs-module';

@Resolver()
export class CustomArticleResolver {
  constructor(
    @Inject(ARTICLE_BASE_SERVICE)
    private readonly articleService: ArticleBaseService,
  ) {}

  @Query(() => ArticleDto)
  @IsPublic()
  async featuredArticle(
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.articleService.findById(id, {
      stage: 'RELEASED',
    });
  }
}
```

---

## Error Codes

| 錯誤類別 | 代碼 | 說明 |
|----------|------|------|
| ArticleNotFoundError | 200 | 文章不存在 |
| ArticleVersionNotFoundError | 201 | 文章版本不存在 |
| CategoryNotFoundError | - | 分類不存在 |
| CircularCategoryNotAllowedError | - | 不允許循環分類 |
| MultipleParentCategoryNotAllowedError | - | 不允許多父分類 |
| ParentCategoryNotFoundError | - | 父分類不存在 |
| MultipleLanguageModeIsDisabledError | - | 多語言模式未啟用 |
