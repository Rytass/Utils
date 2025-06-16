export enum ArticleStage {
  DRAFT = 'DRAFT',
  REVIEWING = 'REVIEWING',
  VERIFIED = 'VERIFIED',
  SCHEDULED = 'SCHEDULED',
  RELEASED = 'RELEASED',
}

export enum ArticleTableActions {
  View = 'View',
  Update = 'Update',
  Delete = 'Delete',
  Submit = 'Submit',
  PutBack = 'PutBack',
  Review = 'Review',
  Release = 'Release',
  Unrelease = 'Unrelease',
}

export interface ArticleTableActionsType {
  [ArticleStage.DRAFT]?: (
    | ArticleTableActions.Update
    | ArticleTableActions.Submit
    | ArticleTableActions.Release
    | ArticleTableActions.Delete
  )[];
  [ArticleStage.REVIEWING]?: (
    | ArticleTableActions.Update
    | ArticleTableActions.Review
    | ArticleTableActions.Delete
    | ArticleTableActions.PutBack
  )[];
  [ArticleStage.VERIFIED]?: (
    | ArticleTableActions.View
    | ArticleTableActions.Update
    | ArticleTableActions.Release
    | ArticleTableActions.Delete
  )[];
  [ArticleStage.SCHEDULED]?: (
    | ArticleTableActions.View
    | ArticleTableActions.Update
    | ArticleTableActions.Unrelease
  )[];
  [ArticleStage.RELEASED]?: (
    | ArticleTableActions.Update
    | ArticleTableActions.Delete
  )[];
}

export enum ArticlesPermissions {
  CreateArticle = 'CreateArticle',
  SubmitPutBackArticle = 'SubmitPutBackArticle',
  ApproveRejectArticle = 'ApproveRejectArticle',
  // Draft
  UpdateArticleInDraft = 'UpdateArticleInDraft',
  ReleaseArticleInDraft = 'ReleaseArticleInDraft',
  DeleteArticleInDraft = 'DeleteArticleInDraft',

  // Reviewing
  UpdateArticleInReviewing = 'UpdateArticleInReviewing',
  DeleteArticleInReviewing = 'DeleteArticleInReviewing',

  // Verified
  UpdateArticleInVerified = 'UpdateArticleInVerified',
  ReleaseArticleInVerified = 'ReleaseArticleInVerified',
  DeleteArticleInVerified = 'DeleteArticleInVerified',

  // Scheduled
  UpdateArticleInScheduled = 'UpdateArticleInScheduled',
  ReleaseArticleInScheduled = 'ReleaseArticleInScheduled',
  UnreleaseArticleInScheduled = 'UnreleaseArticleInScheduled',

  // Released
  UpdateArticleInReleased = 'UpdateArticleInReleased',
  ReleaseArticleInReleased = 'ReleaseArticleInReleased',
  DeleteArticleInReleased = 'DeleteArticleInReleased',
}
