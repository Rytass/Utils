import { ReactNode } from 'react';
import { FieldValues, UseFormReturn } from 'react-hook-form';

export interface StandardCMSFormActionsEventsProps<
  T extends FieldValues = FieldValues,
> {
  onSaveDraft?: (source: T) => Promise<void>;
}

export interface StandardCMSFormActionsProps<
  T extends FieldValues = FieldValues,
> {
  className?: string;
  methods: UseFormReturn<T>;
  children: ReactNode;
  actionsEvents: StandardCMSFormActionsEventsProps<T>;
}
