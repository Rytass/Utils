import React, { FC, useState } from 'react';
import styles from './breadcrumb.module.scss';

interface BreadcrumbProps {
  warehouseIds: string[];
  onWarehouseClick?: (warehouseId: string, index: number) => void;
}

const Breadcrumb: FC<BreadcrumbProps> = ({ warehouseIds, onWarehouseClick }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  // 當超過3個項目時，需要收合顯示
  const shouldCollapse = warehouseIds.length > 3;

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
        
        <div 
          className={styles.ellipsisContainer}
          onMouseEnter={() => setShowDropdown(true)}
          onMouseLeave={() => setShowDropdown(false)}
        >
          <span className={styles.ellipsis}>...</span>
          
          {showDropdown && hiddenItems.length > 0 && (
            <div className={styles.dropdown}>
              {hiddenItems.map((id, index) => (
                <div 
                  key={index} 
                  className={styles.dropdownItem}
                  onClick={() => handleItemClick(id, index + 1)}
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
    <div className={styles.breadcrumbSection}>
      <div className={styles.warehouseIdSection}>
        {shouldCollapse ? renderCollapsedBreadcrumb() : renderFullBreadcrumb()}
      </div>
    </div>
  );
};

export default Breadcrumb;