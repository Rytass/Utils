import React, { ReactNode, useState, useCallback } from 'react';
import { ModalHeader, ModalBody as MznModalBody, ModalActions, Typography } from '@mezzanine-ui/react';
import { useModal } from '../../modal/useModal';
import { Textarea } from '../../cms-fields/Textarea';
import classes from './index.module.scss';

export interface RejectModalProps {
  onReject: (reason: string) => Promise<void>;
}

const RejectModal = ({ onReject }: RejectModalProps): ReactNode => {
  const [acting, setActing] = useState<boolean>(false);

  const [rejectReason, setRejectReason] = useState<string>('');

  const { closeModal } = useModal();

  const onConfirm = useCallback(async () => {
    setActing(true);
    await onReject(rejectReason);
    setActing(false);
    closeModal();
  }, [closeModal, onReject, rejectReason]);

  return (
    <>
      <ModalHeader showSeverityIcon>審核不通過</ModalHeader>
      <MznModalBody className={classes.modalBody}>
        <Typography variant="body1" color="text-primary">
          當審核未通過時，內容將自動移至草稿區，需修改後重新送審。
        </Typography>
        <Textarea
          label="不通過原因"
          value={rejectReason}
          onChange={value => {
            setRejectReason(value);
          }}
          autoFocus
        />
      </MznModalBody>
      <ModalActions
        cancelText="取消"
        confirmText="送出"
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
          disabled: !rejectReason || acting,
          loading: acting,
        }}
        onCancel={closeModal}
        onConfirm={onConfirm}
      />
    </>
  );
};

export { RejectModal };
