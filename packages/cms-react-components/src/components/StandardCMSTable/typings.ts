import { EmptyProps, PaginationProps } from '@mezzanine-ui/react';
import {
  TableColumn,
  TableDataSourceWithId,
  TableDraggable,
  TableExpandable,
  TableRowSelection,
} from '@mezzanine-ui/core/table';
import { LogsModalProps } from '../cms-modals/LogsModal';
import { ArticleStage, ArticlesPermissions, ArticleTableActionsType } from '../../typings';

export interface StandardCMSTableEventsProps<T extends TableDataSourceWithId> {
  onView?: (source: T) => Promise<void>;
  onSubmit?: (source: T) => Promise<void>;
  onPutBack?: (source: T) => Promise<void>;
  onRelease?: (source: T, releasedAt: string) => Promise<void>;
  onWithdraw?: (source: T) => Promise<void>;
  onApprove?: (source: T) => Promise<void>;
  onReject?: (source: T, reason: string) => Promise<void>;
  onDelete?: (source: T) => Promise<void>;
}

export interface StandardCMSTableProps<T extends TableDataSourceWithId> {
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
   * 若為 true，則顯示讀取狀態畫面
   */
  loading?: boolean;
  /**
   * Table 分頁設定
   */
  pagination?: PaginationProps;
  /**
   * Table 拖拉功能設定
   */
  draggable?: TableDraggable<T>;
  /**
   * Table expandable 功能設定
   */
  expandable?: TableExpandable<T>;
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
   * 版本紀錄資料
   */
  versionLogsData?: (source: T) => LogsModalProps;
  /**
   * 定義 Table row 操作列
   */
  actions?: ArticleTableActionsType;
  /**
   * 自定義額外 Table row 操作列
   */
  customizedActions?: TableColumn<T>[];
}
