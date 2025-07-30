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
      const target = event.target as Node;
      const menuElement = menuRef.current;
      
      if (menuElement) {
        const isInsideMenu = menuElement.contains(target);
        if (!isInsideMenu) {
          onClose();
        }
      } else {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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

  if (!visible) return null;

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