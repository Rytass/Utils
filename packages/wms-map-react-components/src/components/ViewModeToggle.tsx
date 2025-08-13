import React, { FC } from 'react';
import { Button } from '@mezzanine-ui/react';
import { ViewMode } from '../../typings';
import styles from './viewModeToggle.module.scss';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onToggle: () => void;
  isVisible?: boolean;
}

/**
 * ViewModeToggle - 用於測試的視圖模式切換按鈕
 * 
 * 這個組件專門用於開發和測試階段，方便切換編輯模式和檢視模式。
 * 現在浮動顯示在 Modal 遮罩層上方，不受 Modal 內部佈局影響。
 * 所有相關的樣式和邏輯都包含在這個檔案中，便於後續移除。
 */
const ViewModeToggle: FC<ViewModeToggleProps> = ({ viewMode, onToggle, isVisible = false }) => {
  if (!isVisible) return null;

  return (
    <div className={styles.floatingContainer}>
      <Button
        variant={viewMode === ViewMode.EDIT ? "contained" : "outlined"}
        size="small"
        onClick={onToggle}
        className={styles.toggleButton}
        title={`切換至${viewMode === ViewMode.EDIT ? '檢視' : '編輯'}模式`}
      >
        {viewMode === ViewMode.EDIT ? "📝 編輯模式" : "👀 檢視模式"}
      </Button>
    </div>
  );
};

export default ViewModeToggle;