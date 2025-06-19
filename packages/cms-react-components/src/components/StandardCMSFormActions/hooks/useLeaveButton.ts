import { FieldValues } from 'react-hook-form';
import { StandardCMSFormActionsEventsProps } from '../typings';
import { ArticleStage, ArticlesPermissions } from '../../../typings';

export function useLeaveButton<T extends FieldValues>({
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
  onLeave?: () => Promise<void>;
} {
  return {
    text: '離開',
    onLeave: async () => {},
  };
}
