---
sidebar_position: 3
---

# Customize Entities

You can extend the fields of articles and categories through the **TypeORM ChildEntity** mechanism. Below, we provide some examples to illustrate how to add a boolean field when you want to record whether an article should be published.

First, you need to create an **Entity** that extends from **BaseArticleEntity** and add an **onShelf** field to it.

```typescript title="src/article.entity.ts"
import { ChildEntity } from 'typeorm';
import { BaseArticleEntity } from '@rytass/cms-base-nestjs-module';

@ChildEntity()
export class ArticleEntity extends BaseArticleEntity {
  @Column('boolean', { default: true })
  onShelf: boolean;
}
```

Next, you need to register this **entity** in the **forRoot** method.

```typescript title="src/app.module.ts"
import { Module } from '@nestjs/common';
import { CMSBaseModule } from '@rytass/cms-base-nestjs-module';
import { ArticleEntity } from './article.entity';

@Module({
  imports: [
    // ... (typeorm register)
    CMSBaseModule.forRoot({
      articleEntity: ArticleEntity,
    }),
  ],
})
export class AppModule {}

```

After all, when you use **ArticleBaseService**, you can access these custom-defined columns. Remember, You need to inform the **service** of how you’ve defined it through **generics**.

```typescript title="src/app.service.ts"
import { Injectable } from '@nestjs/common';
import { ArticleEntity } from './article.entity';
import { ArticleBaseService, ArticleBaseDto } from '@rytass/cms-base-nestjs-module';

@Injectable()
export class AppService {
  constructor(
    private readonly articleService: ArticleBaseService<ArticleEntity>,
  ) {}

  findById(id: string): Promise<ArticleBaseDto<ArticleEntity>> {
    return this.articleService.findById(id);
  }
}

```

In addition to defining the **generic** when the **Service** is referenced, you can also override the definition when using a **method**. In this case, the definition provided in the method will take precedence.


```typescript title="src/app.service.ts"
import { Injectable } from '@nestjs/common';
import { ArticleEntity } from './article.entity';
import { ArticleBaseService, ArticleBaseDto } from '@rytass/cms-base-nestjs-module';

@Injectable()
export class AppService {
  constructor(
    private readonly articleService: ArticleBaseService,
  ) {}

  findById(id: string): Promise<ArticleBaseDto<ArticleEntity>> {
    return this.articleService.findById<ArticleEntity>(id);
  }
}

```
