import React, { FC, useCallback, useMemo, useState } from 'react';
import {
  Background,
  Edge,
  Node,
  OnSelectionChangeParams,
  ReactFlow,
  useReactFlow,
  useOnViewportChange,
} from '@xyflow/react';
import { DrawingMode, EditMode, ViewMode } from '../typings';
import ImageNode from './ImageNode';
import RectangleNode from './RectangleNode';
import PathNode from './PathNode';
import { useRectangleDrawing } from './hooks/useRectangleDrawing';
import { usePenDrawing } from './hooks/usePenDrawing';
import styles from './reactFlowCanvas.module.scss';

interface ReactFlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
  editMode: EditMode;
  drawingMode: DrawingMode;
  viewMode: ViewMode;
  selectedColor?: string;
  onCreateRectangle: (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => void;
  onCreatePath: (points: { x: number; y: number }[]) => void;
  onSelectionChange?: (params: OnSelectionChangeParams) => void;
  onTextEditComplete?: (id: string, oldText: string, newText: string) => void;
}

const CustomControls: FC = () => {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow();
  const [zoom, setZoom] = useState(() => Math.round(getZoom() * 100));

  // Listen for viewport changes (including mouse wheel zoom)
  useOnViewportChange({
    onChange: (viewport) => {
      setZoom(Math.round(viewport.zoom * 100));
    }
  });

  const handleZoomIn = () => {
    zoomIn();
    // No need to manually update zoom state, useOnViewportChange will handle it
  };

  const handleZoomOut = () => {
    zoomOut();
    // No need to manually update zoom state, useOnViewportChange will handle it
  };

  const handleFitView = () => {
    fitView();
    // No need to manually update zoom state, useOnViewportChange will handle it
  };

  return (
    <>
      {/* Zoom Controls - Right */}
      <div className={styles.zoomControls}>
        <button className={styles.controlButton} onClick={handleZoomOut}>
          −
        </button>
        <span className={styles.zoomPercentage}>{zoom}%</span>
        <button className={styles.controlButton} onClick={handleZoomIn}>
          +
        </button>
        <button className={styles.controlButton} onClick={handleFitView}>
          ⛶
        </button>
      </div>
    </>
  );
};

