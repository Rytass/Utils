import { createContext } from 'react';
import { DialogConfigType } from './typing';

export interface DialogContextValues {
  openDialog: (config: DialogConfigType) => void | Promise<boolean>;
  closeDialog: () => void;
  resolve: (value: boolean) => void;
}

export const DialogContext = createContext<DialogContextValues>({
  openDialog: () => {},
  closeDialog: () => {},
  resolve: () => {},
});

export const DialogContextProvider = DialogContext.Provider;
