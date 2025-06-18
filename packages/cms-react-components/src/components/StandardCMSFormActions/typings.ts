import { ReactNode } from 'react';
import { FieldValues, UseFormReturn } from 'react-hook-form';
import { ArticleStage, ArticlesPermissions } from '../../typings';

export interface StandardCMSFormActionsEventsProps<T extends FieldValues> {
  onSaveDraft?: (source: T) => Promise<void>;
}

export interface StandardCMSFormActionsProps<T extends FieldValues> {
  className?: string;
  actionsClassName?: string;
  methods: UseFormReturn<T>;
  disableLeaveButton?: (values: T) => boolean;
  disableActionButton?: (values: T) => boolean;
  disableSubmitButton?: (values: T) => boolean;
  children: ReactNode;
  currentStage: ArticleStage;
  userPermissions: ArticlesPermissions[];
  actionsEvents: StandardCMSFormActionsEventsProps<T>;
}
