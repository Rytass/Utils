import React, { FC } from 'react';
import { Button } from '@mezzanine-ui/react';
import { EditMode, DrawingMode } from '../typings';
import styles from './toolbar.module.scss';

interface ToolbarProps {
  onUpload: () => void;
  onDeleteAll: () => void;
  onSave: () => void;
  editMode: EditMode;
  drawingMode: DrawingMode;
  onEditModeChange: (mode: EditMode) => void;
  onToggleRectangleTool: () => void;
}

const Toolbar: FC<ToolbarProps> = ({ onUpload, onDeleteAll, onSave, editMode, drawingMode, onEditModeChange, onToggleRectangleTool }) => {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <Button 
          variant={editMode === EditMode.LAYER ? "contained" : "outlined"} 
          size="small" 
          className={styles.toolbarButton}
          onClick={() => onEditModeChange(EditMode.LAYER)}
        >
          圖層
        </Button>
        <Button 
          variant={editMode === EditMode.BACKGROUND ? "contained" : "outlined"} 
          size="small" 
          className={styles.toolbarButton}
          onClick={() => onEditModeChange(EditMode.BACKGROUND)}
        >
          底圖
        </Button>
        <Button 
          variant="outlined" 
          size="small" 
          className={styles.toolbarButton} 
          onClick={onUpload}
          disabled={editMode !== EditMode.BACKGROUND}
        >
          上傳
        </Button>
        {editMode === EditMode.LAYER && (
          <Button 
            variant={drawingMode === DrawingMode.RECTANGLE ? "contained" : "outlined"} 
            size="small" 
            className={styles.toolbarButton} 
            onClick={onToggleRectangleTool}
          >
            📐 {drawingMode === DrawingMode.RECTANGLE ? '矩形工具 (啟用)' : '矩形工具'}
          </Button>
        )}
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