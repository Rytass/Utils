import React, { useCallback } from 'react';
import { TableDataSourceWithID } from '@mezzanine-ui/core/table';
import { useDialog } from '../../dialog/useDialog';
import { useModal } from '../../modal/useModal';
import { VerifyModal } from '../../cms-modals/VerifyModal';
import { StandardCMSTableEventsProps } from '../typings';
import { ArticleStage } from '../../../typings';

export function useTableEvents<T extends TableDataSourceWithID>({
  actionsEvents,
}: {
  actionsEvents: StandardCMSTableEventsProps<T>;
}): {
  onUpdate: (source: T) => () => Promise<void>;
  onVerify: (source: T, stage: ArticleStage) => () => Promise<void>;
  onSubmit: (source: T) => () => Promise<void>;
  onDelete: (source: T) => () => Promise<void>;
} {
  const { openDialog } = useDialog();
  const { openModal } = useModal();

  const onUpdate = useCallback(
    (source: T) => async () => {
      await actionsEvents.onUpdate?.(source);
    },
    [actionsEvents],
  );

  const onVerify = useCallback(
    (source: T, stage: ArticleStage) => async () => {
      openModal({
        children: <VerifyModal />,
      });
    },
    [openModal],
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
    onUpdate,
    onVerify,
    onSubmit,
    onDelete,
  };
}
