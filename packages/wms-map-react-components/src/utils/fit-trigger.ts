import type { FlowNode } from '../types/react-flow.types';

/** 節點 id 集合的穩定簽章（排序後以 \u0000 串接），用來判斷「是不是換了一組節點」。 */
export const getNodeIdSignature = (nodes: readonly Pick<FlowNode, 'id'>[]): string =>
  nodes
    .map(node => node.id)
    .sort()
    .join('\u0000');

/** 地圖身分：以整條麵包屑路徑表示，同名子地圖掛在不同父層時仍可區分。 */
export const getMapKey = (warehouseIds: readonly string[]): string => warehouseIds.join('\u0000');

export interface MapFitState {
  /** 上一次評估時的地圖身分；null 代表尚未評估過。 */
  readonly mapKey: string | null;
  /** 上一次評估時的節點簽章。 */
  readonly lastSignature: string | null;
  /** 換到目前這張地圖時，畫面上還是哪一組節點（舊地圖的節點不算數）。 */
  readonly signatureAtSwitch: string | null;
  /** 目前地圖是否還在等第一組非空節點。 */
  readonly pending: boolean;
}

export const INITIAL_MAP_FIT_STATE: MapFitState = {
  mapKey: null,
  lastSignature: null,
  signatureAtSwitch: null,
  pending: false,
};

export interface MapFitInput {
  readonly mapKey: string;
  readonly nodeSignature: string;
  readonly nodeCount: number;
}

/**
 * 判斷是否要對目前的節點 fit 一次。
 *
 * 只在兩種情況 fit：
 * - 換到另一張地圖（mapKey 改變），且新地圖的節點已到；
 * - 同一張地圖第一次拿到非空節點（API 晚到，起初是空陣列）。
 *
 * 同一張地圖的節點增減（例如編輯後儲存、宿主重新抓資料）不會觸發。
 *
 * 換圖時若節點還是舊地圖的（宿主先更新麵包屑、資料稍後才到），會等到節點集合
 * 與換圖當下不同且非空時才 fit。前提是宿主更新 warehouseIds 不晚於更新節點。
 */
export const resolveMapFit = (
  state: MapFitState,
  { mapKey, nodeSignature, nodeCount }: MapFitInput,
): { shouldFit: boolean; state: MapFitState } => {
  const switched = mapKey !== state.mapKey;
  const pending = switched || state.pending;
  const signatureAtSwitch = switched ? state.lastSignature : state.signatureAtSwitch;
  const shouldFit = pending && nodeCount > 0 && nodeSignature !== signatureAtSwitch;

  return {
    shouldFit,
    state: {
      mapKey,
      lastSignature: nodeSignature,
      signatureAtSwitch,
      pending: pending && !shouldFit,
    },
  };
};
