import { havePermission } from '../src/utils/havePermission';
import { ArticlesPermissions } from '../src/typings';

describe('havePermission', () => {
  describe('when user has the target permission', () => {
    it('should return true for CreateArticle permission', () => {
      const result = havePermission({
        userPermissions: [ArticlesPermissions.CreateArticle],
        targetPermission: ArticlesPermissions.CreateArticle,
      });

      expect(result).toBe(true);
    });

    it('should return true when permission is among multiple permissions', () => {
      const result = havePermission({
        userPermissions: [
          ArticlesPermissions.CreateArticle,
          ArticlesPermissions.UpdateArticleInDraft,
          ArticlesPermissions.DeleteArticleInDraft,
        ],
        targetPermission: ArticlesPermissions.UpdateArticleInDraft,
      });

      expect(result).toBe(true);
    });

    it('should return true for the first permission in the list', () => {
      const result = havePermission({
        userPermissions: [ArticlesPermissions.ApproveRejectArticle, ArticlesPermissions.CreateArticle],
        targetPermission: ArticlesPermissions.ApproveRejectArticle,
      });

      expect(result).toBe(true);
    });

    it('should return true for the last permission in the list', () => {
      const result = havePermission({
        userPermissions: [
          ArticlesPermissions.CreateArticle,
          ArticlesPermissions.UpdateArticleInDraft,
          ArticlesPermissions.ReleaseArticleInVerified,
        ],
        targetPermission: ArticlesPermissions.ReleaseArticleInVerified,
      });

      expect(result).toBe(true);
    });
  });

  describe('when user does not have the target permission', () => {
    it('should return false for missing permission', () => {
      const result = havePermission({
        userPermissions: [ArticlesPermissions.CreateArticle],
        targetPermission: ArticlesPermissions.DeleteArticleInDraft,
      });

      expect(result).toBe(false);
    });

    it('should return false for empty permissions array', () => {
      const result = havePermission({
        userPermissions: [],
        targetPermission: ArticlesPermissions.CreateArticle,
      });

      expect(result).toBe(false);
    });

    it('should return false when permission is not in the list', () => {
      const result = havePermission({
        userPermissions: [
          ArticlesPermissions.UpdateArticleInDraft,
          ArticlesPermissions.DeleteArticleInDraft,
          ArticlesPermissions.SubmitPutBackArticle,
        ],
        targetPermission: ArticlesPermissions.WithdrawArticleInReleased,
      });

      expect(result).toBe(false);
    });
  });

  describe('permission types coverage', () => {
    const allPermissions = Object.values(ArticlesPermissions);

    it('should correctly check all permission types', () => {
      allPermissions.forEach(permission => {
        const result = havePermission({
          userPermissions: allPermissions,
          targetPermission: permission,
        });

        expect(result).toBe(true);
      });
    });
  });
});
