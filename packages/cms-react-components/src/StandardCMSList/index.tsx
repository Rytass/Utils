import React from 'react';
import { Button, Typography } from '@mezzanine-ui/react';
import classes from './index.module.scss';

const StandardCMSList = () => {
  return (
    <div className={classes.root}>
      StandardCMSList
      <Button type="button" variant="contained">
        button
      </Button>
      <Typography variant="h1">h1</Typography>
      <Typography variant="h2">h2</Typography>
    </div>
  );
};

export { StandardCMSList };
