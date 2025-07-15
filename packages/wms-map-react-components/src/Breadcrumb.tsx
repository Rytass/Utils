import React, { FC } from 'react';
import styles from './breadcrumb.module.scss';

interface BreadcrumbProps {
  warehouseIds: string[];
}

const Breadcrumb: FC<BreadcrumbProps> = ({ warehouseIds }) => {
  return (
    <div className={styles.breadcrumbSection}>
      <div className={styles.warehouseIdSection}>
        {warehouseIds.map((id, index) => (
          <React.Fragment key={index}>
            <span className={styles.warehouseIdText}>{id}</span>
            {index < warehouseIds.length - 1 && (
              <span className={styles.separator}>/</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default Breadcrumb;