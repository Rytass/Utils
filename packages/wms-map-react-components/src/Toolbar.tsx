import React, { FC, useState, useEffect } from 'react';
import { Button } from '@mezzanine-ui/react';
import { EditMode, DrawingMode, LayerDrawingTool } from '../typings';
import { DEFAULT_BACKGROUND_TOOL_COLOR } from './constants';
import styles from './toolbar.module.scss';

interface ToolbarProps {
  onUpload: () => void;
  onDeleteAll: () => void;
  onSave: () => void;
  editMode: EditMode;
  drawingMode: DrawingMode;
  onEditModeChange: (mode: EditMode) => void;
  onToggleRectangleTool: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const Toolbar: FC<ToolbarProps> = ({ 
  onUpload, 
  onDeleteAll, 
  onSave, 
  editMode, 
  drawingMode, 
  onEditModeChange, 
  onToggleRectangleTool,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
}) => {
  const [layerTool, setLayerTool] = useState<LayerDrawingTool>(LayerDrawingTool.SELECT);
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_BACKGROUND_TOOL_COLOR);

  // Sync layer tool state with drawing mode
  useEffect(() => {
    if (drawingMode === DrawingMode.RECTANGLE) {
      setLayerTool(LayerDrawingTool.RECTANGLE);
    } else {
      setLayerTool(LayerDrawingTool.SELECT);
    }
  }, [drawingMode]);

  return (
    <>
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
          
          <Button variant="outlined" size="small" className={styles.toolbarButton} onClick={onDeleteAll}>
            刪除全部
          </Button>
        </div>
        <Button variant="contained" size="small" className={styles.saveButton} onClick={onSave}>
          儲存
        </Button>
      </div>
      
      {/* Layer drawing tools - separate floating toolbar with undo/redo */}
      {editMode === EditMode.LAYER && (
        <div className={styles.layerTools}>
          {/* Undo/Redo buttons */}
          <Button
            variant="outlined"
            size="small"
            className={styles.toolButton}
            onClick={onUndo}
            disabled={!canUndo}
            title="上一步"
          >
            ↶
          </Button>
          <Button
            variant="outlined"
            size="small"
            className={styles.toolButton}
            onClick={onRedo}
            disabled={!canRedo}
            title="下一步"
          >
            ↷
          </Button>
          
          {/* Separator */}
          <div className={styles.separator} />
          
          {/* Drawing tools */}
          <Button
            variant={layerTool === LayerDrawingTool.SELECT ? "contained" : "outlined"}
            size="small"
            className={styles.toolButton}
            onClick={() => {
              setLayerTool(LayerDrawingTool.SELECT);
              // Turn off rectangle drawing mode when selecting other tools
              if (drawingMode === DrawingMode.RECTANGLE) {
                onToggleRectangleTool();
              }
            }}
            title="選取工具"
          >
            ↖️
          </Button>
          <Button
            variant={drawingMode === DrawingMode.RECTANGLE ? "contained" : "outlined"}
            size="small"
            className={styles.toolButton}
            onClick={() => {
              setLayerTool(LayerDrawingTool.RECTANGLE);
              onToggleRectangleTool();
            }}
            title="矩形工具"
          >
            ⬜
          </Button>
          <Button
            variant={layerTool === LayerDrawingTool.PEN ? "contained" : "outlined"}
            size="small"
            className={styles.toolButton}
            onClick={() => {
              setLayerTool(LayerDrawingTool.PEN);
              // Turn off rectangle drawing mode when selecting other tools
              if (drawingMode === DrawingMode.RECTANGLE) {
                onToggleRectangleTool();
              }
            }}
            title="鋼筆工具"
          >
            🖊️
          </Button>
          <div className={styles.colorPicker}>
            <div 
              className={styles.colorDisplay}
              style={{ backgroundColor: selectedColor }}
              onClick={() => document.getElementById('colorInput')?.click()}
            />
            <input
              id="colorInput"
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className={styles.colorInput}
              title="選擇顏色"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Toolbar;