import { ReactNode } from 'react';
import { EmptyProps } from '@mezzanine-ui/react';
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
import {
  ArticleStage,
  ArticlesPermissions,
  ArticleTableActionsType,
} from '../../typings';

export interface StandardCMSTableEventsProps<T extends TableDataSourceWithID> {
  onUpdate?: (source: T) => Promise<void>;
  onSubmit?: (source: T) => Promise<void>;
  onRelease?: (source: T, releasedAt: string) => Promise<void>;
  onApprove?: (source: T) => Promise<void>;
  onDelete?: (source: T) => Promise<void>;
}

export interface StandardCMSTableProps<T extends TableDataSourceWithID> {
  /**
   * 當下文章狀態
   */
  currentStage: ArticleStage;
  /**
   * 當下使用者權限
   */
  userPermissions: ArticlesPermissions[];
  /**
   * 按鈕事件
   */
  actionsEvents: StandardCMSTableEventsProps<T>;
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
  /**
   * 是否顯示版本紀錄按鈕
   */
  withVersionLogs?: boolean;
  /**
   * 定義 Table row 操作列
   */
  actions?: ArticleTableActionsType;
  /**
   * 自定義額外 Table row 操作列
   */
  customizedActions?: TableColumn<T>[];
}
