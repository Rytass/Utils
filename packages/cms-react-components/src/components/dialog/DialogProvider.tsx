import React, { FC, ReactNode, useState, memo } from 'react';
import { Modal, cx } from '@mezzanine-ui/react';
import { DialogContextProvider } from './DialogContext';
import { DialogConfigType } from './typing';
import classes from './index.module.scss';

const DialogProvider: FC<{ children?: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState<boolean>(false);

  const [dialogConfig, setDialogConfig] = useState<DialogConfigType>({});

  const {
    className,
    resolve = (): void => {},
    title,
    children: dialogChildren,
    disableActions,
    supportingText,
    modalStatusType = 'warning',
    showStatusTypeIcon,
    cancelButtonProps,
    cancelText = '取消',
    confirmButtonProps,
    confirmText = '確認',
  } = dialogConfig;

  const openDialog = (config: DialogConfigType): void => {
    setOpen(true);
    setDialogConfig(config);
  };

  const handleCloseDialog = async (): Promise<void> => {
    setOpen(false);

    // Wait animation end then reset
    await new Promise<void>((r): void => {
      setTimeout(r, 250);
    });

    setDialogConfig({});
  };

  const handleResolveActions = (status: boolean): void => {
    handleCloseDialog();
    resolve?.(status);
  };

  return (
    <DialogContextProvider
      value={{
        closeDialog: () => {
          handleResolveActions(false);
        },
        openDialog,
        resolve,
      }}
    >
      <>
        {children}
        <Modal
          className={cx(classes.host, className)}
          onClose={() => {
            handleResolveActions(false);
          }}
          showDismissButton
          modalType="standard"
          size="narrow"
          supportingText={supportingText}
          cancelText={cancelText}
          confirmText={confirmText}
          onCancel={() => {
            handleResolveActions(false);
          }}
          onConfirm={() => {
            handleResolveActions(true);
          }}
          cancelButtonProps={{
            type: 'button',
            variant: 'destructive-secondary',
            disabled: disableActions,
            ...cancelButtonProps,
          }}
          confirmButtonProps={{
            type: 'button',
            variant: 'destructive-primary',
            disabled: disableActions,
            ...confirmButtonProps,
          }}
          showStatusTypeIcon={showStatusTypeIcon}
          statusTypeIconLayout="horizontal"
          title={title ?? ''}
          titleAlign="left"
          modalStatusType={modalStatusType}
          open={open}
          showModalFooter
          showModalHeader
        >
          <div className={classes.modalBody}>{dialogChildren}</div>
        </Modal>
      </>
    </DialogContextProvider>
  );
};

export default memo(DialogProvider);
