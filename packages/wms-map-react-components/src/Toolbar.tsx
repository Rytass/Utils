import React, { FC, useEffect, useState } from 'react';
import { Button } from '@mezzanine-ui/react';
import { DrawingMode, EditMode } from '../typings';
import { DEFAULT_BACKGROUND_TOOL_COLOR } from './constants';
import styles from './toolbar.module.scss';
import PenToolIcon from './icons/pen-tool.svg';
import SquareIcon from './icons/square.svg';
import PointerIcon from './icons/pointer.svg';
import RedoIcon from './icons/redo.svg';
import UndoIcon from './icons/undo.svg';

interface ToolbarProps {
  onUpload: () => void;
  onDeleteAll: () => void;
  onSave: () => void;
  editMode: EditMode;
  drawingMode: DrawingMode;
  onEditModeChange: (mode: EditMode) => void;
  onToggleRectangleTool: () => void;
  onTogglePenTool: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onColorChange?: (color: string) => void;
  selectedColor?: string;
  colorPalette?: string[];
}

const Toolbar: FC<ToolbarProps> = ({
  onUpload,
  onDeleteAll,
  onSave,
  editMode,
  drawingMode,
  onEditModeChange,
  onToggleRectangleTool,
  onTogglePenTool,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onColorChange,
  selectedColor: parentSelectedColor,
  colorPalette,
}) => {

  const [showColorMenu, setShowColorMenu] = useState<boolean>(false);

  const selectedColor = parentSelectedColor || DEFAULT_BACKGROUND_TOOL_COLOR;

  const handleColorChange = (color: string) => {
    if (onColorChange) {
      onColorChange(color);
    }
  };

  const handleColorPickerClick = () => {
    if (colorPalette && colorPalette.length > 0) {
      setShowColorMenu(!showColorMenu);
    }
    // 如果沒有提供 colorPalette，則不執行任何操作（顏色工具將被隱藏）
  };

  const handleColorSelect = (color: string) => {
    handleColorChange(color);
    setShowColorMenu(false);
  };

  // 點擊外部關閉顏色選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const colorPicker = document.querySelector(`.${styles.colorPicker}`);

      if (colorPicker && !colorPicker.contains(event.target as Node)) {
        setShowColorMenu(false);
      }
    };

    if (showColorMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorMenu]);

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Button
            variant={editMode === EditMode.LAYER ? 'contained' : 'outlined'}
            size="small"
            className={`${styles.toolbarButton} ${editMode === EditMode.LAYER ? styles.toolbarButtonActive : ''}`}
            onClick={() => onEditModeChange(EditMode.LAYER)}
          >
            圖層
          </Button>
          <Button
            variant={
              editMode === EditMode.BACKGROUND ? 'contained' : 'outlined'
            }
            size="small"
            className={`${styles.toolbarButton} ${editMode === EditMode.BACKGROUND ? styles.toolbarButtonActive : ''}`}
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

          <Button
            variant="outlined"
            size="small"
            className={styles.toolbarButton}
            onClick={onDeleteAll}
          >
            刪除全部
          </Button>
        </div>
        <Button
          variant="contained"
          size="small"
          className={styles.saveButton}
          onClick={onSave}
        >
          儲存
        </Button>
      </div>

      {/* Unified toolbar - always visible, content changes based on mode */}
      <div className={styles.unifiedTools}>
        {/* Undo/Redo buttons - always visible */}
        <Button
          variant="outlined"
          size="small"
          className={`${styles.toolButton} ${canUndo ? '' : styles.toolButtonDisabled}`}
          onClick={onUndo}
          disabled={!canUndo}
          title="上一步"
        >
          <img src={UndoIcon} alt="上一步" className={styles.toolIcon} />
        </Button>
        <Button
          variant="outlined"
          size="small"
          className={`${styles.toolButton} ${canRedo ? '' : styles.toolButtonDisabled}`}
          onClick={onRedo}
          disabled={!canRedo}
          title="下一步"
        >
          <img src={RedoIcon} alt="下一步" className={styles.toolIcon} />
        </Button>

        {/* Separator and drawing tools - only in LAYER mode */}
        {editMode === EditMode.LAYER && (
          <>
            <div className={styles.separator} />

            {/* Drawing tools */}
            <Button
              variant={
                drawingMode === DrawingMode.NONE ? 'contained' : 'outlined'
              }
              size="small"
              className={`${styles.toolButton} ${drawingMode === DrawingMode.NONE ? styles.toolButtonActive : ''}`}
              onClick={() => {
                // 選擇選取工具時關閉繪圖模式
                if (drawingMode === DrawingMode.RECTANGLE) {
                  onToggleRectangleTool();
                } else if (drawingMode === DrawingMode.PEN) {
                  onTogglePenTool();
                }
              }}
              title="選取工具"
            >
              <img
                src={PointerIcon}
                alt="選取工具"
                className={styles.toolIcon}
              />
            </Button>
            <Button
              variant={
                drawingMode === DrawingMode.RECTANGLE ? 'contained' : 'outlined'
              }
              size="small"
              className={`${styles.toolButton} ${drawingMode === DrawingMode.RECTANGLE ? styles.toolButtonActive : ''}`}
              onClick={onToggleRectangleTool}
              title="矩形工具"
            >
              <img
                src={SquareIcon}
                alt="矩形工具"
                className={styles.toolIcon}
              />
            </Button>
            <Button
              variant={
                drawingMode === DrawingMode.PEN ? 'contained' : 'outlined'
              }
              size="small"
              className={`${styles.toolButton} ${drawingMode === DrawingMode.PEN ? styles.toolButtonActive : ''}`}
              onClick={onTogglePenTool}
              title="鋼筆工具"
            >
              <img
                src={PenToolIcon}
                alt="鋼筆工具"
                className={styles.toolIcon}
              />
            </Button>
            {/* 顏色工具 - 只有在提供 colorPalette 時才顯示 */}
            {colorPalette && colorPalette.length > 0 && (
              <>
                <div className={styles.separator} />
                <div className={styles.colorPicker}>
                  <div
                    className={styles.colorDisplay}
                    style={{ backgroundColor: selectedColor }}
                    onClick={handleColorPickerClick}
                    title="選擇顏色"
                  />

                  {/* 動態顏色選單 - 顯示在顏色工具上方 */}
                  {showColorMenu && (
                    <div className={styles.colorMenu}>
                      {colorPalette.map((color, index) => (
                        <div
                          key={index}
                          className={`${styles.colorOption} ${selectedColor === color ? styles.colorOptionSelected : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => handleColorSelect(color)}
                          title={color}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Toolbar;
