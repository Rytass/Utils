import React, { FC, ReactNode } from 'react';
import { NodeProps } from '@xyflow/react';
import { EditMode } from '../../typings';
import { ACTIVE_OPACITY, RECTANGLE_INACTIVE_OPACITY } from '../constants';
import { useContextMenu } from '../hooks/useContextMenu';
import { useTextEditing } from '../hooks/useTextEditing';
import ContextMenu from '../ContextMenu';

interface BaseNodeProps extends NodeProps {
  editMode: EditMode;
  label: string;
  onCopyPaste: () => void;
  children: ReactNode;
  className?: string;
}

const BaseNode: FC<BaseNodeProps> = ({
  data,
  selected,
  id,
  editMode,
  label,
  onCopyPaste,
  children,
  className = '',
}) => {
  // Only editable in LAYER mode
  const isEditable = editMode === EditMode.LAYER;
  const opacity = editMode === EditMode.LAYER ? ACTIVE_OPACITY : RECTANGLE_INACTIVE_OPACITY;

  // Context menu functionality
  const {
    contextMenu,
    handleContextMenu,
    handleCloseContextMenu,
    handleDelete,
    arrangeActions,
  } = useContextMenu({ id, editMode, isEditable, nodeType: 'rectangleNode' });

  // Text editing functionality
  const {
    isEditing,
    editingText,
    inputRef,
    setEditingText,
    handleDoubleClick,
    handleKeyDown,
  } = useTextEditing({ id, label, editMode, isEditable });

  return (
    <div className={`${className} ${selected ? 'selected' : ''}`}>
      <div 
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{ opacity }}
      >
        {children}
        
        {/* Text editing overlay */}
        {isEditing && (
          <input
            ref={inputRef}
            type="text"
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              zIndex: 1000,
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '4px',
              fontSize: '12px',
            }}
          />
        )}
      </div>
      
      {/* Context Menu */}
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={handleCloseContextMenu}
        onCopyPaste={onCopyPaste}
        onDelete={handleDelete}
        arrangeActions={arrangeActions}
      />
    </div>
  );
};

export default BaseNode;