import React, { ReactElement, ReactNode, useMemo } from 'react';
import { EmptyProps, Table } from '@mezzanine-ui/react';
import {
  ExpandRowBySources,
  TableColumn,
  TableDataSourceWithID,
  TableDraggable,
  TableExpandable,
  TableFetchMore,
  TablePagination,
  TableRowSelection,
  TableScrolling,
} from '@mezzanine-ui/core/table';
import { ArticleStage, ArticlesPermissions } from '../../typings';
import classes from './index.module.scss';

export interface StandardCMSTableProps<T extends TableDataSourceWithID> {
  currentStage: ArticleStage;
  userPermissions: ArticlesPermissions[];
  /**
   * 資料陣列
   */
  dataSource: T[];
  /**
   * Table 欄位設定
   */
  columns: TableColumn<T>[];
  /**
   * Table 滾動設定
   */
  scroll?: TableScrolling;
  /**
   * 自定義 Table Scroll 區 class
   */
  scrollContainerClassName?: string;
  /**
   * 若為 true，則顯示讀取狀態畫面
   */
  loading?: boolean;
  /**
   * Table fetchMore 分頁設定
   */
  fetchMore?: TableFetchMore;
  /**
   * Table 分頁設定
   */
  pagination?: TablePagination;
  /**
   * Table 拖拉功能設定
   */
  draggable?: TableDraggable;
  /**
   * Table expandable 功能設定
   */
  expandable?: Omit<TableExpandable<T>, 'expandedRowRender'> & {
    expandedRowRender(record: T): ReactNode | ExpandRowBySources;
  };
  /**
   * Table rowSelection 功能設定
   */
  rowSelection?: TableRowSelection;
  /**
   * 自定義 Table Header class
   */
  headerClassName?: string;
  /**
   * 自定義 Table class
   */
  className?: string;
  /**
   * 自定義 Table Body class
   */
  bodyClassName?: string;
  /**
   * 自定義 Table Body Row class
   */
  bodyRowClassName?: string;
  /**
   * 自定義 Table Placeholder
   */
  emptyProps?: EmptyProps;
  /**
   * 自定義 loading 提示文字
   */
  loadingTip?: string;
}

const StandardCMSTable = <T extends TableDataSourceWithID>({
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
}: StandardCMSTableProps<T>): ReactElement => {
  const columns = useMemo(
    (): TableColumn<T>[] => [...columnsProps],
    [columnsProps],
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
    <Table
      {...baseTableProps}
      {...(fetchMore ? { fetchMore } : { pagination })}
    />
  );
};

export { StandardCMSTable };
