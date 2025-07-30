import React, { FC, useRef, useState, useMemo, useCallback } from 'react';
import {
  Background,
  Edge,
  Node,
  ReactFlow,
  useReactFlow,
  SelectionMode,
} from '@xyflow/react';
import { EditMode, DrawingMode } from '../typings';
import ImageNode from './ImageNode';
import RectangleNode from './RectangleNode';
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
      {/* Undo/Redo Controls - Left */}
      <div className={styles.undoRedoControls}>
        <button className={styles.controlButton}>
          ↶
        </button>
        <button className={styles.controlButton}>
          ↷
        </button>
      </div>

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
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  // Screen coordinates for preview rectangle
  const [startScreenPos, setStartScreenPos] = useState({ x: 0, y: 0 });
  const [currentScreenPos, setCurrentScreenPos] = useState({ x: 0, y: 0 });

  const nodeTypes = useMemo(
    () => ({
      imageNode: (props: any) => <ImageNode {...props} editMode={editMode} />,
      rectangleNode: (props: any) => <RectangleNode {...props} editMode={editMode} />,
    }),
    [editMode]
  );

  // Handle DOM mouse events for rectangle drawing
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (drawingMode !== DrawingMode.RECTANGLE || editMode !== EditMode.LAYER) return;
    
    console.log('Mouse down in drawing mode');
    
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) return;
    
    const rect = wrapper.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    const position = screenToFlowPosition({ 
      x: event.clientX, 
      y: event.clientY
    });
    
    console.log('Start screen:', { x: screenX, y: screenY });
    console.log('Start flow position:', position);
    
    setIsDrawing(true);
    setStartPos(position);
    setCurrentPos(position);
    setStartScreenPos({ x: screenX, y: screenY });
    setCurrentScreenPos({ x: screenX, y: screenY });
  }, [drawingMode, editMode, screenToFlowPosition]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDrawing || drawingMode !== DrawingMode.RECTANGLE) return;
    
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) return;
    
    const rect = wrapper.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    const position = screenToFlowPosition({ 
      x: event.clientX, 
      y: event.clientY
    });
    
    setCurrentPos(position);
    setCurrentScreenPos({ x: screenX, y: screenY });
  }, [isDrawing, drawingMode, screenToFlowPosition]);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!isDrawing || drawingMode !== DrawingMode.RECTANGLE) return;
    
    console.log('Mouse up');
    
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) return;
    
    const rect = wrapper.getBoundingClientRect();
    const endPosition = screenToFlowPosition({ 
      x: event.clientX, 
      y: event.clientY
    });
    
    console.log('End flow position:', endPosition);
    console.log('Final rectangle will be created at:', {
      x: Math.min(startPos.x, endPosition.x),
      y: Math.min(startPos.y, endPosition.y),
      width: Math.abs(endPosition.x - startPos.x),
      height: Math.abs(endPosition.y - startPos.y)
    });
    
    const width = Math.abs(endPosition.x - startPos.x);
    const height = Math.abs(endPosition.y - startPos.y);
    
    console.log('Rectangle size:', { width, height });
    
    if (width > 10 && height > 10) {
      console.log('Creating rectangle...');
      onCreateRectangle(startPos.x, startPos.y, endPosition.x, endPosition.y);
    }
    
    setIsDrawing(false);
  }, [isDrawing, drawingMode, screenToFlowPosition, startPos, onCreateRectangle]);

  // Add and remove event listeners
  React.useEffect(() => {
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) return;

    wrapper.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      wrapper.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);


  // Calculate preview rectangle for drawing using screen coordinates
  const previewRect = isDrawing ? {
    x: Math.min(startScreenPos.x, currentScreenPos.x),
    y: Math.min(startScreenPos.y, currentScreenPos.y),
    width: Math.abs(currentScreenPos.x - startScreenPos.x),
    height: Math.abs(currentScreenPos.y - startScreenPos.y),
  } : null;

  return (
    <div 
      ref={reactFlowWrapper} 
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
