import { ReactNode } from 'react';
import { ModalSize, ModalProps } from '@mezzanine-ui/react';

export type ModalConfigType = Omit<ModalProps, 'modalType' | 'onSubmit'> & {
  size?: ModalSize;
  children?: ReactNode;
};
