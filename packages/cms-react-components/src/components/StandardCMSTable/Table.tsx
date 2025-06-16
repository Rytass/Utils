import React, { ReactElement, useMemo } from 'react';
import { compact } from 'lodash';
import { Table as MznTable, IconButton, Icon } from '@mezzanine-ui/react';
import { TableColumn, TableDataSourceWithID } from '@mezzanine-ui/core/table';
import { VersionLog } from '../../icons/version-log';
import { useMappingTableActions } from './hooks';
import { StandardCMSTableProps } from './typings';

const Table = <T extends TableDataSourceWithID>({
  currentStage,
  userPermissions,
  actionsEvents,
  dataSource,
  columns: columnsProps,
  scroll,
  scrollContainerClassName,
  loading,
  fetchMore,
  pagination,
  draggable,
  expandable,
  rowSelection,
  headerClassName,
  className,
  bodyClassName,
  bodyRowClassName,
  emptyProps,
  loadingTip,
  withVersionLogs = true,
  actions,
  customizedActions = [],
}: StandardCMSTableProps<T>): ReactElement => {
  const tableActions = useMappingTableActions<T>({
    currentStage,
    userPermissions,
    actionsEvents,
    actions,
  });

  const columns = useMemo(
    (): TableColumn<T>[] =>
      compact<TableColumn<T>>([
        withVersionLogs && {
          title: '',
          width: 60,
          render: (source) => (
            <IconButton type="button" size="small">
              <Icon icon={VersionLog} size={16} />
            </IconButton>
          ),
        },
        ...columnsProps,
        ...tableActions,
        ...customizedActions,
      ]),
    [withVersionLogs, columnsProps, tableActions, customizedActions],
  );

  const baseTableProps = useMemo(
    () => ({
      headerClassName,
      className,
      bodyClassName,
      bodyRowClassName,
      columns,
      dataSource,
      scroll,
      scrollContainerClassName,
      loading,
      loadingTip,
      draggable,
      expandable,
      rowSelection,
      emptyProps,
    }),
    [
      bodyClassName,
      bodyRowClassName,
      className,
      columns,
      dataSource,
      draggable,
      emptyProps,
      expandable,
      headerClassName,
      loading,
      loadingTip,
      rowSelection,
      scroll,
      scrollContainerClassName,
    ],
  );

  return (
    <MznTable
      {...baseTableProps}
      {...(fetchMore ? { fetchMore } : { pagination })}
    />
  );
};

export default Table;
