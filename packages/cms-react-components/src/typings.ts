export enum ArticleStage {
  DRAFT = 'DRAFT',
  REVIEWING = 'REVIEWING',
  VERIFIED = 'VERIFIED',
  SCHEDULED = 'SCHEDULED',
  RELEASED = 'RELEASED',
}

export enum ArticlesPermissions {
  CreateUpdateArticle = 'CreateUpdateArticle',
  DeleteArticle = 'DeleteArticle',
  SubmitPutBackArticle = 'SubmitPutBackArticle',
  ApproveRejectArticle = 'ApproveRejectArticle',
  ReleaseUnreleaseArticle = 'ReleaseUnreleaseArticle',
}
