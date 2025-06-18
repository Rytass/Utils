import { FieldValues } from 'react-hook-form';
import { StandardCMSFormActionsEventsProps } from '../typings';
import { ArticleStage, ArticlesPermissions } from '../../../typings';

export function useSubmitButton<T extends FieldValues>({
  values,
  currentStage,
  userPermissions,
  actionsEvents,
}: {
  values: T;
  currentStage: ArticleStage;
  userPermissions: ArticlesPermissions[];
  actionsEvents: StandardCMSFormActionsEventsProps<T>;
}): {
  text: string;
  onSubmit?: () => Promise<void>;
} {
  return {
    text: '送審',
    onSubmit: async () => {},
  };
}
