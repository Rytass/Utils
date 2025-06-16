import React, { ReactElement } from 'react';
import { TableDataSourceWithID } from '@mezzanine-ui/core/table';
import DialogProvider from '../dialog/DialogProvider';
import ModalProvider from '../modal/ModalProvider';
import Table from './Table';
import { StandardCMSTableProps } from './typings';

const StandardCMSTable = <T extends TableDataSourceWithID>(
  props: StandardCMSTableProps<T>,
): ReactElement => {
  return (
    <DialogProvider>
      <ModalProvider>
        <Table {...props} />
      </ModalProvider>
    </DialogProvider>
  );
};

export { StandardCMSTable };
