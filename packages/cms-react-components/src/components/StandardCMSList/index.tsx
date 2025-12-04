import React, { ReactElement, useState, useCallback } from 'react';
import { cx } from '@mezzanine-ui/react';
import { StandardCMSTabs } from '../StandardCMSTabs';
import { StandardCMSTable } from '../StandardCMSTable';
import { StandardCMSTableProps } from '../StandardCMSTable/typings';
import { ArticleStage } from '../../typings';
import classes from './index.module.scss';
import { TableDataSourceWithID } from '@mezzanine-ui/core/table';

export interface StandardCMSListProps<T extends TableDataSourceWithID> extends Omit<
  StandardCMSTableProps<T>,
  'currentStage'
> {
  defaultStage?: ArticleStage;
  onTabChange?: (stage: ArticleStage) => void;
  tabsNaming?: {
    [key in ArticleStage]?: string;
  };
  tableClassName?: string;
}

const StandardCMSList = <T extends TableDataSourceWithID>({
  defaultStage = ArticleStage.DRAFT,
  onTabChange,
  tabsNaming,
  className,
  tableClassName,
  ...tableProps
}: StandardCMSListProps<T>): ReactElement => {
  const [activeTabId, setActiveTabId] = useState<ArticleStage>(defaultStage);

  const onChange = useCallback(
    (stage: ArticleStage) => {
      setActiveTabId(stage);
      onTabChange?.(stage);
    },
    [onTabChange],
  );

  return (
    <div className={cx(classes.root, className)}>
      <StandardCMSTabs activeStage={activeTabId} onChange={onChange} tabsNaming={tabsNaming} />
      <StandardCMSTable {...tableProps} className={tableClassName} currentStage={activeTabId} />
    </div>
  );
};

export { StandardCMSList };
