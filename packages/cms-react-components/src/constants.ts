import { ArticlesPermissions } from './typings';

export const defaultAdminRolePermissions = [
  ArticlesPermissions.CreateUpdateArticle,
  ArticlesPermissions.DeleteArticle,
  ArticlesPermissions.ApproveRejectArticle,
  ArticlesPermissions.ReleaseUnreleaseArticle,
];

export const defaultGeneralRolePermissions = [
  ArticlesPermissions.CreateUpdateArticle,
  ArticlesPermissions.DeleteArticle,
  ArticlesPermissions.SubmitPutBackArticle,
  ArticlesPermissions.ReleaseUnreleaseArticle,
];
