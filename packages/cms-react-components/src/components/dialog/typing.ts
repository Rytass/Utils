import { ModalProps, ModalSize } from '@mezzanine-ui/react';
import { SeverityWithInfo } from '@mezzanine-ui/system/severity';

export type OpenDialogFunctionType = (config: DialogConfigType) => Promise<boolean>;

export interface CancelConfirmDialogConfig {
  severity?: SeverityWithInfo;
  size?: ModalSize;
  title?: string;
  children?: string;
  confirmText?: string;
  cancelText?: string;
  isConfirmDanger?: boolean;
}

export type DialogConfigType = Omit<ModalProps, 'modalType'> & {
  children?: string;
  disableActions?: boolean;
  resolve?: (value: boolean) => void;
};

export interface DialogHookValue {
  openDialog: (config: DialogConfigType) => void | Promise<boolean>;
  closeDialog: () => void;
}
