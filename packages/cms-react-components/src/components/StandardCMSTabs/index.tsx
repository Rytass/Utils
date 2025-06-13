import React, {
  ReactElement,
  Key,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { Tabs, TabPane, Tab } from '@mezzanine-ui/react';
import { ArticleStage } from '../../typings';
import classes from './index.module.scss';

export interface StandardCMSTabsProps {
  defaultStage?: ArticleStage;
  onChange?: (stage: ArticleStage) => void;
  tabsNaming?: {
    [key in ArticleStage]: string;
  };
}

const StandardCMSTabs = ({
  defaultStage = ArticleStage.DRAFT,
  onChange,
  tabsNaming,
}: StandardCMSTabsProps): ReactElement => {
  const [activeTabId, setActiveTabId] = useState<ArticleStage>(defaultStage);

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

      setActiveTabId(nextStage);
      onChange?.(nextStage);
    },
    [onChange],
  );

  return (
    <Tabs
      activeKey={activeTabId}
      tabBarClassName={classes.tabBar}
      onChange={onTabChange}
    >
      {tabs.map((tab) => {
        return <TabPane key={tab.id} tab={<Tab>{tab.name}</Tab>} />;
      })}
    </Tabs>
  );
};

export { StandardCMSTabs };
