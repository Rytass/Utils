import React from 'react';
import { Spin } from '@mezzanine-ui/react';
import classes from './index.module.scss';

const Loading = (): React.JSX.Element => {
  return (
    <div className={classes.host}>
      <Spin size="sub" loading />
    </div>
  );
};

export default Loading;
