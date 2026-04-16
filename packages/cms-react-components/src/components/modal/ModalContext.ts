import { createContext } from 'react';
import type { VerifyReleaseModalProps } from '../cms-modals/VerifyReleaseModal';
import type { DeleteWithdrawModalProps } from '../cms-modals/DeleteWithdrawModal';
import type { RejectModalProps } from '../cms-modals/RejectModal';

export interface ModalContextValues {
  setVerifyReleaseModalProps: React.Dispatch<React.SetStateAction<VerifyReleaseModalProps | null>>;
  setDeleteWithdrawModalProps: React.Dispatch<React.SetStateAction<DeleteWithdrawModalProps | null>>;
  setRejectModalProps: React.Dispatch<React.SetStateAction<RejectModalProps | null>>;
}

export const ModalContext = createContext<ModalContextValues>({
  setVerifyReleaseModalProps: () => {},
  setDeleteWithdrawModalProps: () => {},
  setRejectModalProps: () => {},
});

export const ModalContextProvider = ModalContext.Provider;
