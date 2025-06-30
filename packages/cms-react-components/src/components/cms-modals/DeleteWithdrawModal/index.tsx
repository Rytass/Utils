import React, { ReactNode, useState, useMemo } from 'react';
import {
  ModalHeader,
  ModalBody as MznModalBody,
  ModalActions,
  Typography,
  RadioGroup,
  Radio,
} from '@mezzanine-ui/react';
import { useModal } from '../../modal/useModal';
import classes from './index.module.scss';

export enum DeleteWithdrawModalRadio {
  Delete = 'Delete',
  Withdraw = 'Withdraw',
}

export interface DeleteWithdrawModalProps {
  showSeverityIcon?: boolean;
  defaultRadioValue: DeleteWithdrawModalRadio;
  withDelete?: boolean;
  withWithdraw?: boolean;
  onDelete: () => Promise<void>;
  onWithdraw: () => Promise<void>;
}

const DeleteWithdrawModal = ({
  showSeverityIcon = false,
  defaultRadioValue,
  withDelete,
  withWithdraw,
  onDelete,
  onWithdraw,
}: DeleteWithdrawModalProps): ReactNode => {
  const [acting, setActing] = useState<boolean>(false);

  const [currentRadioValue, setCurrentRadioValue] =
    useState<DeleteWithdrawModalRadio>(defaultRadioValue);

  const { closeModal } = useModal();

  const onConfirm = useMemo(() => {
    switch (currentRadioValue) {
      case DeleteWithdrawModalRadio.Delete:
        return async () => {
          setActing(true);
          await onDelete();
          setActing(false);
          closeModal();
        };

      case DeleteWithdrawModalRadio.Withdraw:
        return async () => {
          setActing(true);
          await onWithdraw();
          setActing(false);
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
        <Typography variant="body1" color="text-primary">
          將已發佈文章從前台移除，請確認是否執行此操作。
        </Typography>
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
          danger: false,
        }}
        confirmButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'contained',
          danger: true,
          disabled: acting,
          loading: acting,
        }}
        onCancel={closeModal}
        onConfirm={onConfirm}
      />
    </>
  );
};

export { DeleteWithdrawModal };
