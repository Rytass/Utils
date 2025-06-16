import React, { ReactElement, useState, useCallback } from 'react';
import { StandardCMSTabs } from '../StandardCMSTabs';
import { StandardCMSTable, StandardCMSTableProps } from '../StandardCMSTable';
import { ArticleStage } from '../../typings';
import classes from './index.module.scss';
import { TableDataSourceWithID } from '@mezzanine-ui/core/table';

export interface StandardCMSListProps<T extends TableDataSourceWithID>
  extends StandardCMSTableProps<T> {
  defaultStage?: ArticleStage;
  onTabChange?: (stage: ArticleStage) => void;
  tabsNaming?: {
    [key in ArticleStage]?: string;
  };
}

const StandardCMSList = <T extends TableDataSourceWithID>({
  defaultStage = ArticleStage.DRAFT,
  onTabChange,
  tabsNaming,
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
    <div className={classes.root}>
      <StandardCMSTabs
        activeStage={activeTabId}
        onChange={onChange}
        tabsNaming={tabsNaming}
      />
      <StandardCMSTable {...tableProps} />
    </div>
  );
};

export { StandardCMSList };
