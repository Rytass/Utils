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
}

const StandardCMSTabs = ({
  defaultStage = ArticleStage.DRAFT,
  onChange,
}: StandardCMSTabsProps): ReactElement => {
  const [activeTabId, setActiveTabId] = useState<ArticleStage>(defaultStage);

  const tabs = useMemo(
    () => [
      {
        id: ArticleStage.RELEASED,
        name: '已發佈',
      },
      {
        id: ArticleStage.SCHEDULED,
        name: '已預約',
      },
      {
        id: ArticleStage.VERIFIED,
        name: '可發佈',
      },
      {
        id: ArticleStage.REVIEWING,
        name: '待審核',
      },
      {
        id: ArticleStage.DRAFT,
        name: '草稿區',
      },
    ],
    [],
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
        return (
          <TabPane
            key={tab.id}
            className={classes.tabPane}
            tab={<Tab>{tab.name}</Tab>}
          />
        );
      })}
    </Tabs>
  );
};

export { StandardCMSTabs };
