import React, { ReactNode } from 'react';
import {
  Textarea as MznTextarea,
  FormLabel,
  Typography,
} from '@mezzanine-ui/react';
import classes from './index.module.scss';

export interface TextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const Textarea = ({
  label,
  value,
  onChange,
  disabled,
}: TextareaProps): ReactNode => {
  return (
    <div className={classes.root}>
      <FormLabel>
        {label}
        <Typography
          variant="caption"
          color="error"
          className={classes.requiredMark}
        >
          *
        </Typography>
      </FormLabel>
      <MznTextarea
        className={classes.textarea}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        placeholder="最多 500 個字元"
        maxLength={500}
        disabled={disabled}
      />
    </div>
  );
};
