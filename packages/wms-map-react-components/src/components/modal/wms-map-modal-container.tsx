import React, { FC, useCallback, useEffect, useState } from 'react';
import { Modal } from '@mezzanine-ui/react';
import { ReactFlowProvider } from '@xyflow/react';
import { DrawingMode, EditMode, ViewMode } from '../../typings';
import { DEFAULT_RECTANGLE_COLOR } from '../../constants';
import { WMSMapModalProps } from '../../types';
import WMSMapHeader from './wms-map-header';
import WMSMapContent from './wms-map-content';
import { setDebugMode } from '../../utils/debug-logger';
import styles from './wms-map-modal-container.module.scss';

const WMSMapModalContainer: FC<WMSMapModalProps> = ({
  open,
  onClose,
  viewMode = ViewMode.EDIT,
  colorPalette,
  onNodeClick,
  onSave,
  onBreadcrumbClick,
  onNameChange,
  initialNodes,
  initialEdges,
  debugMode = false,
  title,
  onUpload,
  getFilenameFQDN,
  maxFileSizeKB,
  warehouseIds,
}) => {
  const [editMode, setEditMode] = useState<EditMode>(EditMode.BACKGROUND);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(DrawingMode.NONE);
  const [selectedColor, setSelectedColor] = useState<string>(() => {
    if (colorPalette && colorPalette.length > 0) {
      return colorPalette[0];
    }

    return DEFAULT_RECTANGLE_COLOR;
  });

  // 設定 debug 模式
  useEffect(() => {
    setDebugMode(debugMode);
  }, [debugMode]);

  // 當 colorPalette 變化時，確保選中的顏色仍然有效
  useEffect(() => {
    if (colorPalette && colorPalette.length > 0) {
      if (!colorPalette.includes(selectedColor)) {
        setSelectedColor(colorPalette[0]);
      }
    }
  }, [colorPalette, selectedColor]);

  const handleEditModeChange = useCallback((mode: EditMode) => {
    setEditMode(mode);
    setDrawingMode(DrawingMode.NONE); // 切換編輯模式時重設繪圖模式
  }, []);

  const handleToggleRectangleTool = useCallback(() => {
    if (editMode !== EditMode.LAYER) return;
    setDrawingMode((prev) =>
      prev === DrawingMode.RECTANGLE ? DrawingMode.NONE : DrawingMode.RECTANGLE,
    );
  }, [editMode]);

  const handleTogglePenTool = useCallback(() => {
    if (editMode !== EditMode.LAYER) return;
    setDrawingMode((prev) =>
      prev === DrawingMode.PEN ? DrawingMode.NONE : DrawingMode.PEN,
    );
  }, [editMode]);

  const handleColorChange = useCallback((color: string) => {
    setSelectedColor(color);
  }, []);

  return (
    <Modal open={open} onClose={onClose} className={styles.modal}>
      <WMSMapHeader title={title} />
      <div className={styles.content}>
        <ReactFlowProvider>
          <WMSMapContent
            editMode={editMode}
            drawingMode={drawingMode}
            selectedColor={selectedColor}
            viewMode={viewMode}
            colorPalette={colorPalette}
            onEditModeChange={handleEditModeChange}
            onToggleRectangleTool={handleToggleRectangleTool}
            onTogglePenTool={handleTogglePenTool}
            onColorChange={handleColorChange}
            onNodeClick={onNodeClick}
            onSave={onSave}
            onBreadcrumbClick={onBreadcrumbClick}
            onNameChange={onNameChange}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            onUpload={onUpload}
            getFilenameFQDN={getFilenameFQDN}
            maxFileSizeKB={maxFileSizeKB}
            warehouseIds={warehouseIds}
          />
        </ReactFlowProvider>
      </div>
    </Modal>
  );
};

export default WMSMapModalContainer;
