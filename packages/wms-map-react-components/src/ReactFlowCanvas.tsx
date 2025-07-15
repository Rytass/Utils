import React, { FC, useRef, useState } from 'react';
import {
  Background,
  Edge,
  Node,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import styles from './reactFlowCanvas.module.scss';

interface ReactFlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
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
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  return (
    <div ref={reactFlowWrapper} className={styles.reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        className={styles.reactFlowCanvas}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={4}
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
    </div>
  );
};

export default ReactFlowCanvas;