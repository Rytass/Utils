import React from 'react';
import { FieldValues } from 'react-hook-form';
import { havePermission } from '../../../utils/havePermission';
import { RejectModal } from '../../cms-modals/RejectModal';
import { StandardCMSFormActionsEventsProps } from '../typings';
import { ArticleStage, ArticlesPermissions } from '../../../typings';
import { useDialog } from '../../dialog/useDialog';
import { useModal } from '../../modal/useModal';

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
  const { openDialog } = useDialog();
  const { openModal } = useModal();

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
          await actionsEvents.onCreateToDraft?.(values);
        },
      };
    }

    return {
      text: '',
      onAction: undefined,
    };
  }

  switch (currentStage) {
    case ArticleStage.DRAFT: {
      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.UpdateArticleInDraft,
        })
      ) {
        return {
          text: '儲存草稿',
          onAction: async () => {
            await actionsEvents.onUpdateToDraft?.(values);
          },
        };
      }

      return {
        text: '',
        onAction: undefined,
      };
    }

    case ArticleStage.REVIEWING: {
      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.ApproveRejectArticle,
        })
      ) {
        return {
          text: '不通過',
          danger: true,
          onAction: async () => {
            openModal({
              severity: 'error',
              children: (
                <RejectModal
                  onReject={async (reason) => {
                    await actionsEvents.onReject?.(values, reason);
                  }}
                />
              ),
            });
          },
        };
      }

      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.UpdateArticleInReviewing,
        })
      ) {
        return {
          text: '新增草稿版本',
          onAction: async () => {
            const isConfirm = await openDialog({
              severity: 'info',
              size: 'small',
              title: '確認新增草稿版本？',
              children: '內容將被移至所屬的草稿列表頁。',
              cancelText: '取消',
              cancelButtonProps: {
                danger: false,
              },
              confirmText: '新增草稿',
              confirmButtonProps: {
                danger: false,
              },
            });

            if (isConfirm) {
              await actionsEvents.onUpdateToDraft?.(values);
            }
          },
        };
      }

      return {
        text: '',
        onAction: undefined,
      };
    }

    default:
      return {
        text: '',
        onAction: undefined,
      };
  }
}
