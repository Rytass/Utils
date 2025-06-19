import { FieldValues } from 'react-hook-form';
import { havePermission } from '../../../utils/havePermission';
import { StandardCMSFormActionsEventsProps } from '../typings';
import { ArticleStage, ArticlesPermissions } from '../../../typings';

export function useActionButton<T extends FieldValues>({
  values,
  isDirty,
  createMode,
  currentStage,
  userPermissions,
  actionsEvents,
}: {
  values: T;
  isDirty: boolean;
  createMode?: boolean;
  currentStage: ArticleStage;
  userPermissions: ArticlesPermissions[];
  actionsEvents: StandardCMSFormActionsEventsProps<T>;
}): {
  text: string;
  danger?: boolean;
  onAction?: () => Promise<void>;
} {
  if (createMode) {
    if (
      havePermission({
        userPermissions,
        targetPermission: ArticlesPermissions.CreateArticle,
      })
    ) {
      return {
        text: '儲存草稿',
        onAction: async () => {
          await actionsEvents.onCreateDraft?.(values);
        },
      };
    }

    return {
      text: '',
      onAction: undefined,
    };
  }

  switch (currentStage) {
    case ArticleStage.DRAFT:
      return {
        text: '',
        onAction: undefined,
      };

    default:
      return {
        text: '',
        onAction: undefined,
      };
  }
}
