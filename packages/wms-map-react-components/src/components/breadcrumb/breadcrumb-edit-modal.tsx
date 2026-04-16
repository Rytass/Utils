import React, { FC, useState, useEffect } from 'react';
import { Modal } from '@mezzanine-ui/react';
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

  const handleConfirm = (): void => {
    const formData = methods.getValues();
    const newValue = formData.editingValue?.trim() || editingValue?.trim();

    onConfirm(newValue);
    onClose();
  };

  const handleCancel = (): void => {
    setEditingValue(warehouseId); // 重置為原始值
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      modalType="standard"
      title="修改當前區域名稱"
      titleAlign="left"
      statusTypeIconLayout="horizontal"
      cancelText="取消"
      confirmText="確認"
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      cancelButtonProps={{
        type: 'button',
        size: 'main',
        variant: 'base-secondary',
      }}
      confirmButtonProps={{
        type: 'button',
        size: 'main',
        variant: 'base-primary',
      }}
      showStatusTypeIcon={false}
      showDismissButton
      showModalFooter
      showModalHeader
    >
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
    </Modal>
  );
};

export default BreadcrumbEditModal;
