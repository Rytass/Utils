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
      title: config?.title ?? '確認離開編輯？',
      children:
        config?.children ??
        '編輯將不被保存，如果需要保存目前文章編輯進度，請選擇「新增草稿版本」。',
      cancelText: config?.cancelText ?? '取消',
      cancelButtonProps: {
        danger: false,
      },
      confirmText: config?.confirmText ?? '離開編輯',
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
