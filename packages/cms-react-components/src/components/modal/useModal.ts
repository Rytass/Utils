import { useContext } from 'react';
import { ModalContext, ModalContextValues } from './ModalContext';

export const useModal = (): ModalContextValues => {
  const { setVerifyReleaseModalProps, setDeleteWithdrawModalProps, setRejectModalProps } = useContext(ModalContext);

  return {
    setVerifyReleaseModalProps,
    setDeleteWithdrawModalProps,
    setRejectModalProps,
  };
};
