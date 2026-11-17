import { applyPreviewHighlight } from '../src/utils/preview-highlight';
import type { FlowNode } from '../src/types/react-flow.types';

const makeNode = (id: string, type: string): FlowNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: {},
});

describe('preview-highlight', () => {
  describe('applyPreviewHighlight', () => {
    const nodes: FlowNode[] = [
      makeNode('bg', 'imageNode'),
      makeNode('A-1', 'rectangleNode'),
      makeNode('A-2', 'rectangleNode'),
      makeNode('P-1', 'pathNode'),
    ];

    it('returns the same array when highlightIds is undefined', () => {
      expect(applyPreviewHighlight(nodes, undefined)).toBe(nodes);
    });

    it('returns the same array when highlightIds is empty', () => {
      expect(applyPreviewHighlight(nodes, [])).toBe(nodes);
    });

    it('marks highlighted range nodes and dims the other range nodes', () => {
      const result = applyPreviewHighlight(nodes, ['A-2']);

      expect(result.find(n => n.id === 'A-2')?.data).toMatchObject({
        previewHighlighted: true,
        previewDimmed: false,
      });

      expect(result.find(n => n.id === 'A-1')?.data).toMatchObject({
        previewHighlighted: false,
        previewDimmed: true,
      });

      expect(result.find(n => n.id === 'P-1')?.data).toMatchObject({
        previewHighlighted: false,
        previewDimmed: true,
      });
    });

    it('never flags the background image node', () => {
      const result = applyPreviewHighlight(nodes, ['A-1']);

      expect(result.find(n => n.id === 'bg')).toBe(nodes[0]);
    });

    it('highlights without dimming when dimOthers is false', () => {
      const result = applyPreviewHighlight(nodes, ['A-1'], false);

      expect(result.find(n => n.id === 'A-1')?.data).toMatchObject({ previewHighlighted: true, previewDimmed: false });
      expect(result.find(n => n.id === 'A-2')?.data).toMatchObject({ previewHighlighted: false, previewDimmed: false });
    });

    it('does not mutate the input nodes', () => {
      applyPreviewHighlight(nodes, ['A-1']);

      expect(nodes[1].data).toEqual({});
    });

    it('ignores highlight ids that match no node', () => {
      const result = applyPreviewHighlight(nodes, ['missing']);

      expect(result.filter(n => n.data.previewDimmed === true)).toHaveLength(3);
      expect(result.filter(n => n.data.previewHighlighted === true)).toHaveLength(0);
    });
  });
});
