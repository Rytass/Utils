import React, { useCallback } from 'react';
import { TableDataSourceWithID } from '@mezzanine-ui/core/table';
import { useDialog } from '../../dialog/useDialog';
import { useModal } from '../../modal/useModal';
import { VerifyReleaseModal } from '../../cms-modals/VerifyReleaseModal';
import { StandardCMSTableEventsProps } from '../typings';
import { ArticleStage, ArticlesPermissions } from '../../../typings';

export function useTableEvents<T extends TableDataSourceWithID>({
  userPermissions,
  actionsEvents,
}: {
  userPermissions: ArticlesPermissions[];
  actionsEvents: StandardCMSTableEventsProps<T>;
}): {
  onView: (source: T) => () => Promise<void>;
  onVerifyRelease: (source: T, stage: ArticleStage) => () => Promise<void>;
  onWithdraw: (source: T) => () => Promise<void>;
  onSubmit: (source: T) => () => Promise<void>;
  onPutBack: (source: T) => () => Promise<void>;
  onDelete: (source: T) => () => Promise<void>;
} {
  const { openDialog } = useDialog();
  const { openModal } = useModal();

  const onView = useCallback(
    (source: T) => async () => {
      await actionsEvents.onView?.(source);
    },
    [actionsEvents],
  );

  const onVerifyRelease = useCallback(
    (source: T, stage: ArticleStage) => async () => {
      const title = (() => {
        switch (stage) {
          case ArticleStage.DRAFT:
            return '審核通過';

          case ArticleStage.REVIEWING:
            return '審核文章';

          case ArticleStage.VERIFIED:
            return '發佈設定';

          default:
            return '';
        }
      })();

      openModal({
        severity: 'success',
        children: (
          <VerifyReleaseModal
            title={title}
            withApprove={[ArticleStage.DRAFT, ArticleStage.REVIEWING].includes(
              stage,
            )}
            withReject={stage === ArticleStage.REVIEWING}
            showSeverityIcon={stage === ArticleStage.DRAFT}
            onRelease={async (releasedAt) => {
              await actionsEvents.onRelease?.(source, releasedAt);
            }}
            onApprove={async () => {
              await actionsEvents.onApprove?.(source);
            }}
            onReject={async (reason) => {
              await actionsEvents.onReject?.(source, reason);
            }}
          />
        ),
      });
    },
    [actionsEvents, openModal],
  );

  const onWithdraw = useCallback(
    (source: T) => async () => {
      const isConfirm = await openDialog({
        severity: 'error',
        title: '確認取消發佈此文章？',
        children: '內容將被移至可發佈區。',
        cancelText: '取消',
        cancelButtonProps: {
          danger: false,
        },
        confirmText: '取消發佈',
      });

      if (isConfirm) {
        await actionsEvents.onWithdraw?.(source);
      }
    },
    [actionsEvents, openDialog],
  );

  const onSubmit = useCallback(
    (source: T) => async () => {
      const isConfirm = await openDialog({
        title: '提交審核此文章',
        children: '文章將移至「待審核」。請確認是否提交審核此文章。',
        cancelText: '取消',
        cancelButtonProps: {
          danger: false,
        },
        confirmText: '提交審核',
        confirmButtonProps: {
          danger: false,
        },
      });

      if (isConfirm) {
        await actionsEvents.onSubmit?.(source);
      }
    },
    [actionsEvents, openDialog],
  );

  const onPutBack = useCallback(
    (source: T) => async () => {
      const isConfirm = await openDialog({
        severity: 'error',
        title: '確認撤銷審核此文章？',
        children: '內容將被移至草稿區。',
        cancelText: '取消',
        cancelButtonProps: {
          danger: false,
        },
        confirmText: '撤銷審核',
      });

      if (isConfirm) {
        await actionsEvents.onPutBack?.(source);
      }
    },
    [actionsEvents, openDialog],
  );

  const onDelete = useCallback(
    (source: T) => async () => {
      const isConfirm = await openDialog({
        severity: 'error',
        title: '確認刪除文章？',
        children: '此動作無法復原。',
        cancelText: '取消',
        cancelButtonProps: {
          danger: false,
        },
        confirmText: '刪除文章',
      });

      if (isConfirm) {
        await actionsEvents.onDelete?.(source);
      }
    },
    [actionsEvents, openDialog],
  );

  return {
    onView,
    onVerifyRelease,
    onWithdraw,
    onSubmit,
    onPutBack,
    onDelete,
  };
}
