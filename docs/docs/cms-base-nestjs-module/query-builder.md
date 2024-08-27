---
sidebar_position: 6
---

# Query Builder

You can use the Symbol provided by the library to inject the TypeORM Repository and create a custom Query Builder. If you have a custom entity, the library will automatically return a repository bound to the entity you provided.

**Symbols**

- RESOLVED_ARTICLE_REPO
- RESOLVED_ARTICLE_VERSION_CONTENT_REPO
- RESOLVED_ARTICLE_VERSION_REPO
- RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO
- RESOLVED_CATEGORY_REPO
- RESOLVED_SIGNATURE_LEVEL_REPO

```typescript title="src/app.service.ts"
import { Module, Injectable, Inject } from '@nestjs/common';
import { RESOLVED_ARTICLE_REPO, RESOLVED_CATEGORY_REPO, BaseArticleEntity } from '@rytass/cms-base-nestjs-module';
import { CustomCategoryEntity } from './custom-category.entity';

@Injectable()
export class AppService {
  constructor(
    @Inject(RESOLVED_ARTICLE_REPO)
    private readonly articleRepo: Repository<BaseArticleEntity>,
    @Inject(RESOLVED_CATEGORY_REPO)
    private readonly categoryRepo: Repository<CustomCategoryEntity>,
  ) {}
}
```
