import React, { FC, useEffect, useState } from 'react';
import { Button } from '@mezzanine-ui/react';
import { DrawingMode, EditMode } from '../../typings';
import { DEFAULT_BACKGROUND_TOOL_COLOR } from '../../constants';
import styles from './toolbar.module.scss';
import { PenToolIcon, DeleteIcon, ImageIcon, SquareIcon, PointerIcon, RedoIcon, UndoIcon } from '../../icons';

// LoadingIcon 組件
const LoadingIcon: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`${styles.loadingIcon} ${className || ''}`} />
);

interface ToolbarProps {
  onUpload: (files: File[]) => Promise<void>;
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
  isUploading?: boolean;
  maxFileSizeKB?: number;
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
  isUploading = false,
  maxFileSizeKB = 30720, // 預設 30MB
}) => {
  const [showColorMenu, setShowColorMenu] = useState<boolean>(false);

  const selectedColor = parentSelectedColor || DEFAULT_BACKGROUND_TOOL_COLOR;

  // 檔案選擇處理
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.target.files || []);

    // 檔案類型驗證
    const validFiles = files.filter(file => {
      if (!file.type.match(/^image\//i)) {
        return false;
      }

      // 檔案大小驗證 (KB)
      const fileSizeKB = file.size / 1024;

      if (fileSizeKB > maxFileSizeKB) {
        console.warn(`檔案 ${file.name} 大小 ${Math.round(fileSizeKB)}KB 超過限制 ${maxFileSizeKB}KB`);

        return false;
      }

      return true;
    });

    if (validFiles.length !== files.length) {
      const invalidCount = files.length - validFiles.length;

      console.warn(`${invalidCount} 個檔案被跳過：格式不支援或檔案過大`);
    }

    if (validFiles.length > 0) {
      await onUpload(validFiles);
    }

    // 清空 input
    event.target.value = '';
  };

  const handleColorChange = (color: string): void => {
    if (onColorChange) {
      onColorChange(color);
    }
  };

  const handleColorPickerClick = (): void => {
    if (colorPalette && colorPalette.length > 0) {
      setShowColorMenu(!showColorMenu);
    }
    // 如果沒有提供 colorPalette，則不執行任何操作（顏色工具將被隱藏）
  };

  const handleColorSelect = (color: string): void => {
    handleColorChange(color);
    setShowColorMenu(false);
  };

  // 點擊外部關閉顏色選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const colorPicker = document.querySelector(`.${styles.colorPicker}`);

      if (colorPicker && !colorPicker.contains(event.target as Node)) {
        setShowColorMenu(false);
      }
    };

    if (showColorMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return (): void => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorMenu]);

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* Toggle Switch for 圖層/底圖 */}
          <div className={styles.toggleSwitch}>
            <div
              className={`${styles.toggleSlider} ${editMode === EditMode.BACKGROUND ? styles.toggleSliderRight : ''}`}
            />
            <button
              className={`${styles.toggleOption} ${editMode === EditMode.LAYER ? styles.toggleOptionActive : ''}`}
              onClick={() => onEditModeChange(EditMode.LAYER)}
            >
              圖層
            </button>
            <button
              className={`${styles.toggleOption} ${editMode === EditMode.BACKGROUND ? styles.toggleOptionActive : ''}`}
              onClick={() => onEditModeChange(EditMode.BACKGROUND)}
            >
              底圖
            </button>
          </div>

          {/* 分隔線 */}
          <div className={styles.separator} />

          {/* 上傳按鈕 - 使用 file input 覆蓋 */}
          {editMode === EditMode.BACKGROUND && (
            <div className={styles.uploadButtonContainer}>
              <Button
                variant="outlined"
                size="small"
                className={`${styles.toolbarButton} ${styles.buttonWithIcon} ${styles.uploadButton} ${isUploading ? styles.uploading : ''}`}
                disabled={isUploading}
              >
                <div className={styles.buttonContent}>
                  {isUploading ? (
                    <LoadingIcon className={styles.toolIcon} />
                  ) : (
                    <ImageIcon className={styles.toolIcon} />
                  )}
                  {isUploading ? '上傳中...' : '上傳'}
                </div>
              </Button>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className={styles.uploadInput}
                disabled={isUploading}
              />
            </div>
          )}

          <Button
            variant="outlined"
            size="small"
            className={`${styles.toolbarButton} ${styles.buttonWithIcon}`}
            onClick={e => {
              onDeleteAll();
              // 強制重置按鈕狀態
              const btn = e.target as HTMLButtonElement;

              btn.blur();
              setTimeout(() => {
                btn.blur();
              }, 0);
            }}
          >
            <DeleteIcon className={styles.toolIcon} />
            刪除全部
          </Button>
        </div>
        <Button
          variant="contained"
          size="small"
          className={styles.saveButton}
          onClick={e => {
            onSave();
            // 強制重置按鈕狀態
            const btn = e.target as HTMLButtonElement;

            btn.blur();
            setTimeout(() => {
              btn.blur();
            }, 0);
          }}
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
          <UndoIcon className={styles.toolIcon} />
        </Button>
        <Button
          variant="outlined"
          size="small"
          className={`${styles.toolButton} ${canRedo ? '' : styles.toolButtonDisabled}`}
          onClick={onRedo}
          disabled={!canRedo}
          title="下一步"
        >
          <RedoIcon className={styles.toolIcon} />
        </Button>

        {/* Separator and drawing tools - only in LAYER mode */}
        {editMode === EditMode.LAYER && (
          <>
            <div className={styles.separator} />

            {/* Drawing tools */}
            <Button
              variant={drawingMode === DrawingMode.NONE ? 'contained' : 'outlined'}
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
              <PointerIcon className={styles.toolIcon} />
            </Button>
            <Button
              variant={drawingMode === DrawingMode.RECTANGLE ? 'contained' : 'outlined'}
              size="small"
              className={`${styles.toolButton} ${drawingMode === DrawingMode.RECTANGLE ? styles.toolButtonActive : ''}`}
              onClick={onToggleRectangleTool}
              title="矩形工具"
            >
              <SquareIcon className={styles.toolIcon} />
            </Button>
            <Button
              variant={drawingMode === DrawingMode.PEN ? 'contained' : 'outlined'}
              size="small"
              className={`${styles.toolButton} ${drawingMode === DrawingMode.PEN ? styles.toolButtonActive : ''}`}
              onClick={onTogglePenTool}
              title="鋼筆工具"
            >
              <PenToolIcon className={styles.toolIcon} />
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
