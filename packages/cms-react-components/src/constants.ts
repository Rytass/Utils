import {
  ArticleTableActions,
  ArticlesPermissions,
  ArticleTableActionsType,
  ArticleStage,
} from './typings';

export const defaultAdminRolePermissions = [
  ArticlesPermissions.CreateArticle,
  ArticlesPermissions.ApproveRejectArticle,
  // Draft
  ArticlesPermissions.UpdateArticleInDraft,
  ArticlesPermissions.DeleteArticleInDraft,
  // Reviewing
  ArticlesPermissions.UpdateArticleInReviewing,
  ArticlesPermissions.DeleteArticleInReviewing,
  // Verified
  ArticlesPermissions.UpdateArticleInVerified,
  ArticlesPermissions.ReleaseArticleInVerified,
  ArticlesPermissions.DeleteArticleInVerified,
  // Scheduled
  ArticlesPermissions.UpdateArticleInScheduled,
  ArticlesPermissions.ReleaseArticleInScheduled,
  ArticlesPermissions.WithdrawArticleInScheduled,
  // Released
  ArticlesPermissions.UpdateArticleInReleased,
  ArticlesPermissions.ReleaseArticleInReleased,
  ArticlesPermissions.DeleteArticleInReleased,
];

export const defaultGeneralRolePermissions = [
  ArticlesPermissions.CreateArticle,
  ArticlesPermissions.SubmitPutBackArticle,
  // Draft
  ArticlesPermissions.UpdateArticleInDraft,
  ArticlesPermissions.DeleteArticleInDraft,
  // Reviewing
  ArticlesPermissions.UpdateArticleInReviewing,
  // Verified
  ArticlesPermissions.ReleaseArticleInVerified,
  // Scheduled
  ArticlesPermissions.ReleaseArticleInScheduled,
  ArticlesPermissions.WithdrawArticleInScheduled,
  // Released
  ArticlesPermissions.UpdateArticleInReleased,
];

export const defaultTableActions: ArticleTableActionsType = {
  [ArticleStage.DRAFT]: [
    ArticleTableActions.Update,
    ArticleTableActions.Submit,
    ArticleTableActions.Release,
    ArticleTableActions.Delete,
  ],
  [ArticleStage.REVIEWING]: [
    ArticleTableActions.Update,
    ArticleTableActions.Review,
    ArticleTableActions.Delete,
    ArticleTableActions.PutBack,
  ],
  [ArticleStage.VERIFIED]: [
    ArticleTableActions.View,
    ArticleTableActions.Update,
    ArticleTableActions.Release,
    ArticleTableActions.Delete,
  ],
  [ArticleStage.SCHEDULED]: [
    ArticleTableActions.View,
    ArticleTableActions.Update,
    ArticleTableActions.Withdraw,
  ],
  [ArticleStage.RELEASED]: [
    ArticleTableActions.Update,
    ArticleTableActions.Delete,
  ],
};
