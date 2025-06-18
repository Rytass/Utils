import React, { ReactNode, useMemo, useState } from 'react';
import { Button, cx } from '@mezzanine-ui/react';
import { FieldValues, useWatch } from 'react-hook-form';
import { StandardCMSFormActionsProps } from './typings';
import classes from './index.module.scss';

const FormActionsFooter = <T extends FieldValues>({
  actionsClassName,
  methods,
  disableLeaveButton,
  disableActionButton,
  disableSubmitButton,
  currentStage,
  userPermissions,
  actionsEvents,
}: StandardCMSFormActionsProps<T>): ReactNode => {
  const [acting, setActing] = useState<boolean>(false);

  const watchValues = useWatch<T>();

  const values = useMemo(() => watchValues as T, [watchValues]);

  const isSubmitting = useMemo(
    () => methods.formState.isSubmitting,
    [methods.formState.isSubmitting],
  );

  const loading = useMemo(() => isSubmitting || acting, [isSubmitting, acting]);

  const leaveDisabled = useMemo(() => {
    const baseCondition = loading;

    return baseCondition || disableLeaveButton?.(values);
  }, [disableLeaveButton, loading, values]);

  const actionDisabled = useMemo(() => {
    const baseCondition = loading;

    return baseCondition || disableActionButton?.(values);
  }, [disableActionButton, loading, values]);

  const submitDisabled = useMemo(() => {
    const baseCondition = loading;

    return baseCondition || disableSubmitButton?.(values);
  }, [disableSubmitButton, loading, values]);

  return (
    <div className={cx(classes.formActionsFooter, actionsClassName)}>
      <Button
        type="button"
        size="large"
        variant="text"
        danger
        disabled={leaveDisabled}
      >
        離開
      </Button>
      <div className={classes.actionsSet}>
        <Button
          type="button"
          size="large"
          variant="outlined"
          disabled={actionDisabled}
        >
          儲存草稿
        </Button>
        <Button
          type="submit"
          size="large"
          variant="contained"
          loading={isSubmitting}
          disabled={submitDisabled}
        >
          送審
        </Button>
      </div>
    </div>
  );
};

export default FormActionsFooter;
