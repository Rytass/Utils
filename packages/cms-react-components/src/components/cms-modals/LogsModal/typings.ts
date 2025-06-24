import { ArticleStage } from '../../../typings';

export interface LogsData {
  [ArticleStage.DRAFT]: {
    updatedAt: string;
    updatedBy: string;
    version?: number;
    reason?: string;
  };
  [ArticleStage.REVIEWING]: {
    submittedAt: string;
    submittedBy: string;
    version?: number;
  };
  [ArticleStage.VERIFIED]: {
    verifiedAt: string;
    verifiedBy: string;
    version?: number;
  };
  [ArticleStage.SCHEDULED]: {
    scheduledAt: string;
    scheduledBy: string;
    version?: number;
  };
  [ArticleStage.RELEASED]: {
    releasedAt: string;
    releasedBy: string;
    version?: number;
  };
}
