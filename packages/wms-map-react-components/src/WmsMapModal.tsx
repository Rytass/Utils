import React, { FC, useCallback, useState } from 'react';
import { Modal, ModalHeader } from '@mezzanine-ui/react';
import {
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { EditMode, DrawingMode } from '../typings';
import { DEFAULT_RECTANGLE_COLOR, DEFAULT_RECTANGLE_LABEL, DEFAULT_PATH_LABEL, MIN_RECTANGLE_SIZE } from './constants';
import { calculateImageSize, calculateStaggeredPosition } from './utils/nodeUtils';
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
  const [editMode, setEditMode] = useState<EditMode>(EditMode.BACKGROUND);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(DrawingMode.NONE);
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_RECTANGLE_COLOR);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);

  const handleEditModeChange = useCallback((mode: EditMode) => {
    setEditMode(mode);
    setDrawingMode(DrawingMode.NONE); // Reset drawing mode when switching edit modes

    // When switching modes, deselect all nodes
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        selected: false,
      }))
    );
  }, [setNodes]);

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
    input.multiple = true; // Enable multiple file selection
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);

      if (files.length > 0) {
        // Process each file
        files.forEach((file: File, index: number) => {
          // Check file type
          if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
            alert(`檔案 ${file.name} 不是有效的圖片格式，請選擇 PNG 或 JPG 格式`);

            return;
          }

          // Create file URL
          const imageUrl = URL.createObjectURL(file);

          // Create image element to get dimensions
          const img = new Image();

          img.onload = () => {
            // Calculate appropriate size using utility function
            const { width, height } = calculateImageSize(img.width, img.height);

            // Calculate staggered position using utility function
            const position = calculateStaggeredPosition(index);

            // Create new image node
            const newNode = {
              id: `image-${Date.now()}-${index}`,
              type: 'imageNode',
              position,
              data: {
                imageUrl,
                width,
                height,
                originalWidth: img.width,
                originalHeight: img.height,
                fileName: file.name,
              },
            };

            // Add node to the canvas with a slight delay to ensure proper stacking
            setTimeout(() => {
              setNodes((nds) => {
                // Calculate next zIndex
                const maxZIndex = Math.max(...nds.map(n => n.zIndex || 0), 0);
                const nodeWithZIndex = { ...newNode, zIndex: maxZIndex + 1 };

                return [...nds, nodeWithZIndex];
              });
            }, index * 100); // 100ms delay between each image
          };

          img.src = imageUrl;
        });
      }
    };

    input.click();
  };

  const handleDeleteAll = useCallback(() => {
    if (editMode === EditMode.BACKGROUND) {
      // Delete all image nodes (background images)
      setNodes((nds) => nds.filter((node) => node.type !== 'imageNode'));
    } else if (editMode === EditMode.LAYER) {
      // Delete all layer nodes (rectangles and paths)
      setNodes((nds) => nds.filter((node) => node.type !== 'rectangleNode' && node.type !== 'pathNode'));
      // Also clear edges if deleting layer elements
      setEdges([]);
    }
  }, [editMode, setNodes, setEdges]);

  const handleToggleRectangleTool = useCallback(() => {
    if (editMode !== EditMode.LAYER) return;

    setDrawingMode(prev =>
      prev === DrawingMode.RECTANGLE ? DrawingMode.NONE : DrawingMode.RECTANGLE
    );
  }, [editMode]);

  const handleTogglePenTool = useCallback(() => {
    if (editMode !== EditMode.LAYER) return;

    setDrawingMode(prev =>
      prev === DrawingMode.PEN ? DrawingMode.NONE : DrawingMode.PEN
    );
  }, [editMode]);

  const handleCreateRectangle = useCallback((startX: number, startY: number, endX: number, endY: number) => {
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    if (width < MIN_RECTANGLE_SIZE || height < MIN_RECTANGLE_SIZE) return; // Minimum size check

    setNodes((nds) => {
      // Calculate next zIndex
      const maxZIndex = Math.max(...nds.map(n => n.zIndex || 0), 0);

      const newRectangle = {
        id: `rectangle-${Date.now()}`,
        type: 'rectangleNode',
        position: {
          x: Math.min(startX, endX),
          y: Math.min(startY, endY),
        },
        zIndex: maxZIndex + 1,
        data: {
          width,
          height,
          color: selectedColor,
          label: DEFAULT_RECTANGLE_LABEL,
        },
      };

      return [...nds, newRectangle];
    });
    // Keep drawing mode active for continuous drawing
  }, [setNodes, selectedColor]);

  const handleCreatePath = useCallback((points: { x: number; y: number }[]) => {
    if (points.length < 2) return; // Need at least 2 points for a path

    setNodes((nds) => {
      // Calculate next zIndex
      const maxZIndex = Math.max(...nds.map(n => n.zIndex || 0), 0);

      const newPath = {
        id: `path-${Date.now()}`,
        type: 'pathNode',
        position: {
          x: Math.min(...points.map(p => p.x)),
          y: Math.min(...points.map(p => p.y)),
        },
        zIndex: maxZIndex + 1,
        data: {
          points,
          color: selectedColor,
          strokeWidth: 2,
          label: DEFAULT_PATH_LABEL,
        },
      };

      return [...nds, newPath];
    });
    // Keep drawing mode active for continuous drawing
  }, [setNodes, selectedColor]);

  // Placeholder undo/redo functions - can be implemented with proper state management later
  const handleUndo = useCallback(() => {
    console.log('Undo action');
    // TODO: Implement undo functionality
  }, []);

  const handleRedo = useCallback(() => {
    console.log('Redo action');
    // TODO: Implement redo functionality
  }, []);

  const handleSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodes(params.nodes);

    // If a single colorable node is selected, update the color picker to show its color
    if (params.nodes.length === 1 && (params.nodes[0].type === 'rectangleNode' || params.nodes[0].type === 'pathNode')) {
      const selectedNode = params.nodes[0];
      const nodeColor = selectedNode.data?.color;

      if (nodeColor && typeof nodeColor === 'string') {
        setSelectedColor(nodeColor);
      }
    }
  }, []);

  const handleColorChange = useCallback((color: string) => {
    setSelectedColor(color);

    // Update color of selected colorable nodes (rectangles and paths)
    const selectedColorableNodes = selectedNodes.filter(node =>
      node.type === 'rectangleNode' || node.type === 'pathNode'
    );

    if (selectedColorableNodes.length > 0) {
      setNodes((nds) =>
        nds.map((node) => {
          if (selectedColorableNodes.some(selected => selected.id === node.id)) {
            return { ...node, data: { ...node.data, color } };
          }

          return node;
        })
      );
    }
  }, [selectedNodes, setNodes]);

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
          <Breadcrumb warehouseIds={['10001', '10001A', '10002', '100002B', '100003', '100003B']} />
          <Toolbar
            onUpload={handleUpload}
            onDeleteAll={handleDeleteAll}
            onSave={handleSave}
            editMode={editMode}
            drawingMode={drawingMode}
            onEditModeChange={handleEditModeChange}
            onToggleRectangleTool={handleToggleRectangleTool}
            onTogglePenTool={handleTogglePenTool}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={false}
            canRedo={false}
            onColorChange={handleColorChange}
            selectedColor={selectedColor}
          />

          <ReactFlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            editMode={editMode}
            drawingMode={drawingMode}
            onCreateRectangle={handleCreateRectangle}
            onCreatePath={handleCreatePath}
            onSelectionChange={handleSelectionChange}
          />
        </ReactFlowProvider>
      </div>
    </Modal>
  );
};

export default WmsMapModal;
