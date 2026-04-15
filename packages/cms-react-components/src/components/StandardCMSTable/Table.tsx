import React, { ReactElement, useMemo } from 'react';
import { compact } from 'lodash';
import { Table as MznTable, Button } from '@mezzanine-ui/react';
import { TableColumn, TableDataSourceWithId } from '@mezzanine-ui/core/table';
import { VersionLog } from '../../icons/version-log';
import { useModal } from '../modal/useModal';
import { LogsModal } from '../cms-modals/LogsModal';
import { useTableActions } from './hooks/useTableActions';
import { StandardCMSTableProps } from './typings';

const Table = <T extends TableDataSourceWithId>({
  currentStage,
  userPermissions,
  actionsEvents,
  dataSource,
  columns: columnsProps,
  loading,
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
  versionLogsData,
  actions,
  customizedActions = [],
}: StandardCMSTableProps<T>): ReactElement => {
  const { openModal } = useModal();
  const tableActions = useTableActions<T>({
    currentStage,
    userPermissions,
    actionsEvents,
    actions,
  });

  const columns = useMemo(
    (): TableColumn<T>[] =>
      compact<TableColumn<T>>([
        withVersionLogs &&
          versionLogsData && {
            title: '',
            key: 'action',
            width: 60,
            render: source => (
              <Button
                type="button"
                size="minor"
                onClick={() => {
                  openModal({
                    severity: 'info',
                    children: <LogsModal {...versionLogsData(source)} />,
                  });
                }}
                icon={VersionLog}
                iconType="icon-only"
              />
            ),
          },
        ...columnsProps,
        ...tableActions,
        ...customizedActions,
      ]),
    [withVersionLogs, versionLogsData, columnsProps, tableActions, customizedActions, openModal],
  );

  const baseTableProps = useMemo(
    () => ({
      headerClassName,
      className,
      bodyClassName,
      bodyRowClassName,
      columns,
      dataSource,
      loading,
      loadingTip,
      pagination,
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
      emptyProps,
      expandable,
      headerClassName,
      loading,
      loadingTip,
      pagination,
      rowSelection,
    ],
  );

  if (draggable) {
    return <MznTable {...baseTableProps} draggable={draggable} />;
  }

  return <MznTable {...baseTableProps} />;
};

export default Table;
