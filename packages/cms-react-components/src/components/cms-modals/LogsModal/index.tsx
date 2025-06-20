import React, { ReactNode } from 'react';
import {
  ModalHeader,
  ModalBody as MznModalBody,
  ModalActions,
} from '@mezzanine-ui/react';
import { useModal } from '../../modal/useModal';
import classes from './index.module.scss';

export interface LogsModalProps {}

const LogsModal = (): ReactNode => {
  const { closeModal } = useModal();

  return (
    <>
      <ModalHeader showSeverityIcon={false}>版本資訊</ModalHeader>
      <MznModalBody className={classes.modalBody}></MznModalBody>
      <ModalActions
        cancelText="取消"
        confirmText="關閉"
        cancelButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'outlined',
          danger: false,
          style: {
            display: 'none',
          },
        }}
        confirmButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'contained',
          danger: false,
        }}
        onCancel={closeModal}
        onConfirm={closeModal}
      />
    </>
  );
};

export { LogsModal };
