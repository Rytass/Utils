import React, { FC } from 'react';
import { NodeResizeControl } from '@xyflow/react';
import { DEFAULT_RECTANGLE_COLOR, RESIZE_CONTROL_SIZE, MIN_RESIZE_WIDTH, MIN_RESIZE_HEIGHT } from '../constants';

interface ResizeControlsProps {
  onResize: (event: any, params: any) => void;
  isVisible: boolean;
}

const ResizeControls: FC<ResizeControlsProps> = ({ onResize, isVisible }) => {
  if (!isVisible) return null;

  const controlStyle = {
    background: 'white',
    border: `2px solid ${DEFAULT_RECTANGLE_COLOR}`,
    width: RESIZE_CONTROL_SIZE,
    height: RESIZE_CONTROL_SIZE,
    borderRadius: 2,
  };

  const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

  return (
    <>
      {positions.map((position) => (
        <NodeResizeControl
          key={position}
          style={controlStyle}
          minWidth={MIN_RESIZE_WIDTH}
          minHeight={MIN_RESIZE_HEIGHT}
          onResize={onResize}
          position={position}
        />
      ))}
    </>
  );
};

export default ResizeControls;