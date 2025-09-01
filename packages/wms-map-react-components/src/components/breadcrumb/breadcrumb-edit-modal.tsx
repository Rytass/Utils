import React, { FC, useState, useEffect } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@mezzanine-ui/react';
import styles from './breadcrumb-edit-modal.module.scss';
import {
  FormFieldsWrapper,
  InputField,
} from '@mezzanine-ui/react-hook-form-v2';
import { useForm } from 'react-hook-form';

interface BreadcrumbEditModalProps {
  open: boolean;
  warehouseId: string;
  onClose: () => void;
  onConfirm: (newName: string) => void;
}

const BreadcrumbEditModal: FC<BreadcrumbEditModalProps> = ({
  open,
  warehouseId,
  onClose,
  onConfirm,
}) => {
  const [editingValue, setEditingValue] = useState(warehouseId);

  const methods = useForm();

  // 當 modal 開啟時更新編輯值
  useEffect(() => {
    if (open) {
      setEditingValue(warehouseId);
    }
  }, [open, warehouseId]);

  const handleConfirm = () => {
    onConfirm(editingValue);
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
        <FormFieldsWrapper methods={methods}>
          <div className={styles.modalContent}>
            <label className={styles.fieldLabel}>名稱</label>
            <InputField
              registerName="editingValue"
              value={editingValue}
              placeholder="請輸入區域名稱"
              fullWidth
            />
          </div>
        </FormFieldsWrapper>
      </ModalBody>
      <ModalFooter className={styles.modalFooter}>
        <Button size="large" variant="outlined" onClick={handleCancel}>
          取消
        </Button>
        <Button
          size="large"
          variant="contained"
          color="primary"
          onClick={handleConfirm}
          disabled={!editingValue.trim()}
        >
          確認
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default BreadcrumbEditModal;
