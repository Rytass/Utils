import React, { FC } from 'react';
import { Button } from '@mezzanine-ui/react';
import styles from './toolbar.module.scss';

interface ToolbarProps {
  onUpload: () => void;
  onDeleteAll: () => void;
  onSave: () => void;
}

const Toolbar: FC<ToolbarProps> = ({ onUpload, onDeleteAll, onSave }) => {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <Button variant="outlined" size="small" className={styles.toolbarButton}>
          圖層
        </Button>
        <Button variant="outlined" size="small" className={styles.toolbarButton}>
          底圖
        </Button>
        <Button variant="outlined" size="small" className={styles.toolbarButton} onClick={onUpload}>
          上傳
        </Button>
        <Button variant="outlined" size="small" className={styles.toolbarButton} onClick={onDeleteAll}>
          刪除全部
        </Button>
      </div>
      <Button variant="contained" size="small" className={styles.saveButton} onClick={onSave}>
        儲存
      </Button>
    </div>
  );
};

export default Toolbar;