import React, { FC, useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@mezzanine-ui/react';
import styles from './breadcrumb-edit-modal.module.scss';
import { useForm } from 'react-hook-form';

interface BreadcrumbEditModalProps {
  open: boolean;
  warehouseId: string;
  onClose: () => void;
  onConfirm: (newName: string) => void;
}

const BreadcrumbEditModal: FC<BreadcrumbEditModalProps> = ({ open, warehouseId, onClose, onConfirm }) => {
  const [editingValue, setEditingValue] = useState(warehouseId);

  const methods = useForm({
    mode: 'onChange',
    defaultValues: {
      editingValue: warehouseId,
    },
  });

  // 當 modal 開啟時更新編輯值
  useEffect(() => {
    if (open) {
      setEditingValue(warehouseId);
      methods.reset({ editingValue: warehouseId });
    }
  }, [open, warehouseId, methods]);

  const handleConfirm = () => {
    const formData = methods.getValues();
    const newValue = formData.editingValue?.trim() || editingValue?.trim();

    onConfirm(newValue);
    onClose();
  };

  const handleCancel = () => {
    setEditingValue(warehouseId); // 重置為原始值
    onClose();
  };

  return (
    <Modal open={open} onClose={handleCancel}>
      <ModalHeader>修改當前區域名稱</ModalHeader>
      <ModalBody>
        <div className={styles.modalContent}>
          <label className={styles.fieldLabel}>名稱</label>
          <input
            {...methods.register('editingValue', { required: true })}
            type="text"
            placeholder="請輸入區域名稱"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
        </div>
      </ModalBody>
      <ModalFooter className={styles.modalFooter}>
        <Button size="large" variant="outlined" onClick={handleCancel}>
          取消
        </Button>
        <Button size="large" variant="contained" color="primary" onClick={handleConfirm}>
          確認
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default BreadcrumbEditModal;
