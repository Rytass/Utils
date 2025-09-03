---
sidebar_position: 2
---

# ArticleBaseService

**ArticleBaseService** provides fundamental article operation functionalities, including creating new articles, adding versions, and searching for articles.

## References

### Methods

#### `findById()`

```tsx
findById(id: string, options?: ArticleFindByIdBaseDto): Promise<ArticleBaseDto>
```

**Parameters:**
| Name | Type | Default | Description |
| --------- | -------- | --------- | ------------------------------------------------------------------------------------ |
| id | uuid | | Article ID |

**ArticleFindByIdBaseDto:**
| Name | Type | Default | Description |
| ------------- | -------- | --------- | ------------------------------------------------------------------------------------ |
| language | string | | If provided, multiple language mode article will return article like single language |
| onlyApproved | boolean | false | When signature mode enabled, pass this args to filter approved version |

#### `findAll()`

```tsx
findAll(options?: ArticleFindAllDto): Promise<ArticleBaseDto[]>
```

Also support **findCollection** with same arguments to support pagination.

```ts
interface ArticleCollectionDto {
  articles: ArticleBaseDto[];
  total: number;
  offset: number;
  limit: number;
}

findCollection(options?: ArticleFindAllDto): Promise<ArticleCollectionDto>
```

**Parameters:**

| Name                | Type    | Default         | Description                                                                          |
| ------------------- | ------- | --------------- | ------------------------------------------------------------------------------------ | -------------- | --------- |
| ids                 | uuid[]  |                 | Find articles in id list                                                             |
| categoryIds         | uuid[]  |                 | Category filter (At least one)                                                       |
| requiredCategoryIds | uuid[]  |                 | Category filter (Required)                                                           |
| language            | string  |                 | If provided, multiple language mode article will return article like single language |
| sorted              | enum    | CREATED_AT_DESC | CREATED_AT_DESC                                                                      | CREATED_AT_ASC |
| searchTerm          | string  |                 | Search term in title, description, if use full_text_mode will find in contents       |
| searchMode          | enum    | TITLE           | TITLE                                                                                | TITLE_AND_TAG  | FULL_TEXT |
| onlyApproved        | boolean | false           | When signature mode enabled, pass this args to filter approved version               |
| offset              | number  | 0               | Result list pagination offset                                                        |
| limit               | number  | 20              | Result list pagination limit, max 100                                                |

### Interfaces

#### `ArticleBaseDto`

**ArticleBaseDto** is union of **SingleArticleBaseDto** and **MultiLanguageArticleBaseDto**. It will automatically switch based on whether you have enabled the multilingual mode. When multilingual mode is not enabled, using **findById** or **findAll** queries will automatically return the article content in the **SingleArticleBaseDto** structure. Conversely, if multilingual mode is enabled, the content will be in the **MultiLanguageArticleBaseDto** structure. However, if you specify a **language** when querying in multilingual mode, the content returned to you will be in the **SingleArticleBaseDto** format and in the specified language.

#### `SingleArticleBaseDto`

**Fields:**

| Name        | Type                 | Description         |
| ----------- | -------------------- | ------------------- |
| id          | uuid                 | Article ID          |
| createdAt   | Date                 | Article create time |
| deletedAt   | Date                 | Article delete time |
| version     | number               | Article version     |
| categories  | BaseCategoryEntity[] | Article categories  |
| tags        | string[]             | Article tags        |
| language    | string               | Article language    |
| title       | string               | Article title       |
| description | string               | Article description |
| content     | QuadratsElement[]    | Article content     |

#### `MultiLanguageArticleBaseDto`

**Fields:**

| Name                  | Type                              | Description         |
| --------------------- | --------------------------------- | ------------------- |
| id                    | uuid                              | Article ID          |
| createdAt             | Date                              | Article create time |
| deletedAt             | Date                              | Article delete time |
| version               | number                            | Article version     |
| categories            | BaseCategoryEntity[]              | Article categories  |
| tags                  | string[]                          | Article tags        |
| multiLanguageContents | BaseArticleVersionContentEntity[] | Article content     |
