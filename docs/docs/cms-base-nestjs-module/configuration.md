---
sidebar_position: 1
---

# Configuration

This is a NestJS module that serves as the core of a content management platform, supporting basic features such as article versioning and categorization. The storage of article content uses Quadrats as the core storage system and requires TypeORM for database interfacing. Of course, you are free to define the necessary Entity Columns on all stored tables.

First, you need to configure it using `forRoot` in your root module. If you need to pre-load other modules, `forRootAsync` might be your choice.

```typescript title="src/app.module.ts"
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CMSBaseModule } from '@rytass/cms-base-nestjs-module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      username: 'cms',
      password: 'password',
      database: 'cms',
      schema: 'cms',
      synchronize: true,
      autoLoadEntities: true,
      uuidExtension: 'uuid-ossp',
    }),
    CMSBaseModule.forRoot(),
  ],
})
export class AppModule {}
```

## References

### Methods

#### `forRoot()`

```tsx
static forRoot(options?: CMSBaseModuleOptionsDto);
```

**Parameters:**

| Name                            | Type                 | Default   | Description                                                   |
| ------------------------------- | -------------------- | --------- | ------------------------------------------------------------- |
| multipleLanguageMode            | boolean              | false     | Enable multiple language support                              |
| allowMultipleParentCategories   | boolean              | false     | Allow category has multiple parent categories                 |
| allowCircularCategories         | boolean              | false     | Allow category parent loop hierarchy                          |
| fullTextSearchMode              | boolean              | false     | Search term in article content with node-rs/jieba             |
| signatureMode                   | boolean              | false     | Enable signature mode                                         |
| signatureLevels                 | string[] \| Entity[] | []        | When signature mode enabled, multiple signature configuration |
| articleEntity                   | TypeORM Entity       | undefined | Custom ArticleEntity                                          |
| articleVersionEntity            | TypeORM Entity       | undefined | Custom ArticleVersionEntity                                   |
| articleVersionContentEntity     | TypeORM Entity       | undefined | Custom ArticleVersionContentEntity                            |
| categoryEntity                  | TypeORM Entity       | undefined | Custom CategoryEntity                                         |
| categoryMultiLanguageNameEntity | TypeORM Entity       | undefined | Custom BaseCategoryMultiLanguageNameEntity                    |
| signatureLevelEntity            | TypeORM Entity       | undefined | Custom BaseSignatureLevelEntity                               |


#### `forRootAsync()`

```tsx
static forRootAsync(options: CMSBaseModuleAsyncOptionsDto);
```

**Parameters:**

| Name             | Type                                        | Default    | Description                                           |
| ---------------- | ------------------------------------------- | ---------- | ----------------------------------------------------- |
| imports          | DynamicModule[]                             | []         | Imported module before CMS module                     |
| useFactory       | (...args: any[]) => CMSBaseModuleOptionsDto | undefined  | Factory method to generate async options              |
| injects          | any[]                                       | []         | Inject symbol for useFactory method                   |
| useClass         | Type\<CMSBaseModuleOptionFactory\>          | undefined  | Options provider class                                |
| useExisting      | Type\<CMSBaseModuleOptionFactory\>          | undefined  | Options provider class symbol                         |
