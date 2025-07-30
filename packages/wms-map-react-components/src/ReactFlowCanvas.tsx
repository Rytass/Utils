import React, { FC, useRef, useState, useMemo, useCallback } from 'react';
import {
  Background,
  Edge,
  Node,
  ReactFlow,
  useReactFlow,
  SelectionMode,
  OnSelectionChangeParams,
} from '@xyflow/react';
import { EditMode, DrawingMode } from '../typings';
import ImageNode from './ImageNode';
import RectangleNode from './RectangleNode';
import { useRectangleDrawing } from './hooks/useRectangleDrawing';
import styles from './reactFlowCanvas.module.scss';

interface ReactFlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
  editMode: EditMode;
  drawingMode: DrawingMode;
  onCreateRectangle: (startX: number, startY: number, endX: number, endY: number) => void;
  onSelectionChange?: (params: OnSelectionChangeParams) => void;
}

const CustomControls: FC = () => {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow();
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => {
    zoomIn();
    setZoom(Math.round(getZoom() * 100));
  };

  const handleZoomOut = () => {
    zoomOut();
    setZoom(Math.round(getZoom() * 100));
  };

  const handleFitView = () => {
    fitView();
    setZoom(Math.round(getZoom() * 100));
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
  onCreateRectangle,
  onSelectionChange,
}) => {
  const { containerRef, isDrawing, previewRect } = useRectangleDrawing({
    editMode,
    drawingMode,
    onCreateRectangle,
  });

  const nodeTypes = useMemo(
    () => ({
      imageNode: (props: any) => <ImageNode {...props} editMode={editMode} />,
      rectangleNode: (props: any) => <RectangleNode {...props} editMode={editMode} />,
    }),
    [editMode]
  );


  return (
    <div 
      ref={containerRef} 
      className={styles.reactFlowWrapper}
      style={{ 
        cursor: drawingMode === DrawingMode.RECTANGLE && editMode === EditMode.LAYER ? 'crosshair' : 'default',
        position: 'relative'
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        className={styles.reactFlowCanvas}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={4}
        nodesConnectable={false}
        nodesDraggable={editMode === EditMode.BACKGROUND || (editMode === EditMode.LAYER && drawingMode !== DrawingMode.RECTANGLE)}
        elementsSelectable={editMode === EditMode.BACKGROUND || (editMode === EditMode.LAYER && drawingMode !== DrawingMode.RECTANGLE)}
        selectNodesOnDrag={false}
        panOnDrag={drawingMode !== DrawingMode.RECTANGLE}
      >
        <CustomControls />
        <Background />

        {nodes.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              📁
            </div>
            <div className={styles.emptyTitle}>目前沒有資料</div>
            <div className={styles.emptySubText}>
              請上傳底圖或開始繪製
            </div>
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
            border: '2px dashed #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        />
      )}
    </div>
  );
};

export default ReactFlowCanvas;
