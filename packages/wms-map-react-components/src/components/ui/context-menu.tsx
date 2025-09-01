import React, { FC, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './context-menu.module.scss';

interface ArrangeActions {
  onBringToFront: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onSendToBack: () => void;
}

interface ArrangeStates {
  canBringToFront: boolean;
  canBringForward: boolean;
  canSendBackward: boolean;
  canSendToBack: boolean;
}

interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onCopyPaste: () => void;
  onDelete: () => void;
  arrangeActions: ArrangeActions;
  arrangeStates: ArrangeStates;
}

const ContextMenu: FC<ContextMenuProps> = ({
  visible,
  x,
  y,
  onClose,
  onCopyPaste,
  onDelete,
  arrangeActions,
  arrangeStates,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showArrangeSubmenu, setShowArrangeSubmenu] = useState(false);

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
        <div className={styles.menuItemContent}>
          <span className={styles.menuItemText}>複製並貼上</span>
          <span className={styles.menuItemShortcut}>⌘D</span>
        </div>
      </div>
      <div className={styles.menuItem} onClick={onDelete}>
        <div className={styles.menuItemContent}>
          <span className={styles.menuItemText}>刪除</span>
          <span className={styles.menuItemShortcut}>Del</span>
        </div>
      </div>
      <div
        className={`${styles.menuItem} ${styles.hasSubmenu}`}
        onMouseEnter={() => setShowArrangeSubmenu(true)}
        onMouseLeave={() => setShowArrangeSubmenu(false)}
      >
        排列順序
        <span className={styles.arrow}>▶</span>
        {/* Submenu */}
        {showArrangeSubmenu && (
          <div
            className={styles.submenu}
            style={{
              position: 'absolute',
              left: '100%',
              top: 0,
              zIndex: 10001,
            }}
            onMouseEnter={() => setShowArrangeSubmenu(true)}
            onMouseLeave={() => setShowArrangeSubmenu(false)}
          >
            <div
              className={`${styles.menuItem} ${!arrangeStates.canBringToFront ? styles.disabled : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (arrangeStates.canBringToFront) {
                  arrangeActions.onBringToFront();
                  onClose();
                }
              }}
            >
              移至最前
            </div>
            <div
              className={`${styles.menuItem} ${!arrangeStates.canBringForward ? styles.disabled : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (arrangeStates.canBringForward) {
                  arrangeActions.onBringForward();
                  onClose();
                }
              }}
            >
              置前
            </div>
            <div
              className={`${styles.menuItem} ${!arrangeStates.canSendBackward ? styles.disabled : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (arrangeStates.canSendBackward) {
                  arrangeActions.onSendBackward();
                  onClose();
                }
              }}
            >
              置後
            </div>
            <div
              className={`${styles.menuItem} ${!arrangeStates.canSendToBack ? styles.disabled : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (arrangeStates.canSendToBack) {
                  arrangeActions.onSendToBack();
                  onClose();
                }
              }}
            >
              移至最後
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render to document body to avoid z-index issues
  return createPortal(contextMenuElement, document.body);
};

export default ContextMenu;
