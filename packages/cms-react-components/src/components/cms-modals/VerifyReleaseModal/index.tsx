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
  title?: string;
  defaultRadioValue?: VerifyReleaseModalRadio;
}

const VerifyReleaseModal = ({
  title = '審核通過',
  defaultRadioValue = VerifyReleaseModalRadio.Now,
}: VerifyReleaseModalProps): ReactNode => {
  const [currentRadioValue, setCurrentRadioValue] =
    useState<VerifyReleaseModalRadio>(defaultRadioValue);

  const [releaseAt, setReleaseAt] = useState<string>('');

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

  return (
    <>
      <ModalHeader>{title}</ModalHeader>
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
              value={releaseAt}
              onChange={(date) => {
                setReleaseAt(date ?? '');
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
          style: {
            minWidth: 'unset',
          },
        }}
        onCancel={closeModal}
        // onConfirm={onConfirm}
      />
    </>
  );
};

export { VerifyReleaseModal };
