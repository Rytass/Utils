import React, { ReactNode } from 'react';
import {
  Loading,
  Typography,
  ModalHeader,
  ModalBody as MznModalBody,
  ModalActions,
  Message,
} from '@mezzanine-ui/react';
import { useModal } from '../../modal/useModal';
import classes from './index.module.scss';

const VerifyModal = (): ReactNode => {
  const { closeModal } = useModal();

  return (
    <>
      <ModalHeader>審核通過</ModalHeader>
      <MznModalBody className={classes.modalBody}></MznModalBody>
      <ModalActions
        cancelText="取消"
        confirmText="立即發佈"
        cancelButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'outlined',
          style: {
            minWidth: 'unset',
          },
        }}
        confirmButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'contained',
          style: {
            minWidth: 'unset',
          },
        }}
        onCancel={closeModal}
        // onConfirm={onConfirm}
      />
    </>
  );
};

export { VerifyModal };
