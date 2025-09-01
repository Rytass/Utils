import React, { useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { EditMode } from '../typings';

interface UseContextMenuProps {
  id: string;
  editMode: EditMode;
  isEditable: boolean;
  nodeType?: 'rectangleNode' | 'pathNode' | 'imageNode';
}

interface ArrangeStates {
  canBringToFront: boolean;
  canBringForward: boolean;
  canSendBackward: boolean;
  canSendToBack: boolean;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

interface UseContextMenuReturn {
  contextMenu: ContextMenuState;
  handleContextMenu: (event: React.MouseEvent) => void;
  handleCloseContextMenu: () => void;
  handleDelete: () => void;
  arrangeActions: {
    onBringToFront: () => void;
    onBringForward: () => void;
    onSendBackward: () => void;
    onSendToBack: () => void;
  };
  arrangeStates: ArrangeStates;
  getNodes: () => any[];
  setNodes: (nodes: any[] | ((nodes: any[]) => any[])) => void;
}

export const useContextMenu = ({
  id,
  editMode,
  isEditable,
  nodeType,
}: UseContextMenuProps): UseContextMenuReturn => {
  const { setNodes, getNodes } = useReactFlow();

  // Calculate arrange states based on current node position
  const getArrangeStates = useCallback((): ArrangeStates => {
    const nodes = getNodes();
    const currentNode = nodes.find((node) => node.id === id);

    if (!currentNode) {
      return {
        canBringToFront: false,
        canBringForward: false,
        canSendBackward: false,
        canSendToBack: false,
      };
    }

    const currentZ = currentNode.zIndex || 0;
    const allZIndexes = nodes.map((n) => n.zIndex || 0).sort((a, b) => a - b);
    const maxZ = Math.max(...allZIndexes);
    const minZ = Math.min(...allZIndexes);

    // Check if there are nodes above (higher zIndex)
    const nodesAbove = nodes.filter((n) => (n.zIndex || 0) > currentZ);
    const nodesBelow = nodes.filter((n) => (n.zIndex || 0) < currentZ);

    return {
      canBringToFront: currentZ < maxZ, // Can bring to front if not already at max
      canBringForward: nodesAbove.length > 0, // Can bring forward if there are nodes above
      canSendBackward: nodesBelow.length > 0, // Can send backward if there are nodes below
      canSendToBack: currentZ > minZ, // Can send to back if not already at min
    };
  }, [id, getNodes]);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
  });

  // Handle right click for context menu
  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      // For image nodes, show context menu in BACKGROUND mode
      // For rectangle/path nodes, show context menu in LAYER mode
      const shouldShowMenu =
        (nodeType === 'imageNode' && editMode === EditMode.BACKGROUND) ||
        ((nodeType === 'rectangleNode' || nodeType === 'pathNode') &&
          editMode === EditMode.LAYER &&
          isEditable);

      if (!shouldShowMenu) return;

      event.preventDefault();
      event.stopPropagation();

      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [isEditable, editMode, nodeType],
  );

  // Handle context menu actions
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
    handleCloseContextMenu();
  }, [id, setNodes, handleCloseContextMenu]);

  // Arrange functionality
  const handleBringToFront = useCallback(() => {
    console.log('Bringing to front:', id);
    setNodes((nodes) => {
      console.log(
        'Current nodes:',
        nodes.map((n) => n.id),
      );

      const nodeToMove = nodes.find((node) => node.id === id);

      if (!nodeToMove) {
        console.log('Node not found');

        return nodes;
      }

      const otherNodes = nodes.filter((node) => node.id !== id);
      // Calculate highest zIndex
      const maxZIndex = Math.max(...nodes.map((n) => n.zIndex || 0), 0);

      const updatedNode = {
        ...nodeToMove,
        zIndex: maxZIndex + 1,
      };

      const newNodes = [...otherNodes, updatedNode]; // Move to end (front) with higher zIndex

      console.log(
        'New nodes order:',
        newNodes.map((n) => `${n.id}(z:${n.zIndex || 0})`),
      );

      return newNodes;
    });

    handleCloseContextMenu();
  }, [id, setNodes, handleCloseContextMenu]);

  const handleBringForward = useCallback(() => {
    console.log('Bringing forward:', id);
    setNodes((nodes) => {
      const currentNode = nodes.find((node) => node.id === id);

      if (!currentNode) {
        console.log('Node not found');

        return nodes;
      }

      // Find the node immediately in front (higher zIndex)
      const currentZ = currentNode.zIndex || 0;
      const nodesAbove = nodes.filter((n) => (n.zIndex || 0) > currentZ);

      if (nodesAbove.length === 0) {
        console.log('Already at front');

        return nodes;
      }

      // Find the node with the lowest zIndex above current node
      const nextNode = nodesAbove.reduce((min, node) =>
        (node.zIndex || 0) < (min.zIndex || 0) ? node : min,
      );

      // Swap zIndex values
      return nodes.map((node) => {
        if (node.id === id) {
          return { ...node, zIndex: nextNode.zIndex };
        } else if (node.id === nextNode.id) {
          return { ...node, zIndex: currentZ };
        }

        return node;
      });
    });

    handleCloseContextMenu();
  }, [id, setNodes, handleCloseContextMenu]);

  const handleSendBackward = useCallback(() => {
    console.log('Sending backward:', id);
    setNodes((nodes) => {
      const currentNode = nodes.find((node) => node.id === id);

      if (!currentNode) {
        console.log('Node not found');

        return nodes;
      }

      // Find the node immediately behind (lower zIndex)
      const currentZ = currentNode.zIndex || 0;
      const nodesBelow = nodes.filter((n) => (n.zIndex || 0) < currentZ);

      if (nodesBelow.length === 0) {
        console.log('Already at back');

        return nodes;
      }

      // Find the node with the highest zIndex below current node
      const prevNode = nodesBelow.reduce((max, node) =>
        (node.zIndex || 0) > (max.zIndex || 0) ? node : max,
      );

      // Swap zIndex values
      return nodes.map((node) => {
        if (node.id === id) {
          return { ...node, zIndex: prevNode.zIndex };
        } else if (node.id === prevNode.id) {
          return { ...node, zIndex: currentZ };
        }

        return node;
      });
    });

    handleCloseContextMenu();
  }, [id, setNodes, handleCloseContextMenu]);

  const handleSendToBack = useCallback(() => {
    console.log('Sending to back:', id);
    setNodes((nodes) => {
      const nodeToMove = nodes.find((node) => node.id === id);

      if (!nodeToMove) {
        console.log('Node not found');

        return nodes;
      }

      const otherNodes = nodes.filter((node) => node.id !== id);
      // Calculate lowest zIndex
      const minZIndex = Math.min(...nodes.map((n) => n.zIndex || 0), 0);

      const updatedNode = {
        ...nodeToMove,
        zIndex: minZIndex - 1,
      };

      const newNodes = [updatedNode, ...otherNodes]; // Move to beginning (back) with lower zIndex

      console.log(
        'New nodes order:',
        newNodes.map((n) => `${n.id}(z:${n.zIndex || 0})`),
      );

      return newNodes;
    });

    handleCloseContextMenu();
  }, [id, setNodes, handleCloseContextMenu]);

  return {
    contextMenu,
    handleContextMenu,
    handleCloseContextMenu,
    handleDelete,
    arrangeActions: {
      onBringToFront: handleBringToFront,
      onBringForward: handleBringForward,
      onSendBackward: handleSendBackward,
      onSendToBack: handleSendToBack,
    },
    arrangeStates: getArrangeStates(),
    getNodes,
    setNodes,
  };
};
