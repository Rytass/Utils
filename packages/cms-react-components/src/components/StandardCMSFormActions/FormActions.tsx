import React, { ReactNode, useCallback, useMemo } from 'react';
import { FieldValues, FormProvider } from 'react-hook-form';
import { StandardCMSFormActionsProps } from './typings';
import classes from './index.module.scss';

const FormActions = <T extends FieldValues>({
  className,
  methods,
  children,
}: StandardCMSFormActionsProps<T>): ReactNode => {
  const isSubmitting = useMemo(
    () => methods.formState.isSubmitting,
    [methods.formState.isSubmitting],
  );

  const onSubmit = useCallback((value: T) => {}, []);

  return (
    <FormProvider {...methods}>
      <form className={className} onSubmit={methods.handleSubmit(onSubmit)}>
        {children}
      </form>
    </FormProvider>
  );
};

export default FormActions;
