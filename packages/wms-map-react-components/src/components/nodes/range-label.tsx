'use client';

import React, { createContext, CSSProperties, FC, ReactNode, useContext, useEffect } from 'react';
import { useStore } from '@xyflow/react';
import { LABEL_TONE_COLORS, type LabelTone } from '../../utils/label-contrast';
import { labelFontSizeCss } from '../../utils/label-font-size';

/** 畫布算好的各範圍標籤字色；沒有提供者時一律用深色。 */
export const RangeLabelToneContext = createContext<ReadonlyMap<string, LabelTone>>(new Map());

export const useRangeLabelTone = (id: string): LabelTone => useContext(RangeLabelToneContext).get(id) ?? 'dark';

/** 字色與反色光暈；光暈讓標籤壓在平面圖線稿上仍可讀。 */
export const labelToneStyle = (tone: LabelTone): CSSProperties => {
  const halo = LABEL_TONE_COLORS[tone === 'dark' ? 'light' : 'dark'];

  return {
    color: LABEL_TONE_COLORS[tone],
    textShadow: `0 0 2px ${halo}, 0 0 2px ${halo}, 0 0 4px ${halo}`,
  };
};

interface RangeLabelProps {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  /** 被淡化的範圍，標籤一起淡化。 */
  readonly opacity: number;
  readonly interactive: boolean;
  readonly children: ReactNode;
}

/**
 * 疊在範圍上方的標籤層。它是範圍外框的兄弟元素而非子元素，
 * 所以範圍的 opacity 不會一起套到文字上。
 */
export const RangeLabel: FC<RangeLabelProps> = ({ id, width, height, label, opacity, interactive, children }) => {
  const tone = useRangeLabelTone(id);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: interactive ? 'auto' : 'none',
        opacity,
        fontSize: labelFontSizeCss(width, height, label),
        fontWeight: 'bold',
        lineHeight: 1.1,
        whiteSpace: 'nowrap',
        textAlign: 'center',
        transition: 'opacity 0.2s ease',
        ...labelToneStyle(tone),
      }}
    >
      {children}
    </div>
  );
};

/**
 * 放在 <ReactFlow> 內，把目前縮放比例寫到 React Flow 根元素的 `--wms-map-zoom`，
 * 標籤字級據此換算畫面像素。只有這一個元件訂閱縮放，節點不必各自訂閱。
 */
export const ZoomCssVariable: FC = () => {
  const zoom = useStore(state => state.transform[2]);
  const domNode = useStore(state => state.domNode);

  useEffect(() => {
    domNode?.style.setProperty('--wms-map-zoom', String(zoom));
  }, [domNode, zoom]);

  return null;
};
