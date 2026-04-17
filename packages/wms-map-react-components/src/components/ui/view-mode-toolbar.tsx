import React, { FC } from 'react';
import { Toggle } from '@mezzanine-ui/react';
import { ViewMode } from '../../typings';
import styles from './view-mode-toolbar.module.scss';

interface ViewModeToolbarProps {
  viewMode: ViewMode;
  showBackground: boolean;
  onToggleBackground: (show: boolean) => void;
}

const ViewModeToolbar: FC<ViewModeToolbarProps> = ({ viewMode, showBackground, onToggleBackground }) => {
  // 只在檢視模式下顯示
  if (viewMode !== ViewMode.VIEW) {
    return null;
  }

  // console.log('🔧 ViewModeToolbar 渲染:', { viewMode, showBackground });

  const handleToggle = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const checked = event.target.checked;

    console.log('🔧 Toggle 切換:', { from: showBackground, to: checked });
    onToggleBackground(checked);
  };

  return (
    <div className={styles.viewModeToolbar}>
      <div className={styles.toolbarContent}>
        <span className={styles.label}>顯示底圖</span>
        <Toggle checked={showBackground} onChange={handleToggle} size="main" className={styles.switch} />
      </div>
    </div>
  );
};

export default ViewModeToolbar;
