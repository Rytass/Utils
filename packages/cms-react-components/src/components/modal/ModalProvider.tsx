import React, { FC, ReactNode, useState, useCallback, memo } from 'react';
import { Modal } from '@mezzanine-ui/react';
import { ModalContextProvider } from './ModalContext';
import { ModalConfigType } from './typing';

const ModalProvider: FC<{ children?: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState<boolean>(false);

  const [modalConfig, setModalConfig] = useState<ModalConfigType>({});

  const {
    disableCloseOnBackdropClick = false,
    hideCloseIcon = true,
    severity,
    size = 'medium',
    children: modalChildren,
    width,
    className,
    onClose,
  } = modalConfig;

  const openModal = useCallback((config: ModalConfigType) => {
    setOpen(true);
    setModalConfig(config);
  }, []);

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
          disableCloseOnBackdropClick={disableCloseOnBackdropClick}
          hideCloseIcon={hideCloseIcon}
          severity={severity}
          size={size}
          onClose={() => {
            setOpen(false);
            onClose?.();
          }}
          open={open}
          style={{ width }}
          className={className}
        >
          {modalChildren}
        </Modal>
      </>
    </ModalContextProvider>
  );
};

export default memo(ModalProvider);
