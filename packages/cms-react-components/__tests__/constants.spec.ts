import { defaultAdminRolePermissions, defaultGeneralRolePermissions, defaultTableActions } from '../src/constants';
import { ArticleStage, ArticleTableActions, ArticlesPermissions } from '../src/typings';

describe('CMS React Components Constants', () => {
  describe('defaultAdminRolePermissions', () => {
    it('should include CreateArticle permission', () => {
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.CreateArticle);
    });

    it('should include ApproveRejectArticle permission', () => {
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.ApproveRejectArticle);
    });

    it('should include all draft permissions', () => {
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.UpdateArticleInDraft);
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.DeleteArticleInDraft);
    });

    it('should include all reviewing permissions', () => {
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.UpdateArticleInReviewing);
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.DeleteArticleInReviewing);
    });

    it('should include all verified permissions', () => {
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.UpdateArticleInVerified);
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.ReleaseArticleInVerified);
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.DeleteArticleInVerified);
    });

    it('should include all scheduled permissions', () => {
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.UpdateArticleInScheduled);
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.ReleaseArticleInScheduled);
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.WithdrawArticleInScheduled);
    });

    it('should include all released permissions', () => {
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.UpdateArticleInReleased);
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.ReleaseArticleInReleased);
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.WithdrawArticleInReleased);
      expect(defaultAdminRolePermissions).toContain(ArticlesPermissions.DeleteArticleInReleased);
    });

    it('should not include SubmitPutBackArticle permission', () => {
      expect(defaultAdminRolePermissions).not.toContain(ArticlesPermissions.SubmitPutBackArticle);
    });
  });

  describe('defaultGeneralRolePermissions', () => {
    it('should include CreateArticle permission', () => {
      expect(defaultGeneralRolePermissions).toContain(ArticlesPermissions.CreateArticle);
    });

    it('should include SubmitPutBackArticle permission', () => {
      expect(defaultGeneralRolePermissions).toContain(ArticlesPermissions.SubmitPutBackArticle);
    });

    it('should include draft permissions', () => {
      expect(defaultGeneralRolePermissions).toContain(ArticlesPermissions.UpdateArticleInDraft);
      expect(defaultGeneralRolePermissions).toContain(ArticlesPermissions.DeleteArticleInDraft);
    });

    it('should include UpdateArticleInReviewing permission', () => {
      expect(defaultGeneralRolePermissions).toContain(ArticlesPermissions.UpdateArticleInReviewing);
    });

    it('should include ReleaseArticleInVerified permission', () => {
      expect(defaultGeneralRolePermissions).toContain(ArticlesPermissions.ReleaseArticleInVerified);
    });

    it('should include scheduled permissions', () => {
      expect(defaultGeneralRolePermissions).toContain(ArticlesPermissions.ReleaseArticleInScheduled);
      expect(defaultGeneralRolePermissions).toContain(ArticlesPermissions.WithdrawArticleInScheduled);
    });

    it('should include UpdateArticleInReleased permission', () => {
      expect(defaultGeneralRolePermissions).toContain(ArticlesPermissions.UpdateArticleInReleased);
    });

    it('should not include ApproveRejectArticle permission', () => {
      expect(defaultGeneralRolePermissions).not.toContain(ArticlesPermissions.ApproveRejectArticle);
    });
  });

  describe('defaultTableActions', () => {
    it('should have actions for DRAFT stage', () => {
      const draftActions = defaultTableActions[ArticleStage.DRAFT];

      expect(draftActions).toContain(ArticleTableActions.Update);
      expect(draftActions).toContain(ArticleTableActions.Submit);
      expect(draftActions).toContain(ArticleTableActions.Release);
      expect(draftActions).toContain(ArticleTableActions.Delete);
      expect(draftActions).toHaveLength(4);
    });

    it('should have actions for REVIEWING stage', () => {
      const reviewingActions = defaultTableActions[ArticleStage.REVIEWING];

      expect(reviewingActions).toContain(ArticleTableActions.Update);
      expect(reviewingActions).toContain(ArticleTableActions.Review);
      expect(reviewingActions).toContain(ArticleTableActions.Delete);
      expect(reviewingActions).toContain(ArticleTableActions.PutBack);
      expect(reviewingActions).toHaveLength(4);
    });

    it('should have actions for VERIFIED stage', () => {
      const verifiedActions = defaultTableActions[ArticleStage.VERIFIED];

      expect(verifiedActions).toContain(ArticleTableActions.View);
      expect(verifiedActions).toContain(ArticleTableActions.Update);
      expect(verifiedActions).toContain(ArticleTableActions.Release);
      expect(verifiedActions).toContain(ArticleTableActions.Delete);
      expect(verifiedActions).toHaveLength(4);
    });

    it('should have actions for SCHEDULED stage', () => {
      const scheduledActions = defaultTableActions[ArticleStage.SCHEDULED];

      expect(scheduledActions).toContain(ArticleTableActions.View);
      expect(scheduledActions).toContain(ArticleTableActions.Update);
      expect(scheduledActions).toContain(ArticleTableActions.Withdraw);
      expect(scheduledActions).toHaveLength(3);
    });

    it('should have actions for RELEASED stage', () => {
      const releasedActions = defaultTableActions[ArticleStage.RELEASED];

      expect(releasedActions).toContain(ArticleTableActions.Update);
      expect(releasedActions).toContain(ArticleTableActions.Delete);
      expect(releasedActions).toHaveLength(2);
    });

    it('should have empty actions for UNKNOWN stage', () => {
      const unknownActions = defaultTableActions[ArticleStage.UNKNOWN];

      expect(unknownActions).toHaveLength(0);
    });

    it('should have actions for all stages', () => {
      expect(Object.keys(defaultTableActions)).toContain(ArticleStage.DRAFT);
      expect(Object.keys(defaultTableActions)).toContain(ArticleStage.REVIEWING);
      expect(Object.keys(defaultTableActions)).toContain(ArticleStage.VERIFIED);
      expect(Object.keys(defaultTableActions)).toContain(ArticleStage.SCHEDULED);
      expect(Object.keys(defaultTableActions)).toContain(ArticleStage.RELEASED);
      expect(Object.keys(defaultTableActions)).toContain(ArticleStage.UNKNOWN);
    });
  });
});
