import { ReactNode } from 'react';
import { FieldValues, UseFormReturn } from 'react-hook-form';
import { ArticleStage, ArticlesPermissions } from '../../typings';

export interface StandardCMSFormActionsEventsProps<T extends FieldValues> {
  onLeave?: (values: T) => Promise<void>;
  onGoToEdit?: (values: T) => Promise<void>;
  onCreateToDraft?: (values: T) => Promise<void>;
  onCreateAndRelease?: (values: T, releasedAt: string) => Promise<void>;
  onCreateAndApprove?: (values: T) => Promise<void>;
  onCreateAndSubmit?: (values: T) => Promise<void>;
  onUpdateToDraft?: (values: T) => Promise<void>;
  onUpdateAndRelease?: (values: T, releasedAt: string) => Promise<void>;
  onUpdateAndApprove?: (values: T) => Promise<void>;
  onUpdateAndSubmit?: (values: T) => Promise<void>;
  onRelease?: (values: T, releasedAt: string) => Promise<void>;
  onApprove?: (values: T) => Promise<void>;
  onReject?: (values: T, reason: string) => Promise<void>;
  onSubmit?: (values: T) => Promise<void>;
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
