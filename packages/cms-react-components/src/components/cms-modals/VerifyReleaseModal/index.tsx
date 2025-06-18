import React, { ReactNode, useState, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  ModalHeader,
  ModalBody as MznModalBody,
  ModalActions,
  RadioGroup,
  Radio,
  DateTimePicker,
} from '@mezzanine-ui/react';
import { useModal } from '../../modal/useModal';
import classes from './index.module.scss';

export enum VerifyReleaseModalRadio {
  Now = 'Now',
  Schedule = 'Schedule',
  Approve = 'Approve',
  Reject = 'Reject',
}

export interface VerifyReleaseModalProps {
  title: string;
  showSeverityIcon?: boolean;
  defaultRadioValue?: VerifyReleaseModalRadio;
  onRelease: (releasedAt: string) => Promise<void>;
  onApprove: () => Promise<void>;
}

const VerifyReleaseModal = ({
  title,
  showSeverityIcon = false,
  defaultRadioValue = VerifyReleaseModalRadio.Now,
  onRelease,
  onApprove,
}: VerifyReleaseModalProps): ReactNode => {
  const [currentRadioValue, setCurrentRadioValue] =
    useState<VerifyReleaseModalRadio>(defaultRadioValue);

  const [releasedAt, setReleasedAt] = useState<string>('');

  const { closeModal } = useModal();

  const confirmText = useMemo(() => {
    switch (currentRadioValue) {
      case VerifyReleaseModalRadio.Now:
        return '立即發佈';

      case VerifyReleaseModalRadio.Schedule:
        return '預約發佈';

      case VerifyReleaseModalRadio.Approve:
        return '即刻通過';

      default:
        return '確認';
    }
  }, [currentRadioValue]);

  const disabled = useMemo(() => {
    switch (currentRadioValue) {
      case VerifyReleaseModalRadio.Schedule:
        return !releasedAt;

      default:
        return false;
    }
  }, [currentRadioValue, releasedAt]);

  const onConfirm = useMemo(() => {
    switch (currentRadioValue) {
      case VerifyReleaseModalRadio.Now:
        return async () => {
          await onRelease(dayjs(Date.now()).toISOString());
          closeModal();
        };

      case VerifyReleaseModalRadio.Schedule:
        return async () => {
          await onRelease(dayjs(releasedAt).toISOString());
          closeModal();
        };

      case VerifyReleaseModalRadio.Approve:
        return async () => {
          await onApprove();
          closeModal();
        };

      default:
        return () => {
          closeModal();
        };
    }
  }, [currentRadioValue, onRelease, releasedAt, onApprove, closeModal]);

  return (
    <>
      <ModalHeader showSeverityIcon={showSeverityIcon}>{title}</ModalHeader>
      <MznModalBody className={classes.modalBody}>
        <RadioGroup
          size="large"
          value={currentRadioValue}
          className={classes.radioGroup}
          onChange={(e) => {
            setCurrentRadioValue(e.target.value as VerifyReleaseModalRadio);
          }}
        >
          <Radio value={VerifyReleaseModalRadio.Now}>
            立即發佈文章至最新版本
          </Radio>
          <div className={classes.radioWrapper}>
            <Radio value={VerifyReleaseModalRadio.Schedule}>
              預約發佈文章至最新版本
            </Radio>
            <DateTimePicker
              placeholder="yyyy-mm-dd hh:mm:ss"
              size="large"
              value={releasedAt}
              onChange={(date) => {
                setReleasedAt(date ?? '');
              }}
              isDateDisabled={(date) => dayjs(date).isBefore(dayjs(), 'day')}
              disabled={currentRadioValue !== VerifyReleaseModalRadio.Schedule}
            />
          </div>
          <div className={classes.divider} />
          <Radio value={VerifyReleaseModalRadio.Approve}>
            即刻通過審查 （文章會將移至可發佈）
          </Radio>
        </RadioGroup>
      </MznModalBody>
      <ModalActions
        cancelText="取消"
        confirmText={confirmText}
        cancelButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'outlined',
          style: {
            minWidth: 'unset',
          },
        }}
        confirmButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'contained',
          disabled,
          style: {
            minWidth: 'unset',
          },
        }}
        onCancel={closeModal}
        onConfirm={onConfirm}
      />
    </>
  );
};

export { VerifyReleaseModal };
