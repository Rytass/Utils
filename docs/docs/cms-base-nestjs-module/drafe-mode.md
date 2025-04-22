---
sidebar_position: 5
---

# Draft Mode

If you enable draft mode, you should release each version before user find it. In default, findAll only return released latest version.

```typescript title="src/app.module.ts"
import { Module } from '@nestjs/common';
import { CMSBaseModule } from '@rytass/cms-base-nestjs-module';

@Module({
  imports: [
    // ... (typeorm register)
    CMSBaseModule.forRoot({
      enableDraftMode: true,
    }),
  ],
})
export class AppModule {}
```

```typescript title="src/app.service.ts"
import { Injectable } from '@nestjs/common';
import { ArticleBaseService, ArticleFindVersionType } from '@rytass/cms-base-nestjs-module';
import { QuadratsElement } from '@quadrats/core';

@Injectable()
export class AppService {
  constructor(
    private readonly articleService: ArticleBaseService,
  ) {}

  async onApplicationBootstrap() {
    const article = await this.articleService.create({
      title: 'Test Article',
      content: EMPTY_QUADRATS_ELEMENTS,
    });

    const articlesBeforeRelease = await this.articleService.findAll();
    // []

    const articlesBeforeReleaseForAdmin = await this.articleService.findAll({
      versionType: ArticleFindVersionType.LATEST,
    });
    // [{ title: 'Test Article' }]

    const releasedArticle = await this.articleService.release(article.id);

    const articlesAfterRelease = await this.articleService.findAll();
    // [{ title: 'Test Article' }]

    await this.articleService.addVersion(article.id, {
      title: 'Test Article V2',
      content: EMPTY_QUADRATS_ELEMENTS,
    });

    const articlesAfterAddVersion = await this.articleService.findAll();
    // [{ title: 'Test Article' }]

    const articlesAfterAddVersionForAdmin = await this.articleService.findAll({
      versionType: ArticleFindVersionType.LATEST,
    });
    // [{ title: 'Test Article V2' }]

    const releasedV2Article = await this.articleService.release(article.id);

    const articlesAfterV2Release = await this.articleService.findAll();
    // [{ title: 'Test Article V2' }]
  }
}
```
