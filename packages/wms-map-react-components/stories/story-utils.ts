import { Node } from '@xyflow/react';
import { Map } from '../src/typings';
import {
  transformApiDataToNodes,
  validateMapData,
} from '../src/utils/api-data-transform';
import { generateMockImageUrl } from './mock-image-utils';
import {
  mockMapData,
  simpleMapData,
  emptyMapData,
  largeMapData,
  closedPolygonTestData,
} from './mock-data';
import type { FlowNode } from '../src/types/react-flow.types';

/**
 * 生成測試用的節點陣列，專門為 Storybook 使用
 */
export const generateStoryNodes = (
  testType: 'simple' | 'complex' | 'empty' | 'large' | 'polygons' = 'simple',
): Node[] => {
  const dataMap = {
    simple: simpleMapData,
    complex: mockMapData,
    empty: emptyMapData,
    large: largeMapData,
    polygons: closedPolygonTestData,
  };

  const selectedData = dataMap[testType];

  // 驗證資料格式
  if (!validateMapData(selectedData)) {
    console.error('Mock data validation failed for type:', testType);

    return [];
  }

  return transformApiDataToNodes(selectedData, generateMockImageUrl);
};

/**
 * Helper function to convert Node[] to FlowNode[] for Storybook
 */
export const convertToFlowNodes = (nodes: Node[]): FlowNode[] => {
  return nodes.map((node) => ({
    ...node,
    type: node.type || 'default', // Ensure type is always a string
  })) as FlowNode[];
};

/**
 * 匯出特定格式的資料供 Storybook 使用
 */
export const exportStoryData = (
  testType: 'simple' | 'complex' | 'empty' | 'large' | 'polygons' = 'simple',
): { nodes: FlowNode[]; edges: any[] } => {
  const nodes = generateStoryNodes(testType);

  return {
    nodes: convertToFlowNodes(nodes),
    edges: [], // WMS 地圖通常不需要邊
  };
};

/**
 * 驗證轉換結果的完整性（供 Storybook 使用）
 */
export const validateStoryTransformationResult = (
  originalMap: Map,
  transformedNodes: Node[],
): boolean => {
  const expectedNodeCount =
    originalMap.backgrounds.length + originalMap.ranges.length;

  const actualNodeCount = transformedNodes.length;

  if (expectedNodeCount !== actualNodeCount) {
    console.error(
      `節點數量不符: 期望 ${expectedNodeCount}, 實際 ${actualNodeCount}`,
    );

    return false;
  }

  // 檢查節點類型分布
  const imageNodeCount = transformedNodes.filter(
    (n) => n.type === 'imageNode',
  ).length;

  const rectangleNodeCount = transformedNodes.filter(
    (n) => n.type === 'rectangleNode',
  ).length;

  const pathNodeCount = transformedNodes.filter(
    (n) => n.type === 'pathNode',
  ).length;

  const expectedImageCount = originalMap.backgrounds.length;
  const expectedRectangleCount = originalMap.ranges.filter(
    (r) => r.type === 'RECTANGLE',
  ).length;

  const expectedPathCount = originalMap.ranges.filter(
    (r) => r.type === 'POLYGON',
  ).length;

  const checks = [
    { name: '背景圖片', expected: expectedImageCount, actual: imageNodeCount },
    {
      name: '矩形',
      expected: expectedRectangleCount,
      actual: rectangleNodeCount,
    },
    { name: '多邊形', expected: expectedPathCount, actual: pathNodeCount },
  ];

  const allValid = checks.every(({ name, expected, actual }) => {
    if (expected !== actual) {
      console.error(`${name}節點數量不符: 期望 ${expected}, 實際 ${actual}`);

      return false;
    }

    return true;
  });

  return allValid;
};
