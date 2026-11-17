import {
  getMapKey,
  getNodeIdSignature,
  INITIAL_MAP_FIT_STATE,
  MapFitState,
  resolveMapFit,
} from '../src/utils/fit-trigger';

interface Step {
  readonly path: readonly string[];
  readonly ids: readonly string[];
}

/** 依序餵入每一次 render 的 (麵包屑, 節點 id)，回傳每一步是否 fit。 */
const run = (steps: readonly Step[]): boolean[] =>
  steps.reduce<{ state: MapFitState; fits: boolean[] }>(
    (acc, { path, ids }) => {
      const nodes = ids.map(id => ({ id }));
      const { shouldFit, state } = resolveMapFit(acc.state, {
        mapKey: getMapKey(path),
        nodeSignature: getNodeIdSignature(nodes),
        nodeCount: nodes.length,
      });

      return { state, fits: [...acc.fits, shouldFit] };
    },
    { state: INITIAL_MAP_FIT_STATE, fits: [] },
  ).fits;

const ROOT = ['WH'];
const CHILD = ['WH', 'ZONE-A'];

describe('fit-trigger', () => {
  describe('getNodeIdSignature', () => {
    it('is independent of node order', () => {
      expect(getNodeIdSignature([{ id: 'b' }, { id: 'a' }])).toBe(getNodeIdSignature([{ id: 'a' }, { id: 'b' }]));
    });

    it('differs when the id set differs', () => {
      expect(getNodeIdSignature([{ id: 'a' }])).not.toBe(getNodeIdSignature([{ id: 'a' }, { id: 'b' }]));
    });
  });

  describe('getMapKey', () => {
    it('distinguishes the same leaf under different parents', () => {
      expect(getMapKey(['A', 'X'])).not.toBe(getMapKey(['B', 'X']));
    });
  });

  describe('resolveMapFit', () => {
    it('fits when the first render already has nodes', () => {
      expect(run([{ path: ROOT, ids: ['bg', 'r1'] }])).toEqual([true]);
    });

    it('waits through an empty first load and fits once nodes arrive', () => {
      expect(
        run([
          { path: ROOT, ids: [] },
          { path: ROOT, ids: ['bg', 'r1'] },
        ]),
      ).toEqual([false, true]);
    });

    it('does not fit again when nodes are added on the same map', () => {
      expect(
        run([
          { path: ROOT, ids: ['bg', 'r1'] },
          { path: ROOT, ids: ['bg', 'r1', 'r2'] },
          { path: ROOT, ids: ['bg', 'r2'] },
        ]),
      ).toEqual([true, false, false]);
    });

    it('does not fit when the same ids arrive in a new array', () => {
      expect(
        run([
          { path: ROOT, ids: ['bg', 'r1'] },
          { path: ROOT, ids: ['r1', 'bg'] },
        ]),
      ).toEqual([true, false]);
    });

    it('fits when entering a child map with its nodes in the same render', () => {
      expect(
        run([
          { path: ROOT, ids: ['bg', 'r1'] },
          { path: CHILD, ids: ['bg2', 'c1'] },
        ]),
      ).toEqual([true, true]);
    });

    it('waits for the child map nodes when the breadcrumb changes first', () => {
      expect(
        run([
          { path: ROOT, ids: ['bg', 'r1'] },
          { path: CHILD, ids: ['bg', 'r1'] },
          { path: CHILD, ids: [] },
          { path: CHILD, ids: ['bg2', 'c1'] },
          { path: CHILD, ids: ['bg2', 'c1', 'c2'] },
        ]),
      ).toEqual([true, false, false, true, false]);
    });

    it('fits after going back to the parent map', () => {
      expect(
        run([
          { path: ROOT, ids: ['bg', 'r1'] },
          { path: CHILD, ids: ['bg2', 'c1'] },
          { path: ROOT, ids: ['bg', 'r1'] },
        ]),
      ).toEqual([true, true, true]);
    });

    it('fits a newly entered map that edits on the previous map did not settle', () => {
      expect(
        run([
          { path: ROOT, ids: ['bg', 'r1'] },
          { path: ROOT, ids: ['bg', 'r1', 'r2'] },
          { path: CHILD, ids: ['bg', 'r1', 'r2'] },
          { path: CHILD, ids: ['bg2', 'c1'] },
        ]),
      ).toEqual([true, false, false, true]);
    });

    it('does not fit an empty child map, and fits its first non-empty load', () => {
      expect(
        run([
          { path: ROOT, ids: ['bg', 'r1'] },
          { path: CHILD, ids: [] },
          { path: CHILD, ids: ['c1'] },
        ]),
      ).toEqual([true, false, true]);
    });
  });
});
