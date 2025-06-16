import { useContext } from 'react';
import { DialogContext } from './DialogContext';
import { DialogHookValue, CancelConfirmDialogConfig } from './typing';

export const useDialog = (): DialogHookValue => {
  const { openDialog: configOpenDialog, closeDialog } =
    useContext(DialogContext);

  const openDialog = ({ ...options }) =>
    new Promise<boolean>((resolver) => {
      configOpenDialog({
        resolve: resolver,
        ...options,
      });
    });

  const openCancelConfirmDialog = async (
    onCancel: () => void,
    config?: CancelConfirmDialogConfig,
  ) => {
    const isConfirm = await openDialog({
      severity: config?.severity ?? 'warning',
      size: config?.size ?? 'small',
      title: config?.title ?? '確認取消',
      children: config?.children ?? '取消不會儲存內容，確定取消？',
      cancelText: config?.cancelText ?? '取消',
      cancelButtonProps: {
        danger: false,
      },
      confirmText: config?.confirmText ?? '確認取消',
      confirmButtonProps: {
        danger: config?.isConfirmDanger ?? false,
      },
    });

    if (isConfirm) {
      onCancel();
    }
  };

  return {
    openDialog,
    openCancelConfirmDialog,
    closeDialog,
  };
};
