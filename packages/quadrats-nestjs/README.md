# `@rytass/quadrats-nestjs`

## Usage

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { QuadratsModule } from '@rytass/quadrats-nestjs';
import { ArticleModule } from './article.module';

@Module({
  imports: [
    QuadratsModule.forRoot({
      accessKey: 'QuadratsAccessKey',
      secret: 'QuadratsSecret',
    }),
    ArticleModule,
  ],
})
export class AppModule {}

// article.module.ts
import { Module } from '@nestjs/common';
import { QuadratsModule } from '@rytass/quadrats-nestjs';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';

@Module({
  imports: [QuadratsModule],
  controllers: [ArticleController],
  providers: [ArticleService],
})
export class ArticleModule {}

// article.service.ts
import { Injectable } from '@nestjs/common';
import { QuadratsArticleService, type QuadratsArticle } from '@rytass/quadrats-nestjs';

@Injectable()
export class ArticleService {
  constructor(private readonly quadratsArticleService: QuadratsArticleService) {}

  get(id: string): Promise<QuadratsArticle | null> {
    return this.quadratsArticleService.get(id);
  }
}

// article.controller.ts
import { Controller, Get, Param } from '@nestjs/common';

@Controller('/articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get('/:articleId')
  getArticle(@Param('articleId') id: string): Promise<QuadratsArticle | null> {
    return this.articleService.get(id);
  }
}
```

### Multi-language Support

```typescript
// article.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
class ArticleService {
  constructor(private readonly quadratsArticleService: QuadratsArticleService) {}

  async addMultiLanguageArticle() {
    const article = await this.quadratsArticleService.create({
      title: 'Multiple Language',
      categoryIds: [],
      tags: ['Chinese', 'English'],
      languageContents: [
        {
          elements: [
            {
              type: 'p',
              children: [{ text: '中文內容' }],
            },
          ],
          language: 'zh-Hant',
        },
        {
          elements: [
            {
              type: 'p',
              children: [{ text: 'English Content' }],
            },
          ],
          language: 'en',
        },
      ],
    });
  }
}
```
