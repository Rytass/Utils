import { useContext } from 'react';
import { DialogContext } from './DialogContext';
import { DialogHookValue } from './typing';

export const useDialog = (): DialogHookValue => {
  const { openDialog: configOpenDialog, closeDialog } = useContext(DialogContext);

  const openDialog = ({ ...options }): Promise<boolean> =>
    new Promise<boolean>(resolver => {
      configOpenDialog({
        resolve: resolver,
        ...options,
      });
    });

  return {
    openDialog,
    closeDialog,
  };
};
