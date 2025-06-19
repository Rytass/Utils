import { FieldValues } from 'react-hook-form';
import { StandardCMSFormActionsEventsProps } from '../typings';
import { ArticleStage, ArticlesPermissions } from '../../../typings';

export function useActionButton<T extends FieldValues>({
  values,
  createMode,
  currentStage,
  userPermissions,
  actionsEvents,
}: {
  values: T;
  createMode?: boolean;
  currentStage: ArticleStage;
  userPermissions: ArticlesPermissions[];
  actionsEvents: StandardCMSFormActionsEventsProps<T>;
}): {
  text: string;
  onAction?: () => Promise<void>;
} {
  return {
    text: '儲存草稿',
    onAction: async () => {},
  };
}
