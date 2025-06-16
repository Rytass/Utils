import { useContext } from 'react';
import { ModalContext, ModalContextValues } from './ModalContext';

export const useModal = (): ModalContextValues => {
  const { open, openModal, closeModal } = useContext(ModalContext);

  return {
    open,
    openModal,
    closeModal,
  };
};
