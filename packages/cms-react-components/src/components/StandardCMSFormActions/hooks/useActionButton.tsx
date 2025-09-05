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
  isDirty: _isDirty,
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
    // 中間態
    case ArticleStage.UNKNOWN: {
      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.UpdateArticleInDraft,
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
                  onReject={async reason => {
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

    case ArticleStage.VERIFIED: {
      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.UpdateArticleInVerified,
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

      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.UpdateArticleInDraft, // 因為將被導入至類似草稿區的編輯狀態
        })
      ) {
        return {
          text: '修改內容',
          onAction: async () => {
            const isConfirm = await openDialog({
              severity: 'info',
              size: 'small',
              title: '確定要修改內容？',
              children: '內容將被移至所屬的草稿列表頁，修改後需重新審核。此操作無法還原。',
              cancelText: '取消',
              cancelButtonProps: {
                danger: false,
              },
              confirmText: '修改內容',
              confirmButtonProps: {
                danger: false,
              },
            });

            if (isConfirm) {
              await actionsEvents.onGoToEdit?.(values);
            }
          },
        };
      }

      return {
        text: '',
        onAction: undefined,
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

      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.UpdateArticleInDraft, // 因為將被導入至類似草稿區的編輯狀態
        })
      ) {
        return {
          text: '修改內容',
          onAction: async () => {
            const isConfirm = await openDialog({
              severity: 'info',
              size: 'small',
              title: '確定要修改內容？',
              children: '內容將被移至所屬的草稿列表頁，修改後需重新審核。此操作無法還原。',
              cancelText: '取消',
              cancelButtonProps: {
                danger: false,
              },
              confirmText: '修改內容',
              confirmButtonProps: {
                danger: false,
              },
            });

            if (isConfirm) {
              await actionsEvents.onGoToEdit?.(values);
            }
          },
        };
      }

      return {
        text: '',
        onAction: undefined,
      };
    }

    case ArticleStage.RELEASED: {
      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.UpdateArticleInReleased,
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
