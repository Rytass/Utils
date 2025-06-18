/* eslint-disable @typescript-eslint/no-empty-function */
import React, { FC, ReactNode, useState, memo } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalActions,
  cx,
} from '@mezzanine-ui/react';
import { DialogContextProvider } from './DialogContext';
import { DialogConfigType } from './typing';
import classes from './index.module.scss';

const DialogProvider: FC<{ children?: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState<boolean>(false);

  const [dialogConfig, setDialogConfig] = useState<DialogConfigType>({});

  const {
    className,
    resolve = () => {},
    titleLarge,
    title,
    children: dialogChildren,
    disableActions,
    severity = 'warning',
    cancelButtonProps,
    cancelText = '取消',
    confirmButtonProps,
    confirmText = '確認',
    size = 'small',
    showSeverityIcon = false,
    hideCloseIcon = true,
    ...rest
  } = dialogConfig;

  const openDialog = (config: DialogConfigType) => {
    setOpen(true);
    setDialogConfig(config);
  };

  const handleCloseDialog = async () => {
    setOpen(false);

    // Wait animation end then reset
    await new Promise((r) => setTimeout(r, 200));

    setDialogConfig({});
  };

  const handleResolveActions = (status: boolean) => {
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
          {...rest}
          severity={severity}
          disableCloseOnBackdropClick
          hideCloseIcon={hideCloseIcon}
          onClose={() => {
            handleResolveActions(false);
          }}
          open={open}
          size={size}
          className={cx(classes.host, className)}
        >
          <ModalHeader
            showSeverityIcon={showSeverityIcon}
            titleLarge={titleLarge}
          >
            {title}
          </ModalHeader>
          <ModalBody className={classes.modalBody}>{dialogChildren}</ModalBody>
          {!disableActions && (
            <ModalActions
              cancelText={cancelText}
              confirmText={confirmText}
              cancelButtonProps={{
                type: 'button',
                size: 'large',
                variant: 'outlined',
                danger: true,
                ...cancelButtonProps,
              }}
              confirmButtonProps={{
                type: 'button',
                size: 'large',
                variant: 'contained',
                danger: true,
                ...confirmButtonProps,
              }}
              onCancel={() => {
                handleResolveActions(false);
              }}
              onConfirm={() => {
                handleResolveActions(true);
              }}
            />
          )}
        </Modal>
      </>
    </DialogContextProvider>
  );
};

export default memo(DialogProvider);
