import React, { ReactNode } from 'react';
import {
  Loading,
  Typography,
  ModalHeader,
  ModalBody as MznModalBody,
  ModalActions,
  Message,
  RadioGroup,
  Radio,
} from '@mezzanine-ui/react';
import { useModal } from '../../modal/useModal';
import classes from './index.module.scss';

const VerifyModal = (): ReactNode => {
  const { closeModal } = useModal();

  return (
    <>
      <ModalHeader>審核通過</ModalHeader>
      <MznModalBody className={classes.modalBody}>
        <RadioGroup size="large" className={classes.radioGroup}>
          <Radio>立即發佈文章至最新版本</Radio>
          <Radio>預約發佈文章至最新版本</Radio>
          <div className={classes.divider} />
          <Radio>即刻通過審查 （文章會將移至可發佈）</Radio>
        </RadioGroup>
      </MznModalBody>
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
