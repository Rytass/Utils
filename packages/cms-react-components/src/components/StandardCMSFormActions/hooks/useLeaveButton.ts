import { useCallback, useMemo } from 'react';
import { FieldValues } from 'react-hook-form';
import { havePermission } from '../../../utils/havePermission';
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

  switch (currentStage) {
    case ArticleStage.DRAFT:
      return {
        text,
        onLeave: onLeave(
          '編輯將不被保存，如果需要保存目前文章編輯進度，請選擇「儲存草稿」。',
        ),
      };

    case ArticleStage.REVIEWING: {
      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.ApproveRejectArticle,
        })
      ) {
        return {
          text,
          onLeave: onLeave('編輯將不被保存，此動作無法復原。'),
        };
      }

      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.UpdateArticleInReviewing,
        })
      ) {
        return {
          text,
          onLeave: onLeave(
            '編輯將不被保存，如果需要保存目前文章編輯進度，請選擇「新增草稿版本」。',
          ),
        };
      }

      return {
        text,
        onLeave: onLeave('編輯將不被保存，此動作無法復原。'),
      };
    }

    case ArticleStage.VERIFIED: {
      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.UpdateArticleInVerified,
        })
      ) {
        return {
          text,
          onLeave: onLeave(
            '編輯將不被保存，如果需要保存目前文章編輯進度，請選擇「新增草稿版本」。',
          ),
        };
      }

      return {
        text,
        onLeave: async () => {
          await actionsEvents.onLeave?.(values);
        },
      };
    }

    case ArticleStage.SCHEDULED: {
      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.UpdateArticleInScheduled,
        })
      ) {
        return {
          text,
          onLeave: onLeave(
            '編輯將不被保存，如果需要保存目前文章編輯進度，請選擇「新增草稿版本」。',
          ),
        };
      }

      return {
        text,
        onLeave: async () => {
          await actionsEvents.onLeave?.(values);
        },
      };
    }

    default:
      return {
        text,
        onLeave: async () => {
          await actionsEvents.onLeave?.(values);
        },
      };
  }
}
