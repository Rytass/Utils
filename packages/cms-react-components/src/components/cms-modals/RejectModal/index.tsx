import React, { ReactNode, useState, useCallback } from 'react';
import { Modal, Typography } from '@mezzanine-ui/react';
import { Textarea } from '../../cms-fields/Textarea';
import classes from './index.module.scss';

export interface RejectModalProps {
  onReject: (reason: string) => Promise<void>;
}

type RejectModalWithOpenProps = RejectModalProps & {
  open: boolean;
  closeModal: VoidFunction;
};

const RejectModal = ({ open, closeModal, onReject }: RejectModalWithOpenProps): ReactNode => {
  const [acting, setActing] = useState<boolean>(false);

  const [rejectReason, setRejectReason] = useState<string>('');

  const onConfirm = useCallback(async () => {
    setActing(true);
    await onReject(rejectReason);
    setActing(false);
    closeModal();
  }, [closeModal, onReject, rejectReason]);

  return (
    <Modal
      open={open}
      modalType="standard"
      title="審核不通過"
      titleAlign="left"
      showStatusTypeIcon
      modalStatusType="error"
      cancelText="取消"
      confirmText="送出"
      cancelButtonProps={{
        type: 'button',
        variant: 'base-secondary',
      }}
      confirmButtonProps={{
        type: 'button',
        variant: 'destructive-primary',
        disabled: !rejectReason || acting,
        loading: acting,
      }}
      onCancel={closeModal}
      onConfirm={onConfirm}
      showModalHeader
      showModalFooter
    >
      <div className={classes.modalBody}>
        <Typography variant="body" color="text-neutral">
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
      </div>
    </Modal>
  );
};

export { RejectModal };
