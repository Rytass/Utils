'use client';

import React, { FC, useEffect, useMemo, useState } from 'react';
import { NodeProps, NodeTypes, ReactFlow, ReactFlowProvider, useStore } from '@xyflow/react';
import { EditMode, ViewMode } from '../../typings';
import type { FlowNode, WMSMapPreviewProps } from '../../types';
import ImageNode from '../nodes/image-node';
import RectangleNode from '../nodes/rectangle-node';
import PathNode from '../nodes/path-node';
import { useFitViewWhenReady } from '../../hooks/use-fit-view-when-ready';
import { applyPreviewHighlight } from '../../utils/preview-highlight';
import { getNodeIdSignature } from '../../utils/fit-trigger';

/** 與 WMSMapModal 的檢視模式一致：VIEW 不可編輯，BACKGROUND 讓底圖全不透明。 */
const PREVIEW_EDIT_MODE = EditMode.BACKGROUND;
const PREVIEW_VIEW_MODE = ViewMode.VIEW;

/** 模組層級常數，維持穩定參照，React Flow 才不會每次 render 重建節點。 */
const PREVIEW_NODE_TYPES: NodeTypes = {
  imageNode: (props: NodeProps): React.JSX.Element => (
    <ImageNode {...props} editMode={PREVIEW_EDIT_MODE} viewMode={PREVIEW_VIEW_MODE} />
  ),
  rectangleNode: (props: NodeProps): React.JSX.Element => (
    <RectangleNode {...props} editMode={PREVIEW_EDIT_MODE} viewMode={PREVIEW_VIEW_MODE} />
  ),
  pathNode: (props: NodeProps): React.JSX.Element => (
    <PathNode {...props} editMode={PREVIEW_EDIT_MODE} viewMode={PREVIEW_VIEW_MODE} />
  ),
};

/** 預覽容器可能很窄（例如 200px），minZoom 需夠低，否則 fit 會被夾住而框不住整張圖。 */
const PREVIEW_MIN_ZOOM = 0.01;
const PREVIEW_MAX_ZOOM = 4;
const NO_NODES_DELETE_KEY = null;

const getFileName = (node: FlowNode): string | null => {
  const { fileName } = node.data;

  return node.type === 'imageNode' && typeof fileName === 'string' && fileName.length > 0 ? fileName : null;
};

/** 以 getFilenameFQDN 解析背景圖網址；未提供時沿用 data.imageUrl。 */
const useResolvedImageUrls = (
  nodes: readonly FlowNode[],
  getFilenameFQDN: WMSMapPreviewProps['getFilenameFQDN'],
): Readonly<Record<string, string>> => {
  const [resolved, setResolved] = useState<Readonly<Record<string, string>>>({});

  const fileNamesKey = useMemo(
    () =>
      Array.from(new Set(nodes.map(getFileName).filter((name): name is string => name !== null)))
        .sort()
        .join('\u0000'),
    [nodes],
  );

  useEffect(() => {
    if (!getFilenameFQDN || fileNamesKey === '') {
      setResolved({});

      return undefined;
    }

    let cancelled = false;
    const fileNames = fileNamesKey.split('\u0000');

    void Promise.all(
      fileNames.map(async (fileName): Promise<readonly [string, string] | null> => {
        try {
          return [fileName, await Promise.resolve(getFilenameFQDN(fileName))] as const;
        } catch (error) {
          console.error(`無法取得底圖網址: ${fileName}`, error);

          return null;
        }
      }),
    ).then(entries => {
      if (!cancelled) {
        setResolved(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
      }
    });

    return (): void => {
      cancelled = true;
    };
  }, [fileNamesKey, getFilenameFQDN]);

  return resolved;
};

const WMSMapPreviewCanvas: FC<WMSMapPreviewProps> = ({
  initialNodes,
  highlightIds,
  dimOthers = true,
  fitPadding = 0.15,
  interactive = false,
  getFilenameFQDN,
}) => {
  const resolvedImageUrls = useResolvedImageUrls(initialNodes, getFilenameFQDN);

  const nodes = useMemo<FlowNode[]>(
    () =>
      applyPreviewHighlight(initialNodes, highlightIds, dimOthers).map(node => {
        const fileName = getFileName(node);
        const imageUrl = fileName !== null ? resolvedImageUrls[fileName] : undefined;

        return {
          ...node,
          data: imageUrl !== undefined ? { ...node.data, imageUrl } : node.data,
          selectable: false,
          draggable: false,
          deletable: false,
          connectable: false,
          focusable: false,
        };
      }),
    [initialNodes, highlightIds, dimOthers, resolvedImageUrls],
  );

  // React Flow 以自己的 ResizeObserver 量測容器並寫入 store；尺寸改變時重新 fit
  const width = useStore(state => state.width);
  const height = useStore(state => state.height);

  const nodeIds = useMemo(() => nodes.map(node => node.id), [nodes]);
  const fitKey = [
    getNodeIdSignature(nodes),
    highlightIds ? [...highlightIds].sort().join('\u0000') : '',
    fitPadding,
    width,
    height,
  ].join('|');

  const [fitRequestToken, setFitRequestToken] = useState<number>(0);

  useEffect(() => {
    if (nodeIds.length > 0 && width > 0 && height > 0) {
      setFitRequestToken(token => token + 1);
    }
  }, [fitKey, nodeIds.length, width, height]);

  useFitViewWhenReady({
    requestToken: fitRequestToken,
    nodeIds,
    focusIds: highlightIds,
    padding: fitPadding,
  });

  return (
    <ReactFlow
      nodes={nodes}
      edges={[]}
      nodeTypes={PREVIEW_NODE_TYPES}
      style={{ background: '#F5F5F5' }}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      minZoom={PREVIEW_MIN_ZOOM}
      maxZoom={PREVIEW_MAX_ZOOM}
      nodeOrigin={[0, 0]}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      elementsSelectable={false}
      selectNodesOnDrag={false}
      deleteKeyCode={NO_NODES_DELETE_KEY}
      selectionKeyCode={null}
      multiSelectionKeyCode={null}
      panOnDrag={interactive}
      panOnScroll={false}
      zoomOnScroll={interactive}
      zoomOnPinch={interactive}
      zoomOnDoubleClick={false}
      preventScrolling={interactive}
    />
  );
};

/**
 * 唯讀的地圖預覽：不含工具列、麵包屑與右鍵選單，節點就緒後自動 fit，
 * 有 highlightIds 時框住並高亮這些範圍。
 *
 * 需要 React Flow 的樣式表；與 WMSMapModal 相同，由宿主在 app 層 import：
 * `import '@xyflow/react/dist/style.css';`
 */
const WMSMapPreview: FC<WMSMapPreviewProps> = props => {
  const { className, style } = props;

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <ReactFlowProvider>
        <WMSMapPreviewCanvas {...props} />
      </ReactFlowProvider>
      {/* 節點自帶 pointer-events，靜態預覽以透明遮罩擋下所有互動；滾輪仍會冒泡給頁面捲動 */}
      {!props.interactive && <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 10 }} />}
    </div>
  );
};

export default WMSMapPreview;
