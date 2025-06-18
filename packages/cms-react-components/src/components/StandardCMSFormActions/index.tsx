import React, { ReactNode } from 'react';
import { FieldValues } from 'react-hook-form';
import { CalendarConfigProvider } from '@mezzanine-ui/react';
import calendarMethodsDayjs from '@mezzanine-ui/core/calendarMethodsDayjs';
import DialogProvider from '../dialog/DialogProvider';
import ModalProvider from '../modal/ModalProvider';
import { StandardCMSFormActionsProps } from './typings';
import FormActions from './FormActions';

const StandardCMSFormActions = <T extends FieldValues>(
  props: StandardCMSFormActionsProps<T>,
): ReactNode => {
  return (
    <CalendarConfigProvider methods={calendarMethodsDayjs}>
      <DialogProvider>
        <ModalProvider>
          <FormActions {...props} />;
        </ModalProvider>
      </DialogProvider>
    </CalendarConfigProvider>
  );
};

export { StandardCMSFormActions };
