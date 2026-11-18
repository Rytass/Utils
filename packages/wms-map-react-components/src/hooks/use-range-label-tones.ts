import { useEffect, useMemo, useState } from 'react';
import type { Node as ReactFlowNode } from '@xyflow/react';
import {
  averageColorOver,
  boxesOverlap,
  containedFrame,
  CANVAS_BACKGROUND,
  labelSampleArea,
  parseHexColor,
  pickLabelTone,
  RANGE_FILL_ALPHA,
  type Box,
  type LabelTone,
  type PixelSample,
  type Rgb,
} from '../utils/label-contrast';

/** 取樣前把底圖縮到長邊這個尺寸；算平均色綽綽有餘。 */
const SAMPLE_SIZE = 256;

interface NodeData {
  readonly width?: number;
  readonly height?: number;
  readonly color?: string;
  readonly imageUrl?: string;
  readonly points?: ReadonlyArray<{ readonly x: number; readonly y: number }>;
}

const dataOf = (node: ReactFlowNode): NodeData => node.data as NodeData;

const boxOf = (node: ReactFlowNode): Box | null => {
  const data = dataOf(node);

  if (node.type === 'pathNode') {
    const points = data.points ?? [];

    if (points.length === 0) return null;

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);

    return {
      x: node.position.x + Math.min(...xs),
      y: node.position.y + Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }

  if (typeof data.width !== 'number' || typeof data.height !== 'number') return null;

  return { x: node.position.x, y: node.position.y, width: data.width, height: data.height };
};

const sampleCache = new Map<string, Promise<PixelSample | null>>();

/** 載入並縮小底圖後讀出像素；無 CORS 的跨網域圖片會讓 canvas 無法讀取，回傳 null。 */
const sampleImage = (url: string): Promise<PixelSample | null> => {
  const cached = sampleCache.get(url);

  if (cached) return cached;

  const loading = new Promise<PixelSample | null>(resolve => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      resolve(null);

      return;
    }

    const image = new Image();

    image.crossOrigin = 'anonymous';
    image.onload = (): void => {
      try {
        const scale = Math.min(1, SAMPLE_SIZE / Math.max(image.naturalWidth, image.naturalHeight, 1));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');

        if (!context) {
          resolve(null);

          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve({ pixels: context.getImageData(0, 0, width, height).data, width, height });
      } catch {
        resolve(null);
      }
    };

    image.onerror = (): void => resolve(null);
    image.src = url;
  });

  sampleCache.set(url, loading);

  return loading;
};

interface BackgroundImage {
  readonly url: string;
  readonly frame: Box;
  readonly zIndex: number;
}

/**
 * 每個範圍節點的標籤字色。先以畫布色立即決定，底圖載入後再依實際像素修正，標籤不必等圖。
 * `rangeOpacity` 是範圍節點本身的 opacity（檢視模式為 RECTANGLE_INACTIVE_OPACITY）。
 */
export const useRangeLabelTones = (
  nodes: readonly ReactFlowNode[],
  rangeOpacity: number,
): ReadonlyMap<string, LabelTone> => {
  const [samples, setSamples] = useState<ReadonlyMap<string, PixelSample | null>>(() => new Map());

  const images = useMemo(
    (): readonly BackgroundImage[] =>
      nodes
        .filter(node => node.type === 'imageNode' && typeof dataOf(node).imageUrl === 'string')
        .map(node => ({ url: dataOf(node).imageUrl as string, frame: boxOf(node), zIndex: node.zIndex ?? 0 }))
        .filter((image): image is BackgroundImage => image.frame !== null)
        .sort((a, b) => b.zIndex - a.zIndex),
    [nodes],
  );

  const urlsKey = useMemo(
    () =>
      Array.from(new Set(images.map(image => image.url)))
        .sort()
        .join('\u0000'),
    [images],
  );

  useEffect(() => {
    if (urlsKey === '') return undefined;

    let cancelled = false;

    urlsKey.split('\u0000').forEach(url => {
      void sampleImage(url).then(sample => {
        if (!cancelled) setSamples(prev => (prev.has(url) ? prev : new Map([...prev, [url, sample]])));
      });
    });

    return (): void => {
      cancelled = true;
    };
  }, [urlsKey]);

  return useMemo(
    () =>
      new Map(
        nodes
          .filter(node => node.type === 'rectangleNode' || node.type === 'pathNode')
          .map((node): readonly [string, LabelTone] | null => {
            const box = boxOf(node);

            if (!box) return null;

            const area = labelSampleArea(box);
            const backdrop =
              images
                .filter(image => boxesOverlap(image.frame, area))
                .map(image => {
                  const sample = samples.get(image.url);

                  return sample
                    ? averageColorOver(sample, containedFrame(image.frame, sample.width / sample.height), area)
                    : null;
                })
                .find((rgb): rgb is Rgb => rgb !== null) ?? CANVAS_BACKGROUND;

            return [
              node.id,
              pickLabelTone(backdrop, parseHexColor(dataOf(node).color ?? ''), RANGE_FILL_ALPHA * rangeOpacity),
            ] as const;
          })
          .filter((entry): entry is readonly [string, LabelTone] => entry !== null),
      ),
    [images, nodes, rangeOpacity, samples],
  );
};
