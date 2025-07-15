import React, { FC, useCallback } from 'react';
import { Button, Modal, ModalHeader } from '@mezzanine-ui/react';
import {
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Toolbar from './Toolbar';
import Breadcrumb from './Breadcrumb';
import ReactFlowCanvas from './ReactFlowCanvas';
import styles from './wmsMapModal.module.scss';

interface WmsMapModalProps {
  onClose: () => void;
  open: boolean;
}

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const WmsMapModal: FC<WmsMapModalProps> = ({ onClose, open }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges],
  );

  const handleSave = () => {
    console.log('Saving warehouse layout...', { nodes, edges });
  };

  const handleUpload = () => {
    const input = document.createElement('input');

    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/jpg';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];

      if (file) {
        // Check file type
        if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
          alert('請選擇 PNG 或 JPG 格式的圖片');
          return;
        }

        // Create file URL
        const imageUrl = URL.createObjectURL(file);
        
        // Create image element to get dimensions
        const img = new Image();
        img.onload = () => {
          // Calculate appropriate size (max 400px width/height)
          const maxSize = 400;
          let width = img.width;
          let height = img.height;
          
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width = width * ratio;
            height = height * ratio;
          }

          // Create new image node
          const newNode = {
            id: `image-${Date.now()}`,
            type: 'imageNode',
            position: { x: 100, y: 100 },
            data: {
              imageUrl,
              width: Math.round(width),
              height: Math.round(height),
              fileName: file.name,
            },
          };

          // Add node to the canvas
          setNodes((nds) => [...nds, newNode]);
        };
        
        img.src = imageUrl;
      }
    };

    input.click();
  };

  const handleDeleteAll = () => {
    setNodes([]);
    setEdges([]);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      className={styles.modal}
    >
      <ModalHeader className={styles.modalHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>編輯倉儲空間</span>
        </div>
      </ModalHeader>

      <div className={styles.content}>
        <ReactFlowProvider>
          <Breadcrumb warehouseIds={['10001', '10001A']} />
          <Toolbar
            onUpload={handleUpload}
            onDeleteAll={handleDeleteAll}
            onSave={handleSave}
          />

          <ReactFlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
          />
        </ReactFlowProvider>
      </div>
    </Modal>
  );
};

export default WmsMapModal;
