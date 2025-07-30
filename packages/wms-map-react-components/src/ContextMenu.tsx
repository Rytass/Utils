import React, { FC, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './contextMenu.module.scss';

interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onCopyPaste: () => void;
  onDelete: () => void;
  onArrange: () => void;
}

const ContextMenu: FC<ContextMenuProps> = ({
  visible,
  x,
  y,
  onClose,
  onCopyPaste,
  onDelete,
  onArrange,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside to close menu
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event: MouseEvent) => {
      console.log('Click outside detected', event.target);
      const target = event.target as Node;
      const menuElement = menuRef.current;
      
      if (menuElement) {
        const isInsideMenu = menuElement.contains(target);
        console.log('Is click inside menu?', isInsideMenu);
        
        if (!isInsideMenu) {
          console.log('Closing context menu due to outside click');
          onClose();
        }
      } else {
        console.log('Menu ref not found, closing');
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      console.log('Key pressed:', event.key);
      if (event.key === 'Escape') {
        console.log('Closing context menu due to Escape key');
        onClose();
      }
    };

    // Add small delay to prevent immediate closing when the menu appears
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('click', handleClickOutside, true);
      document.addEventListener('keydown', handleKeyDown, true);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [visible, onClose]);

  if (!visible) {
    console.log('Context menu not visible');
    return null;
  }
  
  console.log('Context menu rendering at', x, y);

  // Adjust position to ensure menu stays within viewport
  const adjustedX = Math.min(x, window.innerWidth - 150); // 150 is approximate menu width
  const adjustedY = Math.min(y, window.innerHeight - 120); // 120 is approximate menu height

  const contextMenuElement = (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{
        position: 'fixed',
        left: Math.max(0, adjustedX),
        top: Math.max(0, adjustedY),
        zIndex: 10000,
      }}
    >
      <div className={styles.menuItem} onClick={onCopyPaste}>
        複製並貼上
      </div>
      <div className={styles.menuItem} onClick={onDelete}>
        刪除
      </div>
      <div className={styles.menuItem} onClick={onArrange}>
        排列順序
      </div>
    </div>
  );

  // Render to document body to avoid z-index issues
  return createPortal(contextMenuElement, document.body);
};

export default ContextMenu;