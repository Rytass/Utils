import React, { FC, ReactNode, useState, useMemo, useCallback, memo } from 'react';
import { Modal } from '@mezzanine-ui/react';
import { ModalHeaderLayoutProps } from '@mezzanine-ui/react/Modal';
import { ModalContextProvider } from './ModalContext';
import { ModalConfigType } from './typing';

const ModalProvider: FC<{ children?: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState<boolean>(false);

  const [modalConfig, setModalConfig] = useState<ModalConfigType>({});

  const {
    className,
    title,
    titleAlign = 'left',
    modalStatusType,
    showStatusTypeIcon,
    size = 'regular',
    cancelButtonProps,
    confirmButtonProps,
    cancelText = '取消',
    confirmText = '確認',
    onConfirm,
    children: modalChildren,
  } = modalConfig;

  const openModal = useCallback((config: ModalConfigType) => {
    setOpen(true);
    setModalConfig(config);
  }, []);

  const closeModal = useCallback(async () => {
    setOpen(false);

    // Wait animation end then reset
    await new Promise(r => setTimeout(r, 250));

    setModalConfig({});
  }, []);

  const layoutProps = useMemo(
    (): ModalHeaderLayoutProps =>
      titleAlign === 'left'
        ? {
            statusTypeIconLayout: 'horizontal',
            titleAlign: 'left',
          }
        : {
            statusTypeIconLayout: 'vertical',
            titleAlign: 'center',
          },
    [titleAlign],
  );

  return (
    <ModalContextProvider
      value={{
        open,
        closeModal: () => {
          setOpen(false);
        },
        openModal,
      }}
    >
      <>
        {children}
        <Modal
          {...layoutProps}
          className={className}
          onClose={() => {
            closeModal();
          }}
          showDismissButton
          modalType="standard"
          modalStatusType={modalStatusType}
          size={size}
          cancelText={cancelText}
          confirmText={confirmText}
          onCancel={() => {
            closeModal();
          }}
          onConfirm={onConfirm}
          cancelButtonProps={{
            type: 'button',
            ...cancelButtonProps,
          }}
          confirmButtonProps={{
            type: 'button',
            ...confirmButtonProps,
          }}
          showStatusTypeIcon={showStatusTypeIcon}
          title={title ?? ''}
          open={open}
          showModalFooter
          showModalHeader
        >
          {modalChildren}
        </Modal>
      </>
    </ModalContextProvider>
  );
};

export default memo(ModalProvider);
