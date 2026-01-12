import { ArticleStage, ArticleTableActions, ArticlesPermissions } from '../src/typings';

describe('CMS React Components Typings', () => {
  describe('ArticleStage enum', () => {
    it('should have DRAFT stage', () => {
      expect(ArticleStage.DRAFT).toBe('DRAFT');
    });

    it('should have REVIEWING stage', () => {
      expect(ArticleStage.REVIEWING).toBe('REVIEWING');
    });

    it('should have VERIFIED stage', () => {
      expect(ArticleStage.VERIFIED).toBe('VERIFIED');
    });

    it('should have SCHEDULED stage', () => {
      expect(ArticleStage.SCHEDULED).toBe('SCHEDULED');
    });

    it('should have RELEASED stage', () => {
      expect(ArticleStage.RELEASED).toBe('RELEASED');
    });

    it('should have UNKNOWN stage', () => {
      expect(ArticleStage.UNKNOWN).toBe('UNKNOWN');
    });

    it('should have exactly 6 stages', () => {
      expect(Object.keys(ArticleStage)).toHaveLength(6);
    });
  });

  describe('ArticleTableActions enum', () => {
    it('should have View action', () => {
      expect(ArticleTableActions.View).toBe('View');
    });

    it('should have Update action', () => {
      expect(ArticleTableActions.Update).toBe('Update');
    });

    it('should have Delete action', () => {
      expect(ArticleTableActions.Delete).toBe('Delete');
    });

    it('should have Submit action', () => {
      expect(ArticleTableActions.Submit).toBe('Submit');
    });

    it('should have PutBack action', () => {
      expect(ArticleTableActions.PutBack).toBe('PutBack');
    });

    it('should have Review action', () => {
      expect(ArticleTableActions.Review).toBe('Review');
    });

    it('should have Release action', () => {
      expect(ArticleTableActions.Release).toBe('Release');
    });

    it('should have Withdraw action', () => {
      expect(ArticleTableActions.Withdraw).toBe('Withdraw');
    });

    it('should have exactly 8 actions', () => {
      expect(Object.keys(ArticleTableActions)).toHaveLength(8);
    });
  });

  describe('ArticlesPermissions enum', () => {
    it('should have CreateArticle permission', () => {
      expect(ArticlesPermissions.CreateArticle).toBe('CreateArticle');
    });

    it('should have SubmitPutBackArticle permission', () => {
      expect(ArticlesPermissions.SubmitPutBackArticle).toBe('SubmitPutBackArticle');
    });

    it('should have ApproveRejectArticle permission', () => {
      expect(ArticlesPermissions.ApproveRejectArticle).toBe('ApproveRejectArticle');
    });

    // Draft permissions
    it('should have UpdateArticleInDraft permission', () => {
      expect(ArticlesPermissions.UpdateArticleInDraft).toBe('UpdateArticleInDraft');
    });

    it('should have DeleteArticleInDraft permission', () => {
      expect(ArticlesPermissions.DeleteArticleInDraft).toBe('DeleteArticleInDraft');
    });

    // Reviewing permissions
    it('should have UpdateArticleInReviewing permission', () => {
      expect(ArticlesPermissions.UpdateArticleInReviewing).toBe('UpdateArticleInReviewing');
    });

    it('should have DeleteArticleInReviewing permission', () => {
      expect(ArticlesPermissions.DeleteArticleInReviewing).toBe('DeleteArticleInReviewing');
    });

    // Verified permissions
    it('should have UpdateArticleInVerified permission', () => {
      expect(ArticlesPermissions.UpdateArticleInVerified).toBe('UpdateArticleInVerified');
    });

    it('should have ReleaseArticleInVerified permission', () => {
      expect(ArticlesPermissions.ReleaseArticleInVerified).toBe('ReleaseArticleInVerified');
    });

    it('should have DeleteArticleInVerified permission', () => {
      expect(ArticlesPermissions.DeleteArticleInVerified).toBe('DeleteArticleInVerified');
    });

    // Scheduled permissions
    it('should have UpdateArticleInScheduled permission', () => {
      expect(ArticlesPermissions.UpdateArticleInScheduled).toBe('UpdateArticleInScheduled');
    });

    it('should have ReleaseArticleInScheduled permission', () => {
      expect(ArticlesPermissions.ReleaseArticleInScheduled).toBe('ReleaseArticleInScheduled');
    });

    it('should have WithdrawArticleInScheduled permission', () => {
      expect(ArticlesPermissions.WithdrawArticleInScheduled).toBe('WithdrawArticleInScheduled');
    });

    // Released permissions
    it('should have UpdateArticleInReleased permission', () => {
      expect(ArticlesPermissions.UpdateArticleInReleased).toBe('UpdateArticleInReleased');
    });

    it('should have ReleaseArticleInReleased permission', () => {
      expect(ArticlesPermissions.ReleaseArticleInReleased).toBe('ReleaseArticleInReleased');
    });

    it('should have WithdrawArticleInReleased permission', () => {
      expect(ArticlesPermissions.WithdrawArticleInReleased).toBe('WithdrawArticleInReleased');
    });

    it('should have DeleteArticleInReleased permission', () => {
      expect(ArticlesPermissions.DeleteArticleInReleased).toBe('DeleteArticleInReleased');
    });

    it('should have exactly 17 permissions', () => {
      expect(Object.keys(ArticlesPermissions)).toHaveLength(17);
    });
  });
});
