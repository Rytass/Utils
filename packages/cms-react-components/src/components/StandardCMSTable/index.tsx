import React, { ReactElement } from 'react';
import { TableDataSourceWithID } from '@mezzanine-ui/core/table';
import { CalendarConfigProvider } from '@mezzanine-ui/react';
import calendarMethodsDayjs from '@mezzanine-ui/core/calendarMethodsDayjs';
import DialogProvider from '../dialog/DialogProvider';
import ModalProvider from '../modal/ModalProvider';
import Table from './Table';
import { StandardCMSTableProps } from './typings';

const StandardCMSTable = <T extends TableDataSourceWithID>(props: StandardCMSTableProps<T>): ReactElement => {
  return (
    <CalendarConfigProvider methods={calendarMethodsDayjs}>
      <DialogProvider>
        <ModalProvider>
          <Table {...props} />
        </ModalProvider>
      </DialogProvider>
    </CalendarConfigProvider>
  );
};

export { StandardCMSTable };
