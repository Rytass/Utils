import React, { ReactElement, useState, useCallback } from 'react';
import { StandardCMSTabs } from '../StandardCMSTabs';
import { StandardCMSTable } from '../StandardCMSTable';
import { ArticleStage } from '../../typings';
import classes from './index.module.scss';

export interface StandardCMSListProps {
  defaultStage?: ArticleStage;
  onTabChange?: (stage: ArticleStage) => void;
  tabsNaming?: {
    [key in ArticleStage]: string;
  };
}

const StandardCMSList = ({
  defaultStage = ArticleStage.DRAFT,
  onTabChange,
  tabsNaming,
}: StandardCMSListProps): ReactElement => {
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
      <StandardCMSTable />
    </div>
  );
};

export { StandardCMSList };
