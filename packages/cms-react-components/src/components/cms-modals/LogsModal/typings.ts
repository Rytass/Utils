export interface LogsData {
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  submittedAt: string;
  submittedBy: string;
  verifiedAt: string;
  verifiedBy: string;
  releasedAt: string;
  releasedBy: string;
  version?: number;
  reason?: string;
}
