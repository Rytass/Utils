import React, { ReactNode, useState, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  ModalHeader,
  ModalBody as MznModalBody,
  ModalActions,
  Typography,
  RadioGroup,
  Radio,
  DateTimePicker,
} from '@mezzanine-ui/react';
import { useModal } from '../../modal/useModal';
import { Textarea } from '../../cms-fields/Textarea';
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
  withApprove?: boolean;
  withReject?: boolean;
  onRelease: (releasedAt: string) => Promise<void>;
  onApprove?: () => Promise<void>;
  onReject?: (reason: string) => Promise<void>;
}

const VerifyReleaseModal = ({
  title,
  showSeverityIcon = false,
  defaultRadioValue = VerifyReleaseModalRadio.Now,
  withApprove = false,
  withReject = false,
  onRelease,
  onApprove,
  onReject,
}: VerifyReleaseModalProps): ReactNode => {
  const [acting, setActing] = useState<boolean>(false);

  const [currentRadioValue, setCurrentRadioValue] = useState<VerifyReleaseModalRadio>(defaultRadioValue);

  const [releasedAt, setReleasedAt] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');

  const { closeModal } = useModal();

  const confirmText = useMemo(() => {
    switch (currentRadioValue) {
      case VerifyReleaseModalRadio.Now:
        return '立即發佈';

      case VerifyReleaseModalRadio.Schedule:
        return '預約發佈';

      case VerifyReleaseModalRadio.Approve:
        return '即刻通過';

      case VerifyReleaseModalRadio.Reject:
        return '不通過';

      default:
        return '確認';
    }
  }, [currentRadioValue]);

  const disabled = useMemo(() => {
    switch (currentRadioValue) {
      case VerifyReleaseModalRadio.Schedule:
        return !releasedAt || acting;

      case VerifyReleaseModalRadio.Reject:
        return !rejectReason || acting;

      default:
        return acting;
    }
  }, [currentRadioValue, rejectReason, releasedAt, acting]);

  const onConfirm = useMemo(() => {
    switch (currentRadioValue) {
      case VerifyReleaseModalRadio.Now:
        return async (): Promise<void> => {
          setActing(true);
          await onRelease(dayjs(Date.now()).toISOString());
          setActing(false);
          closeModal();
        };

      case VerifyReleaseModalRadio.Schedule:
        return async (): Promise<void> => {
          setActing(true);
          await onRelease(dayjs(releasedAt).toISOString());
          setActing(false);
          closeModal();
        };

      case VerifyReleaseModalRadio.Approve:
        return async (): Promise<void> => {
          setActing(true);
          await onApprove?.();
          setActing(false);
          closeModal();
        };

      case VerifyReleaseModalRadio.Reject:
        return async (): Promise<void> => {
          setActing(true);
          await onReject?.(rejectReason);
          setActing(false);
          closeModal();
        };

      default:
        return (): void => {
          closeModal();
        };
    }
  }, [currentRadioValue, onRelease, closeModal, releasedAt, onApprove, onReject, rejectReason]);

  return (
    <>
      <ModalHeader showSeverityIcon={showSeverityIcon}>{title}</ModalHeader>
      <MznModalBody className={classes.modalBody}>
        <RadioGroup
          size="large"
          value={currentRadioValue}
          className={classes.radioGroup}
          onChange={e => {
            setCurrentRadioValue(e.target.value as VerifyReleaseModalRadio);
          }}
        >
          <Radio value={VerifyReleaseModalRadio.Now}>立即發佈文章至最新版本</Radio>
          <div className={classes.radioWrapper}>
            <Radio value={VerifyReleaseModalRadio.Schedule}>預約發佈文章至最新版本</Radio>
            <DateTimePicker
              placeholder="yyyy-mm-dd hh:mm:ss"
              size="large"
              value={releasedAt}
              onChange={date => {
                setReleasedAt(date ?? '');
              }}
              isDateDisabled={date => dayjs(date).isBefore(dayjs(), 'day')}
              disabled={currentRadioValue !== VerifyReleaseModalRadio.Schedule}
            />
          </div>
          {(withApprove || withReject) && <div className={classes.divider} />}
          {withApprove && <Radio value={VerifyReleaseModalRadio.Approve}>即刻通過審查 （文章會將移至可發佈）</Radio>}
          {withReject && (
            <div className={classes.rejectWrapper}>
              <Radio value={VerifyReleaseModalRadio.Reject}>不通過 （文章會將移至草稿區）</Radio>
              {currentRadioValue === VerifyReleaseModalRadio.Reject && (
                <div className={classes.rejectField}>
                  <Typography variant="body1" color="text-primary">
                    當審核未通過時，內容將自動移至草稿區，需修改後重新送審。
                  </Typography>
                  <Textarea
                    label="不通過原因"
                    value={rejectReason}
                    onChange={value => {
                      setRejectReason(value);
                    }}
                    autoFocus
                    disabled={currentRadioValue !== VerifyReleaseModalRadio.Reject}
                  />
                </div>
              )}
            </div>
          )}
        </RadioGroup>
      </MznModalBody>
      <ModalActions
        cancelText="取消"
        confirmText={confirmText}
        cancelButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'outlined',
          danger: false,
        }}
        confirmButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'contained',
          disabled,
          loading: acting,
          danger: currentRadioValue === VerifyReleaseModalRadio.Reject,
        }}
        onCancel={closeModal}
        onConfirm={onConfirm}
      />
    </>
  );
};

export { VerifyReleaseModal };
