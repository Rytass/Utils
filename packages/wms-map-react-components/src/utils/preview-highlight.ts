import type { FlowNode } from '../types/react-flow.types';

/** 只有範圍節點（矩形、路徑）會被高亮或淡化；背景圖片節點永遠不動。 */
const RANGE_NODE_TYPES: ReadonlySet<string> = new Set(['rectangleNode', 'pathNode']);

/** 被淡化（非高亮）範圍的透明度。 */
export const PREVIEW_DIMMED_OPACITY = 0.2;

/** 被高亮範圍的邊框／線寬（一般為 2px）。 */
export const PREVIEW_HIGHLIGHT_STROKE_WIDTH = 4;

/**
 * 依 highlightIds 為範圍節點標記 previewHighlighted / previewDimmed。
 *
 * - 未提供或為空陣列時不做任何標記（回傳原陣列），避免整張圖被淡化。
 * - dimOthers 為 false 時只標記高亮，其餘範圍維持原樣。
 */
export const applyPreviewHighlight = (
  nodes: FlowNode[],
  highlightIds: readonly string[] | undefined,
  dimOthers: boolean = true,
): FlowNode[] => {
  if (!highlightIds || highlightIds.length === 0) {
    return nodes;
  }

  const highlighted = new Set(highlightIds);

  return nodes.map(node => {
    if (!RANGE_NODE_TYPES.has(node.type)) {
      return node;
    }

    const isHighlighted = highlighted.has(node.id);
    const isDimmed = dimOthers && !isHighlighted;

    return {
      ...node,
      data: {
        ...node.data,
        previewHighlighted: isHighlighted,
        previewDimmed: isDimmed,
      },
    };
  });
};
