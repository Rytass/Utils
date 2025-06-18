import React, { ReactNode, useCallback } from 'react';
import { FieldValues, FormProvider } from 'react-hook-form';
import FormActionsFooter from './FormActionsFooter';
import { StandardCMSFormActionsProps } from './typings';

const FormActionsBody = <T extends FieldValues>(
  props: StandardCMSFormActionsProps<T>,
): ReactNode => {
  const { className, methods, children, onSubmit: onSubmitProps } = props;

  const onSubmit = useCallback(
    async (value: T) => {
      if (onSubmitProps) {
        await onSubmitProps(value);
      } else {
        console.log('value', value);
      }
    },
    [onSubmitProps],
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
