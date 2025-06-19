import React, { ReactNode, useCallback } from 'react';
import { FieldValues, FormProvider } from 'react-hook-form';
import FormActionsFooter from './FormActionsFooter';
import { useSubmitButton } from './hooks/useSubmitButton';
import { StandardCMSFormActionsProps } from './typings';

const FormActionsBody = <T extends FieldValues>(
  props: StandardCMSFormActionsProps<T>,
): ReactNode => {
  const {
    className,
    methods,
    children,
    onSubmit: onSubmitProps,
    createMode,
    currentStage,
    userPermissions,
    actionsEvents,
  } = props;

  const values = methods.watch();

  const submitButton = useSubmitButton<T>({
    values,
    createMode,
    currentStage,
    userPermissions,
    actionsEvents,
  });

  const onSubmit = useCallback(
    async (value: T) => {
      if (onSubmitProps) {
        await onSubmitProps(value);
      } else {
        await submitButton.onSubmit?.();
      }
    },
    [onSubmitProps, submitButton],
  );

  return (
    <FormProvider {...methods}>
      <form className={className} onSubmit={methods.handleSubmit(onSubmit)}>
        {children}
        <FormActionsFooter {...props} />
      </form>
    </FormProvider>
  );
};

export default FormActionsBody;
