import { useCallback, useMemo } from 'react';
import { FieldValues } from 'react-hook-form';
import { StandardCMSFormActionsEventsProps } from '../typings';
import { ArticleStage, ArticlesPermissions } from '../../../typings';
import { useDialog } from '../../dialog/useDialog';

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
  const { openDialog } = useDialog();

  const text = useMemo(() => '離開', []);

  const onLeave = useCallback(
    (leaveText: string) => async () => {
      const isConfirm = await openDialog({
        severity: 'warning',
        size: 'small',
        title: '確認離開編輯？',
        children: `${leaveText}`,
        cancelText: '取消',
        cancelButtonProps: {
          danger: false,
        },
        confirmText: '離開編輯',
      });

      if (isConfirm) {
        await actionsEvents.onLeave?.(values);
      }
    },
    [actionsEvents, openDialog, values],
  );

  if (createMode) {
    return {
      text,
      onLeave: onLeave(
        '編輯將不被保存，如果需要保存目前文章編輯進度，請選擇「儲存草稿」。',
      ),
    };
  }

  return {
    text,
    onLeave: onLeave('儲存草稿'),
  };
}
