---
sidebar_position: 5
---

# Signature Mode

The library supports a signature mode, which can serve as a supplement to version control or as a common draft mode. All signatures are tied to specific versions of articles, and you can define the required signature workflows, including permission check parameters for each step in the process.

```typescript title="src/app.module.ts"
import { Module } from '@nestjs/common';
import { CMSBaseModule } from '@rytass/cms-base-nestjs-module';

@Module({
  imports: [
    // ... (typeorm register)
    CMSBaseModule.forRoot({
      signatureMode: true,
    }),
  ],
})
export class AppModule {}
```

When you enable signature mode without specifying any signature steps, the system defaults to requiring a single signature for all versions of an article. This mode is commonly used in content management systems (CMS) that include a draft feature. The following example will help you understand how to implement a CMS with draft functionality.

```typescript title="src/app.service.ts"
import { Injectable } from '@nestjs/common';
import {
  ArticleBaseService,
  ArticleSignatureService,
  BaseArticleEntity,
  EMPTY_QUADRATS_ELEMENTS,
  ArticleSignatureEntity,
  ArticleBaseDto,
} from '@rytass/cms-base-nestjs-module';
import { QuadratsElement } from '@quadrats/core';

@Injectable()
export class AppService {
  constructor(
    private readonly articleService: ArticleBaseService,
    private readonly signatureService: ArticleSignatureService,
  ) {}

  create(title: string, content: QuadratsElement[] = EMPTY_QUADRATS_ELEMENTS): Promise<BaseArticleEntity> {
    return this.articleService.create({
      title,
      content,
    });
  }

  addVersion(
    id: string,
    title: string,
    content: QuadratsElement[] = EMPTY_QUADRATS_ELEMENTS,
  ): Promise<BaseArticleEntity> {
    return this.articleService.addVersion(id, {
      title,
      content,
    });
  }

  release(id: string, signerId?: string): Promise<ArticleSignatureEntity> {
    const article = await this.articleService.findById(id);

    if (!article) {
      throw new Error('Article Not Found');
    }

    return this.signatureService.approveVersion(article, {
      signerId: signerId ?? null,
    });
  }

  findApproved(): Promise<ArticleBaseDto[]> {
    return this.articleService.findAll({
      onlyApproved: true,
    });
  }

  findLatest(): Promise<ArticleBaseDto[]> {
    return this.articleService.findAll();
  }

  async onApplicationBootstrap() {
    const articleA = await this.create('TestArticleA');
    const articleB = await this.create('TestArticleB');

    let listLatest = await this.findLatest(); // [TestArticleA Version: 0, TestArticleB Version: 0]
    let listApproved = await this.findApproved(); // []

    await this.release(articleA.id);

    let listLatest = await this.findLatest(); // [TestArticleA Version: 0, TestArticleB Version: 0]
    let listApproved = await this.findApproved(); // [TestArticleA Version: 0]

    await this.addVersion(articleA.id, 'TestArticleA2');

    let listLatest = await this.findLatest(); // [TestArticleA Version: 1, TestArticleB Version: 0]
    let listApproved = await this.findApproved(); // [TestArticleA Version: 0]
  }
}
```

In the example above, **findApproved** will only return article versions that have been approved. If a new version of an article has been created but not yet approved, the library will only return the most recent approved version. On the other hand, **findLatest** will always return the latest version of the article, regardless of approval status.

Additionally, you can use the **ArticleSignatureDataLoader** to retrieve the signature status of a version and compare it with the cache in the **ArticleSignatureService** to determine if the version has been published.

```typescript title="src/app.service.ts"
import { Injectable } from '@nestjs/common';
import {
  ArticleBaseService,
  ArticleSignatureService,
  BaseArticleEntity,
  EMPTY_QUADRATS_ELEMENTS,
  ArticleSignatureEntity,
  ArticleBaseDto,
} from '@rytass/cms-base-nestjs-module';
import { QuadratsElement } from '@quadrats/core';

@Injectable()
export class AppService {
  constructor(
    private readonly articleService: ArticleBaseService,
    private readonly signatureService: ArticleSignatureService,
    private readonly signatureDataLoader: ArticleSignatureDataLoader,
  ) {}

  // ... other implements

  async onApplicationBootstrap() {
    const articles = await this.articleService.findAll();

    const articleSignatures = await this.signatureDataLoader.versionSignaturesLoader.loadMany(
      articles.map(article => `${article.id}|${article.version}`),
    );

    console.log(articleSignatures); // ArticleSignatureEntity[][]
  }
}
```

## Custom Signature Steps

In addition to simple single-step reviews, you can also customize multi-layer review processes. Articles will only be accessible via **onlyApproved** after they have completed all the necessary review steps.

Through the levels specified by **signatureLevels**, the library will automatically create SignatureLevels in the database. Note that if you make changes during multiple deployments, the system will automatically delete records of levels that have been removed.

```typescript title="src/app.module.ts"
import { Module } from '@nestjs/common';
import { CMSBaseModule } from '@rytass/cms-base-nestjs-module';

@Module({
  imports: [
    // ... (typeorm register)
    CMSBaseModule.forRoot({
      signatureMode: true,
      signatureLevels: ['manager', 'admin'],
    }),
  ],
})
export class AppModule {}
```

When you use **signatureLevels** to create a signing process, you must specify to the library the identity you are signing on behalf of each time you perform a signature.
You must perform the signatures in order; otherwise, the system will throw an error.

```typescript title="src/app.service.ts"
@Injectable()
export class AppService {
  constructor(
    private readonly articleService: ArticleBaseService,
    private readonly signatureService: ArticleSignatureService,
    private readonly signatureDataLoader: ArticleSignatureDataLoader,
  ) {}

  // ... other implements

  async onApplicationBootstrap() {
    const article = await this.articleService.findById('some-fresh-article-id');

    // will throw
    await this.signatureService.approveVersion(article, {
      signatureLevel: 'admin',
    });

    // will throw ArticleNotFoundError
    const notSigned = await this.articleService.findById('some-fresh-article-id', {
      onlyApproved: true,
    });

    await this.signatureService.approveVersion(article, {
      signatureLevel: 'manager',
    });

    // will throw ArticleNotFoundError
    const notSigned = await this.articleService.findById('some-fresh-article-id', {
      onlyApproved: true,
    });

    await this.signatureService.approveVersion(article, {
      signatureLevel: 'admin',
    });

    // will return signed article
    const signed = await this.articleService.findById('some-fresh-article-id', {
      onlyApproved: true,
    });

    // list only manager approved
    const articles = await this.articleService.findAll({
      signatureLevel: 'manager',
    });
  }
}
```
