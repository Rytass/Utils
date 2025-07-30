import { useState, useCallback, useEffect, useRef } from 'react';
import { useReactFlow, useUpdateNodeInternals } from '@xyflow/react';
import { EditMode } from '../../typings';

interface UseTextEditingProps {
  id: string;
  label: string;
  editMode: EditMode;
  isEditable: boolean;
}

export const useTextEditing = ({ id, label, editMode, isEditable }: UseTextEditingProps) => {
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState(label);

  // Sync state with node data changes
  useEffect(() => {
    if (!isEditing) {
      setEditingText(label);
    }
  }, [label, isEditing]);

  const updateNodeData = useCallback((updates: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
    updateNodeInternals(id);
  }, [id, setNodes, updateNodeInternals]);

  // Handle double click to start editing
  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (isEditable) {
      setIsEditing(true);
      setEditingText(label);
    }
  }, [isEditable, label]);

  // Handle saving the edited text
  const handleSaveText = useCallback(() => {
    setIsEditing(false);
    updateNodeData({ label: editingText });
  }, [editingText, updateNodeData]);

  // Handle input key events
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSaveText();
    } else if (event.key === 'Escape') {
      setIsEditing(false);
      setEditingText(label);
    }
  }, [handleSaveText, label]);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle clicking outside to save
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditing && inputRef.current && !inputRef.current.contains(event.target as Node)) {
        handleSaveText();
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isEditing, handleSaveText]);

  return {
    isEditing,
    editingText,
    inputRef,
    setEditingText,
    handleDoubleClick,
    handleKeyDown,
    updateNodeData,
  };
};