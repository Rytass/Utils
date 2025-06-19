import { ReactNode } from 'react';
import { FieldValues, UseFormReturn } from 'react-hook-form';
import { ArticleStage, ArticlesPermissions } from '../../typings';

export interface StandardCMSFormActionsEventsProps<T extends FieldValues> {
  onLeave?: (source: T) => Promise<void>;
  onGoToEdit?: (source: T) => Promise<void>;
  onCreateToDraft?: (source: T) => Promise<void>;
  onCreateAndRelease?: (source: T, releasedAt: string) => Promise<void>;
  onCreateAndApprove?: (source: T) => Promise<void>;
  onCreateAndSubmit?: (source: T) => Promise<void>;
  onUpdateToDraft?: (source: T) => Promise<void>;
  onUpdateAndRelease?: (source: T, releasedAt: string) => Promise<void>;
  onUpdateAndApprove?: (source: T) => Promise<void>;
  onUpdateAndSubmit?: (source: T) => Promise<void>;
  onRelease?: (source: T, releasedAt: string) => Promise<void>;
  onApprove?: (source: T) => Promise<void>;
  onReject?: (source: T, reason: string) => Promise<void>;
  onSubmit?: (source: T) => Promise<void>;
}

export interface StandardCMSFormActionsProps<T extends FieldValues> {
  className?: string;
  actionsClassName?: string;
  methods: UseFormReturn<T>;
  leaveButtonText?: string;
  actionButtonText?: string;
  submitButtonText?: string;
  disableLeaveButton?: (values: T) => boolean;
  disableActionButton?: (values: T) => boolean;
  disableSubmitButton?: (values: T) => boolean;
  onLeave?: (values: T) => Promise<void>;
  onAction?: (values: T) => Promise<void>;
  onSubmit?: (values: T) => Promise<void>;
  children: ReactNode;
  createMode?: boolean;
  currentStage: ArticleStage;
  userPermissions: ArticlesPermissions[];
  actionsEvents: StandardCMSFormActionsEventsProps<T>;
}
