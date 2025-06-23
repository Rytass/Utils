import { ObjectType } from '@nestjs/graphql';
import { BaseArticleDto } from './base-article.dto';

@ObjectType('ArticleBackstage', {
  implements: [BaseArticleDto],
})
export class ArticleBackstageDto extends BaseArticleDto {}
