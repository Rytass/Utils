import React, { ReactNode, useRef, useEffect } from 'react';
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
  autoFocus?: boolean;
  disabled?: boolean;
}

export const Textarea = ({
  label,
  value,
  onChange,
  autoFocus,
  disabled,
}: TextareaProps): ReactNode => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

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
        textareaRef={textareaRef}
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
