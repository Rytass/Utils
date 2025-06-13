import React, { ReactElement } from 'react';
import { Button, Typography, Icon } from '@mezzanine-ui/react';
import { History } from '../../icons/history';
import classes from './index.module.scss';

const StandardCMSList = (): ReactElement => {
  return (
    <div className={classes.root}>
      StandardCMSList
      <Button type="button" variant="contained">
        button
      </Button>
      <Typography variant="h1">h1</Typography>
      <Typography variant="h2">h2</Typography>
      <Icon icon={History} size={16} />
    </div>
  );
};

export { StandardCMSList };
