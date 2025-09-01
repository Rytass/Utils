import React, { FC } from 'react';
import { ModalHeader } from '@mezzanine-ui/react';
import styles from './wms-map-header.module.scss';

interface WMSMapHeaderProps {
  title?: string;
}

const WMSMapHeader: FC<WMSMapHeaderProps> = ({ title = '編輯倉儲空間' }) => {
  return (
    <ModalHeader className={styles.modalHeader}>
      <div className={styles.headerLeft}>
        <span className={styles.title}>{title}</span>
      </div>
    </ModalHeader>
  );
};

export default WMSMapHeader;
