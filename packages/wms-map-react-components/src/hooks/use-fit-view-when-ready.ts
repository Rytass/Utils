'use client';

import { useEffect, useRef } from 'react';
import { getNodesBounds, getViewportForBounds, useStoreApi } from '@xyflow/react';

/** 等待節點量測完成的 rAF 重試上限（約 2 秒）；超過即放棄，避免無限輪詢。 */
const MAX_READY_FRAMES = 120;

export interface FitViewWhenReadyOptions {
  /** 每次要求 fit 時遞增；0 代表尚未要求，不會 fit。 */
  requestToken: number;
  /** 目前節點集合的全部 id；全部節點量測完成後才會 fit。 */
  nodeIds: readonly string[];
  /** 要框住的節點 id（例如 highlightIds）；未提供或皆不存在時框住全部節點。 */
  focusIds?: readonly string[];
  /** 比例 padding，語意與 React Flow `fitView` 相同（0.1 = 10%）。 */
  padding: number;
}

const isMeasured = (width: number | undefined, height: number | undefined): boolean =>
  (width ?? 0) > 0 && (height ?? 0) > 0;

/**
 * 在 requestToken 變動時，等節點全部量測完成後直接設定 viewport 框住節點。
 *
 * 不使用 React Flow 的 `fitView`：它只會在下一次 `setNodes` 或 `updateNodeInternals` 時才執行，
 * 換入新節點集合時若未觸發這兩者會永遠不 fit。這裡改為自行輪詢 store，就緒後直接呼叫 panZoom。
 * 只有 requestToken 變動時才會 fit，之後使用者的手動縮放或平移不會被覆寫。
 */
export const useFitViewWhenReady = (options: FitViewWhenReadyOptions): void => {
  const store = useStoreApi();
  const latestRef = useRef<FitViewWhenReadyOptions>(options);

  useEffect(() => {
    latestRef.current = options;
  });

  const { requestToken } = options;

  useEffect(() => {
    if (requestToken === 0) {
      return undefined;
    }

    let frame: number | null = null;
    let attempts = 0;

    const tryFit = (): void => {
      frame = null;

      const { nodeIds, focusIds, padding } = latestRef.current;

      if (nodeIds.length === 0) {
        return;
      }

      const { nodeLookup, width, height, panZoom, minZoom, maxZoom, nodeOrigin } = store.getState();

      const ready =
        width > 0 &&
        height > 0 &&
        panZoom !== null &&
        nodeLookup.size === nodeIds.length &&
        nodeIds.every(id => {
          const node = nodeLookup.get(id);

          return node !== undefined && isMeasured(node.measured.width, node.measured.height);
        });

      if (!ready) {
        attempts += 1;

        if (attempts < MAX_READY_FRAMES) {
          frame = requestAnimationFrame(tryFit);
        }

        return;
      }

      const focused = focusIds?.filter(id => nodeLookup.has(id)) ?? [];
      const targetIds = focused.length > 0 ? focused : nodeIds;
      const bounds = getNodesBounds([...targetIds], { nodeLookup, nodeOrigin });

      if (bounds.width <= 0 || bounds.height <= 0) {
        return;
      }

      const viewport = getViewportForBounds(bounds, width, height, minZoom, maxZoom, padding);

      void panZoom?.setViewport(viewport, { duration: 0 });
    };

    frame = requestAnimationFrame(tryFit);

    return (): void => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [requestToken, store]);
};
