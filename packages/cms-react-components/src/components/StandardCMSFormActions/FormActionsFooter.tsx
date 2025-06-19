import React, { ReactNode, useMemo, useState, useCallback } from 'react';
import { Button, cx } from '@mezzanine-ui/react';
import { FieldValues } from 'react-hook-form';
import { useLeaveButton } from './hooks/useLeaveButton';
import { useActionButton } from './hooks/useActionButton';
import { useSubmitButton } from './hooks/useSubmitButton';
import { StandardCMSFormActionsProps } from './typings';
import classes from './index.module.scss';

const FormActionsFooter = <T extends FieldValues>({
  actionsClassName,
  methods,
  leaveButtonText: leaveButtonTextProps,
  actionButtonText: actionButtonTextProps,
  submitButtonText: submitButtonTextProps,
  disableLeaveButton,
  disableActionButton,
  disableSubmitButton,
  onLeave: onLeaveProps,
  onAction: onActionProps,
  onSubmit: onSubmitProps,
  createMode,
  currentStage,
  userPermissions,
  actionsEvents,
}: StandardCMSFormActionsProps<T>): ReactNode => {
  const [acting, setActing] = useState<boolean>(false);

  const values = methods.watch();

  const leaveButton = useLeaveButton<T>({
    values,
    createMode,
    currentStage,
    userPermissions,
    actionsEvents,
  });

  const actionButton = useActionButton<T>({
    values,
    createMode,
    currentStage,
    userPermissions,
    actionsEvents,
  });

  const submitButton = useSubmitButton<T>({
    values,
    createMode,
    currentStage,
    userPermissions,
    actionsEvents,
  });

  const isSubmitting = useMemo(
    () => methods.formState.isSubmitting,
    [methods.formState.isSubmitting],
  );

  const loading = useMemo(() => isSubmitting || acting, [isSubmitting, acting]);

  const leaveButtonText = useMemo(
    () => leaveButtonTextProps || leaveButton.text,
    [leaveButton.text, leaveButtonTextProps],
  );

  const actionButtonText = useMemo(
    () => actionButtonTextProps || actionButton.text,
    [actionButton.text, actionButtonTextProps],
  );

  const submitButtonText = useMemo(
    () => submitButtonTextProps || submitButton.text,
    [submitButton.text, submitButtonTextProps],
  );

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

  const onLeave = useCallback(async () => {
    if (onLeaveProps) {
      await onLeaveProps(values);
    } else {
      await leaveButton.onLeave?.();
    }
  }, [leaveButton, onLeaveProps, values]);

  const onAction = useCallback(async () => {
    setActing(true);

    if (onActionProps) {
      await onActionProps(values);
    } else {
      await actionButton.onAction?.();
    }

    setActing(false);
  }, [actionButton, onActionProps, values]);

  return (
    <div className={cx(classes.formActionsFooter, actionsClassName)}>
      <Button
        type="button"
        size="large"
        variant="text"
        danger
        onClick={onLeave}
        loading={loading}
        disabled={leaveDisabled}
      >
        {leaveButtonText}
      </Button>
      <div className={classes.actionsSet}>
        {actionButtonText && (onActionProps || actionButton.onAction) && (
          <Button
            type="button"
            size="large"
            variant="outlined"
            onClick={onAction}
            loading={loading}
            disabled={actionDisabled}
          >
            {actionButtonText}
          </Button>
        )}
        {submitButtonText && (onSubmitProps || submitButton.onSubmit) && (
          <Button
            type="submit"
            size="large"
            variant="contained"
            loading={loading}
            disabled={submitDisabled}
          >
            {submitButtonText}
          </Button>
        )}
      </div>
    </div>
  );
};

export default FormActionsFooter;
