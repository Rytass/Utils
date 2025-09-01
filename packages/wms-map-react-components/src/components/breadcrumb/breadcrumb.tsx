import React, { FC, useState, useEffect, useRef } from 'react';
import BreadcrumbEditModal from './breadcrumb-edit-modal';
import styles from './breadcrumb.module.scss';

interface BreadcrumbProps {
  warehouseIds: string[];
  onWarehouseClick?: (warehouseId: string, index: number) => void;
  onWarehouseNameEdit?: (
    warehouseId: string,
    newName: string,
    index: number,
  ) => void;
}

const Breadcrumb: FC<BreadcrumbProps> = ({
  warehouseIds,
  onWarehouseClick,
  onWarehouseNameEdit,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 當超過3個項目時，需要收合顯示
  const shouldCollapse = warehouseIds.length > 3;

  // 點擊外部關閉 dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleEditClick = () => {
    // 預設編輯最後一個項目
    const lastIndex = warehouseIds.length - 1;

    setEditingIndex(lastIndex);
    setShowEditModal(true);
  };

  const handleEditConfirm = (newName: string) => {
    if (editingIndex >= 0 && onWarehouseNameEdit) {
      onWarehouseNameEdit(warehouseIds[editingIndex], newName, editingIndex);
    }

    setEditingIndex(-1);
  };

  const handleEditCancel = () => {
    setShowEditModal(false);
    setEditingIndex(-1);
  };

  const renderCollapsedBreadcrumb = () => {
    const first = warehouseIds[0];
    const secondLast = warehouseIds[warehouseIds.length - 2];
    const last = warehouseIds[warehouseIds.length - 1];
    const hiddenItems = warehouseIds.slice(1, warehouseIds.length - 2);

    const handleItemClick = (warehouseId: string, index: number) => {
      onWarehouseClick?.(warehouseId, index);
    };

    return (
      <>
        <span
          className={`${styles.warehouseIdText} ${styles.clickable}`}
          onClick={() => handleItemClick(first, 0)}
        >
          {first}
        </span>
        <span className={styles.separator}>/</span>

        <div className={styles.ellipsisContainer} ref={dropdownRef}>
          <span
            className={styles.ellipsis}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            ...
          </span>

          {showDropdown && hiddenItems.length > 0 && (
            <div className={styles.dropdown}>
              {hiddenItems.map((id, index) => (
                <div
                  key={index}
                  className={styles.dropdownItem}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleItemClick(id, index + 1);
                    setShowDropdown(false); // 點擊後隱藏 dropdown
                  }}
                >
                  {id}
                </div>
              ))}
            </div>
          )}
        </div>

        <span className={styles.separator}>/</span>
        <span
          className={`${styles.warehouseIdText} ${styles.clickable}`}
          onClick={() => handleItemClick(secondLast, warehouseIds.length - 2)}
        >
          {secondLast}
        </span>
        <span className={styles.separator}>/</span>
        <span
          className={`${styles.warehouseIdText} ${styles.lastItem} ${styles.clickable}`}
          onClick={() => handleItemClick(last, warehouseIds.length - 1)}
        >
          {last}
        </span>
      </>
    );
  };

  const renderFullBreadcrumb = () => {
    const handleItemClick = (warehouseId: string, index: number) => {
      onWarehouseClick?.(warehouseId, index);
    };

    return warehouseIds.map((id, index) => (
      <React.Fragment key={index}>
        <span
          className={`${styles.warehouseIdText} ${styles.clickable} ${
            index === warehouseIds.length - 1 ? styles.lastItem : ''
          }`}
          onClick={() => handleItemClick(id, index)}
        >
          {id}
        </span>
        {index < warehouseIds.length - 1 && (
          <span className={styles.separator}>/</span>
        )}
      </React.Fragment>
    ));
  };

  return (
    <>
      <div className={styles.breadcrumbSection}>
        <div className={styles.warehouseIdSection}>
          {shouldCollapse
            ? renderCollapsedBreadcrumb()
            : renderFullBreadcrumb()}
          <button
            className={styles.editButton}
            onClick={handleEditClick}
            title="編輯當前區域名稱"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M11.7803 2.21967C12.0732 1.92678 12.5481 1.92678 12.841 2.21967L13.7803 3.15901C14.0732 3.45191 14.0732 3.92678 13.7803 4.21967L5.11364 12.8863L2.66697 13.3333L3.11364 10.8863L11.7803 2.21967Z"
                stroke="currentColor"
                strokeWidth="1.33"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 編輯 Modal */}
      <BreadcrumbEditModal
        open={showEditModal}
        warehouseId={editingIndex >= 0 ? warehouseIds[editingIndex] : ''}
        onClose={handleEditCancel}
        onConfirm={handleEditConfirm}
      />
    </>
  );
};

export default Breadcrumb;
