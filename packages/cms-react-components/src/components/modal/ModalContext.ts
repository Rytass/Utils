import { createContext } from 'react';
import { ModalConfigType } from './typing';

export interface ModalContextValues {
  open: boolean;
  openModal: (config: ModalConfigType) => void;
  closeModal: () => void;
}

export const ModalContext = createContext<ModalContextValues>({
  open: false,
  openModal: () => {},
  closeModal: () => {},
});

export const ModalContextProvider = ModalContext.Provider;
