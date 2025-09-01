import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useReactFlow, useUpdateNodeInternals } from '@xyflow/react';

interface UseTextEditingProps {
  id: string;
  label: string;
  isEditable: boolean;
  onTextEditComplete?: (id: string, oldText: string, newText: string) => void;
}

interface UseTextEditingReturn {
  isEditing: boolean;
  editingText: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setEditingText: React.Dispatch<React.SetStateAction<string>>;
  handleDoubleClick: (event: React.MouseEvent) => void;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  handleBlur: () => void;
  updateNodeData: (updates: Record<string, unknown>) => void;
}

export const useTextEditing = ({
  id,
  label,
  isEditable,
  onTextEditComplete,
}: UseTextEditingProps): UseTextEditingReturn => {
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

  const updateNodeData = useCallback(
    (updates: Record<string, unknown>) => {
      console.log('📝 updateNodeData 調用 (會觸發 React Flow 資料變更):', {
        id,
        updates,
      });

      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, ...updates } }
            : node,
        ),
      );

      updateNodeInternals(id);
    },
    [id, setNodes, updateNodeInternals],
  );

  // Handle double click to start editing
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (isEditable) {
        setIsEditing(true);
        setEditingText(label);
      }
    },
    [isEditable, label],
  );

  // Handle saving the edited text
  const handleSaveText = useCallback(() => {
    // 只有在文字真的有變更時才進行更新
    if (label === editingText) {
      setIsEditing(false);

      return;
    }

    const oldText = label;
    const newText = editingText;

    console.log('💾 保存文字編輯 (手動觸發歷史記錄):', {
      id,
      oldText,
      newText,
    });

    setIsEditing(false);
    updateNodeData({ label: editingText });

    // 通知父組件文字編輯完成（這會觸發歷史記錄）
    if (onTextEditComplete) {
      // 延遲執行以確保 updateNodeData 完成
      setTimeout(() => {
        onTextEditComplete(id, oldText, newText);
      }, 10);
    }
  }, [editingText, updateNodeData, id, label, onTextEditComplete]);

  // Handle input key events
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleSaveText();
      } else if (event.key === 'Escape') {
        setIsEditing(false);
        setEditingText(label);
      }
    },
    [handleSaveText, label],
  );

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
      if (isEditing && inputRef.current) {
        const target = event.target as HTMLElement;

        // 檢查點擊是否在 input 元素外部
        if (!inputRef.current.contains(target)) {
          console.log('🖱️ 點擊外部區域，保存文字編輯:', { id, editingText });
          handleSaveText();
        }
      }
    };

    if (isEditing) {
      // 使用 'click' 事件而不是 'mousedown' 以確保更好的兼容性
      document.addEventListener('click', handleClickOutside, true);

      return () => {
        document.removeEventListener('click', handleClickOutside, true);
      };
    }
  }, [isEditing, handleSaveText, id, editingText]);

  // Handle input blur event (when input loses focus)
  const handleBlur = useCallback(() => {
    console.log('🔄 Input blur 事件，保存文字編輯:', { id, editingText });
    handleSaveText();
  }, [handleSaveText, id, editingText]);

  return {
    isEditing,
    editingText,
    inputRef,
    setEditingText,
    handleDoubleClick,
    handleKeyDown,
    handleBlur,
    updateNodeData,
  };
};
