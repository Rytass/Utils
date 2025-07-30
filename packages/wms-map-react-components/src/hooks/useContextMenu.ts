import { useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { EditMode } from '../../typings';

interface UseContextMenuProps {
  id: string;
  editMode: EditMode;
  isEditable: boolean;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

export const useContextMenu = ({ id, editMode, isEditable }: UseContextMenuProps) => {
  const { setNodes, getNodes } = useReactFlow();
  
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
  });

  // Handle right click for context menu
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    if (!isEditable) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
    });
  }, [isEditable]);

  // Handle context menu actions
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
    handleCloseContextMenu();
  }, [id, setNodes, handleCloseContextMenu]);

  const handleArrange = useCallback(() => {
    // TODO: Implement arrange functionality
    console.log('Arrange not implemented yet');
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  return {
    contextMenu,
    handleContextMenu,
    handleCloseContextMenu,
    handleDelete,
    handleArrange,
    getNodes,
    setNodes,
  };
};