const ReactFlowCanvas: FC<ReactFlowCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  editMode,
  drawingMode,
  viewMode,
  selectedColor = '#3b82f6',
  onCreateRectangle,
  onCreatePath,
  onSelectionChange,
  onTextEditComplete,
}) => {
  const {
    containerRef: rectContainerRef,
    isDrawing: isDrawingRect,
    previewRect,
  } = useRectangleDrawing({
    editMode,
    drawingMode,
    onCreateRectangle,
  });

  const {
    containerRef: penContainerRef,
    isDrawing: isDrawingPen,
    previewPath,
    currentPoints,
    firstPoint,
    canClose,
    forceComplete,
  } = usePenDrawing({
    editMode,
    drawingMode,
    onCreatePath,
  });

  const nodeTypes = useMemo(
    () => ({
      imageNode: (props: any) => <ImageNode {...props} editMode={editMode} viewMode={viewMode} />,
      rectangleNode: (props: any) => (
        <RectangleNode {...props} editMode={editMode} viewMode={viewMode} onTextEditComplete={onTextEditComplete} />
      ),
      pathNode: (props: any) => <PathNode {...props} editMode={editMode} viewMode={viewMode} onTextEditComplete={onTextEditComplete} />,
    }),
    [editMode, viewMode, onTextEditComplete],
  );

  // Use a callback ref to assign both drawing hooks to the same container
  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      rectContainerRef.current = node;
      penContainerRef.current = node;
    },
    [rectContainerRef, penContainerRef],
  );

  const getCursor = () => {
    return 'default';
  };

  // Handle pane click for auto-completing pen drawing
  const handlePaneClick = useCallback((event?: any) => {
    // Check if any modifier keys are pressed - if so, don't auto-complete
    // This prevents accidental completion when using Shift for line constraints
    const hasModifierKeys = event && (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey);
    
    console.log('📋 ReactFlow pane clicked', {
      drawingMode,
      editMode,
      isDrawingPen,
      hasModifierKeys,
      willForceComplete: drawingMode === DrawingMode.PEN && editMode === EditMode.LAYER && isDrawingPen && !hasModifierKeys
    });
    
    // Only auto-complete if we're in pen drawing mode, actually drawing, and no modifier keys are pressed
    if (drawingMode === DrawingMode.PEN && editMode === EditMode.LAYER && isDrawingPen && !hasModifierKeys) {
      console.log('🔴 Force completing path from pane click');
      forceComplete();
    }
  }, [drawingMode, editMode, isDrawingPen, forceComplete]);

  return (
    <div
      ref={containerRef}
      className={styles.reactFlowWrapper}
      style={{
        cursor: getCursor(),
        position: 'relative',
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        className={styles.reactFlowCanvas}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={4}
        nodesConnectable={false}
        nodesDraggable={
          viewMode === ViewMode.EDIT && drawingMode === DrawingMode.NONE
        }
        elementsSelectable={
          viewMode === ViewMode.EDIT
        }
        selectNodesOnDrag={false}
        panOnDrag={viewMode === ViewMode.EDIT && drawingMode === DrawingMode.NONE}
        zoomOnDoubleClick={viewMode === ViewMode.EDIT && drawingMode !== DrawingMode.PEN}
      >
        <CustomControls />
        <Background />

        {nodes.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📁</div>
            <div className={styles.emptyTitle}>目前沒有資料</div>
            <div className={styles.emptySubText}>請上傳底圖或開始繪製</div>
          </div>
        )}
      </ReactFlow>

      {/* Drawing preview rectangle */}
      {previewRect && (
        <div
          style={{
            position: 'absolute',
            left: previewRect.x,
            top: previewRect.y,
            width: previewRect.width,
            height: previewRect.height,
            border: `2px dashed ${selectedColor}`,
            backgroundColor: `${selectedColor}33`, // 20% opacity
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        />
      )}

      {/* Drawing preview path and points */}
      {drawingMode === DrawingMode.PEN && editMode === EditMode.LAYER && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          {/* Preview path */}
          {previewPath && previewPath.length > 1 && (
            <path
              d={`M ${previewPath.map((p) => `${p.x} ${p.y}`).join(' L ')}`}
              stroke={selectedColor}
              strokeWidth="2"
              strokeDasharray="5,5"
              fill="none"
              fillOpacity={0}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Closing line preview for paths with 3+ points */}
          {currentPoints && currentPoints.length >= 3 && (
            <path
              d={`M ${currentPoints[currentPoints.length - 1].x} ${currentPoints[currentPoints.length - 1].y} L ${currentPoints[0].x} ${currentPoints[0].y}`}
              stroke={selectedColor}
              strokeWidth="1"
              strokeDasharray="2,2"
              fill="none"
              strokeLinecap="round"
              opacity="0.5"
            />
          )}

          {/* First point with close indicator when closable */}
          {firstPoint && canClose && (
            <>
              {/* Pulsing outer ring for first point */}
              <circle
                cx={firstPoint.x}
                cy={firstPoint.y}
                r="8"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                opacity="0.6"
              >
                <animate
                  attributeName="r"
                  values="6;10;6"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.8;0.3;0.8"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Inner circle for first point */}
              <circle
                cx={firstPoint.x}
                cy={firstPoint.y}
                r="5"
                fill="#10b981"
                stroke="white"
                strokeWidth="2"
                style={{ cursor: 'default' }}
              />
            </>
          )}

          {/* Current points */}
          {currentPoints &&
            currentPoints.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={index === 0 && canClose ? '0' : '4'} // Hide first point circle if we're showing the close indicator
                fill={selectedColor}
                stroke="white"
                strokeWidth="2"
              />
            ))}
        </svg>
      )}
    </div>
  );
};

export default ReactFlowCanvas;
