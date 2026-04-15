import React, { FC, ReactNode, useState, memo } from 'react';
import { ModalContextProvider } from './ModalContext';
import { VerifyReleaseModal } from '../cms-modals/VerifyReleaseModal';
import type { VerifyReleaseModalProps } from '../cms-modals/VerifyReleaseModal';
import { DeleteWithdrawModal } from '../cms-modals/DeleteWithdrawModal';
import type { DeleteWithdrawModalProps } from '../cms-modals/DeleteWithdrawModal';
import { RejectModal } from '../cms-modals/RejectModal';
import type { RejectModalProps } from '../cms-modals/RejectModal';

const ModalProvider: FC<{ children?: ReactNode }> = ({ children }) => {
  const [verifyReleaseModalProps, setVerifyReleaseModalProps] = useState<VerifyReleaseModalProps | null>(null);
  const [deleteWithdrawModalProps, setDeleteWithdrawModalProps] = useState<DeleteWithdrawModalProps | null>(null);
  const [rejectModalProps, setRejectModalProps] = useState<RejectModalProps | null>(null);

  return (
    <ModalContextProvider
      value={{
        setVerifyReleaseModalProps,
        setDeleteWithdrawModalProps,
        setRejectModalProps,
      }}
    >
      <>
        {children}
        {verifyReleaseModalProps && (
          <VerifyReleaseModal
            open={!!verifyReleaseModalProps}
            closeModal={() => {
              setVerifyReleaseModalProps(null);
            }}
            {...verifyReleaseModalProps}
          />
        )}
        {deleteWithdrawModalProps && (
          <DeleteWithdrawModal
            open={!!deleteWithdrawModalProps}
            closeModal={() => {
              setDeleteWithdrawModalProps(null);
            }}
            {...deleteWithdrawModalProps}
          />
        )}

        {rejectModalProps && (
          <RejectModal
            open={!!rejectModalProps}
            closeModal={() => {
              setRejectModalProps(null);
            }}
            {...rejectModalProps}
          />
        )}
      </>
    </ModalContextProvider>
  );
};

export default memo(ModalProvider);
