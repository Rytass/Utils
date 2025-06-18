import React, { ReactNode, useCallback } from 'react';
import { FieldValues, FormProvider } from 'react-hook-form';
import FormActionsFooter from './FormActionsFooter';
import { StandardCMSFormActionsProps } from './typings';

const FormActionsBody = <T extends FieldValues>(
  props: StandardCMSFormActionsProps<T>,
): ReactNode => {
  const { className, methods, children } = props;

  const onSubmit = useCallback(async (value: T) => {
    console.log('value', value);
  }, []);

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
