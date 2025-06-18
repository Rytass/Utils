import React, { useCallback } from 'react';
import { TableDataSourceWithID } from '@mezzanine-ui/core/table';
import { useDialog } from '../../dialog/useDialog';
import { useModal } from '../../modal/useModal';
import { StandardCMSTableEventsProps } from '../typings';

export function useTableEvents<T extends TableDataSourceWithID>({
  actionsEvents,
}: {
  actionsEvents: StandardCMSTableEventsProps<T>;
}): {
  onUpdate: (source: T) => () => Promise<void>;
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

  const onSubmit = useCallback(
    (source: T) => async () => {
      const isConfirm = await openDialog({
        style: { width: 384 },
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
        style: { width: 384 },
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
    onSubmit,
    onDelete,
  };
}
