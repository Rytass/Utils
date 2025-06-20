import React, { ReactNode } from 'react';
import {
  ModalHeader,
  ModalBody as MznModalBody,
  ModalActions,
  Typography,
  Button,
} from '@mezzanine-ui/react';
import { useModal } from '../../modal/useModal';
import classes from './index.module.scss';

export interface LogsModalProps {}

const LogsModal = (): ReactNode => {
  const { closeModal } = useModal();

  return (
    <>
      <ModalHeader showSeverityIcon={false}>版本資訊</ModalHeader>
      <MznModalBody className={classes.modalBody}>
        <div className={classes.block}>
          <div className={classes.timeLineWrapper}>
            <div className={classes.topLine} />
            <div className={classes.dot} />
            <div className={classes.bottomLine} />
          </div>
          <div className={classes.contentWrapper}>
            <div className={classes.stageWrapper}>
              <Typography variant="h5" color="text-primary">
                待審核
              </Typography>
              <Button
                type="button"
                variant="text"
                color="secondary"
                size="small"
              >
                Ver. 4
              </Button>
            </div>
            <div className={classes.list}>
              <div className={classes.option}>
                <Typography variant="h6" color="text-secondary">
                  送審時間
                </Typography>
                <Typography variant="body2" color="text-primary">
                  2025-05-21．18:00
                </Typography>
              </div>
              <div className={classes.option}>
                <Typography variant="h6" color="text-secondary">
                  送審人員
                </Typography>
                <Typography variant="body2" color="text-primary">
                  staff@email.com
                </Typography>
              </div>
            </div>
          </div>
        </div>
      </MznModalBody>
      <ModalActions
        cancelText="取消"
        confirmText="關閉"
        cancelButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'outlined',
          danger: false,
          style: {
            display: 'none',
          },
        }}
        confirmButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'contained',
          danger: false,
        }}
        onCancel={closeModal}
        onConfirm={closeModal}
      />
    </>
  );
};

export { LogsModal };
