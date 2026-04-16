import React, { ReactElement, Key, useCallback, useMemo } from 'react';
import { Tab, TabItem } from '@mezzanine-ui/react';
import { ArticleStage } from '../../typings';
import classes from './index.module.scss';

export interface StandardCMSTabsProps {
  activeStage: ArticleStage;
  onChange: (stage: ArticleStage) => void;
  tabsNaming?: {
    [key in ArticleStage]?: string;
  };
}

const StandardCMSTabs = ({ activeStage, onChange, tabsNaming }: StandardCMSTabsProps): ReactElement => {
  const tabs = useMemo(
    () => [
      {
        id: ArticleStage.RELEASED,
        name: tabsNaming?.[ArticleStage.RELEASED] ?? '已發佈',
      },
      {
        id: ArticleStage.SCHEDULED,
        name: tabsNaming?.[ArticleStage.SCHEDULED] ?? '已預約',
      },
      {
        id: ArticleStage.VERIFIED,
        name: tabsNaming?.[ArticleStage.VERIFIED] ?? '可發佈',
      },
      {
        id: ArticleStage.REVIEWING,
        name: tabsNaming?.[ArticleStage.REVIEWING] ?? '待審核',
      },
      {
        id: ArticleStage.DRAFT,
        name: tabsNaming?.[ArticleStage.DRAFT] ?? '草稿區',
      },
    ],
    [tabsNaming],
  );

  const onTabChange = useCallback(
    (activeKey: Key) => {
      const nextStage = activeKey as ArticleStage;

      onChange(nextStage);
    },
    [onChange],
  );

  return (
    <Tab activeKey={activeStage} className={classes.tabBar} direction="horizontal" onChange={onTabChange}>
      {tabs.map(tab => (
        <TabItem key={tab.id}>{tab.name}</TabItem>
      ))}
    </Tab>
  );
};

export { StandardCMSTabs };
