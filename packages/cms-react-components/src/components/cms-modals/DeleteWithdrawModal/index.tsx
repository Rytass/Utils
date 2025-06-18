import React, { ReactNode, useState, useMemo } from 'react';
import {
  ModalHeader,
  ModalBody as MznModalBody,
  ModalActions,
  RadioGroup,
  Radio,
} from '@mezzanine-ui/react';
import { useModal } from '../../modal/useModal';
import classes from './index.module.scss';

export enum DeleteWithdrawModalRadio {
  Withdraw = 'Withdraw',
  Delete = 'Delete',
}

export interface DeleteWithdrawModalProps {
  showSeverityIcon?: boolean;
  defaultRadioValue: DeleteWithdrawModalRadio;
  withWithdraw?: boolean;
  withDelete?: boolean;
  onWithdraw: () => Promise<void>;
  onDelete: () => Promise<void>;
}

const DeleteWithdrawModal = ({
  showSeverityIcon = false,
  defaultRadioValue,
  withWithdraw,
  withDelete,
  onWithdraw,
  onDelete,
}: DeleteWithdrawModalProps): ReactNode => {
  const [currentRadioValue, setCurrentRadioValue] =
    useState<DeleteWithdrawModalRadio>(defaultRadioValue);

  const { closeModal } = useModal();

  const onConfirm = useMemo(() => {
    switch (currentRadioValue) {
      case DeleteWithdrawModalRadio.Withdraw:
        return async () => {
          await onWithdraw();
          closeModal();
        };

      case DeleteWithdrawModalRadio.Delete:
        return async () => {
          await onDelete();
          closeModal();
        };

      default:
        return () => {
          closeModal();
        };
    }
  }, [closeModal, currentRadioValue, onDelete, onWithdraw]);

  return (
    <>
      <ModalHeader showSeverityIcon={showSeverityIcon}>移除文章</ModalHeader>
      <MznModalBody className={classes.modalBody}>
        <RadioGroup
          size="large"
          value={currentRadioValue}
          className={classes.radioGroup}
          onChange={(e) => {
            setCurrentRadioValue(e.target.value as DeleteWithdrawModalRadio);
          }}
        >
          {withWithdraw && (
            <Radio value={DeleteWithdrawModalRadio.Withdraw}>
              將文章移至可發佈區
            </Radio>
          )}
          {withDelete && (
            <Radio value={DeleteWithdrawModalRadio.Delete}>
              永久刪除文章，此操作無法還原。
            </Radio>
          )}
        </RadioGroup>
      </MznModalBody>
      <ModalActions
        cancelText="取消"
        confirmText="移除文章"
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
          danger: true,
          style: {
            minWidth: 'unset',
          },
        }}
        onCancel={closeModal}
        onConfirm={onConfirm}
      />
    </>
  );
};

export { DeleteWithdrawModal };
