---
sidebar_position: 4
---

# Full Text Search

If you want to enable the full-text search feature, we use [@node-rs/jieba](https://www.npmjs.com/package/@node-rs/jieba) as the word segmentation tool. Please install it from npm first, and then indicate to the Library that you wish to enable the full-text search feature in forRoot. When the full-text search feature is enabled, the Library will automatically initialize all articles in the current database. The indexed fields for search include title, description, tags, and the content within paragraph blocks in [Quadrats](https://github.com/Quadrats/quadrats).

```shell
yarn add @node-rs/jieba

// or

npm i @node-rs/jieba
```

```typescript title="src/app.module.ts"
import { Module } from '@nestjs/common';
import { CMSBaseModule } from '@rytass/cms-base-nestjs-module';

@Module({
  imports: [
    // ... (typeorm register)
    CMSBaseModule.forRoot({
      fullTextSearchMode: true,
    }),
  ],
})
export class AppModule {}
```

To optimize the efficiency of full-text search, we use Postgres **GIN** indexes. Depending on your database configuration, you may need to manually enable the corresponding extension.

```sql
CREATE EXTENSION pg_trgm;
```

When using the searchTerm field for searching, you have several different modes to choose from. Traditionally, when using the **TITLE** mode, the library will search through the title and description fields. Using **TITLE_AND_TAG** will also include items in the tags field. If you have enabled full-text search mode, remember to use **FULL_TEXT**.

```typescript title="src/app.service.ts"
import { Injectable } from '@nestjs/common';
import { ArticleBaseService, ArticleBaseDto, ArticleSearchMode } from '@rytass/cms-base-nestjs-module';

@Injectable()
export class AppService {
  constructor(
    private readonly articleService: ArticleBaseService,
  ) {}

  findAll(term: string): Promise<ArticleBaseDto[]> {
    return this.articleService.findAll({
      searchTerm: term,
      searchMode: ArticleSearchMode.FULL_TEXT,
    });
  }
}

```
