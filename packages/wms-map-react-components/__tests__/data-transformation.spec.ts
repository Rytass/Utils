/**
 * @jest-environment node
 */

import { Node } from '@xyflow/react';
import { mockMapData, simpleMapData, emptyMapData, largeMapData, closedPolygonTestData } from '../stories/mock-data';
import { transformApiDataToNodes, validateMapData, loadMapDataFromApi } from '../src/utils/api-data-transform';
import { generateMockImageUrl } from '../stories/mock-image-utils';
import { transformNodesToMapData } from '../src/utils/map-data-transform';
import { Map } from '../src/typings';

describe('Data Transformation', () => {
  describe('Mock Data Validation', () => {
    it('should validate mockMapData successfully', () => {
      const isValid = validateMapData(mockMapData);

      expect(isValid).toBe(true);
    });

    it('should validate simpleMapData successfully', () => {
      const isValid = validateMapData(simpleMapData);

      expect(isValid).toBe(true);
    });

    it('should validate emptyMapData successfully', () => {
      const isValid = validateMapData(emptyMapData);

      expect(isValid).toBe(true);
    });

    it('should validate largeMapData successfully', () => {
      const isValid = validateMapData(largeMapData);

      expect(isValid).toBe(true);
    });

    it('should validate closedPolygonTestData successfully', () => {
      const isValid = validateMapData(closedPolygonTestData);

      expect(isValid).toBe(true);
    });
  });

  describe('API Data to React Flow Nodes Transformation', () => {
    it('should transform mockMapData to React Flow nodes', () => {
      const nodes = transformApiDataToNodes(mockMapData, generateMockImageUrl);

      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBeGreaterThan(0);

      // 檢查節點數量是否符合預期 (背景 + 範圍)
      const expectedNodeCount = mockMapData.backgrounds.length + mockMapData.ranges.length;

      expect(nodes.length).toBe(expectedNodeCount);

      // 檢查節點類型
      const imageNodes = nodes.filter(n => n.type === 'imageNode');
      const rectangleNodes = nodes.filter(n => n.type === 'rectangleNode');
      const pathNodes = nodes.filter(n => n.type === 'pathNode');

      expect(imageNodes.length).toBe(mockMapData.backgrounds.length);
      expect(rectangleNodes.length + pathNodes.length).toBe(mockMapData.ranges.length);
    });

    it('should transform simpleMapData to React Flow nodes', () => {
      const nodes = transformApiDataToNodes(simpleMapData, generateMockImageUrl);

      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBe(simpleMapData.backgrounds.length + simpleMapData.ranges.length);
    });

    it('should handle empty data correctly', () => {
      const nodes = transformApiDataToNodes(emptyMapData, generateMockImageUrl);

      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBe(0);
    });
  });

  describe('Bidirectional Data Transformation', () => {
    it('should maintain data consistency in bidirectional transformation', () => {
      // 1. 將 API 資料轉換為 React Flow 節點
      const nodes = transformApiDataToNodes(mockMapData, generateMockImageUrl);

      // 2. 將 React Flow 節點轉換回 Map 資料
      const backToMapData = transformNodesToMapData(nodes);

      // 3. 比較原始資料和轉換後的資料
      expect(backToMapData.backgrounds.length).toBe(mockMapData.backgrounds.length);

      expect(backToMapData.ranges.length).toBe(mockMapData.ranges.length);

      // 4. 檢查資料結構完整性
      expect(backToMapData).toHaveProperty('id');
      expect(backToMapData).toHaveProperty('backgrounds');
      expect(backToMapData).toHaveProperty('ranges');
    });

    it('should preserve node type distribution after transformation', () => {
      const nodes = transformApiDataToNodes(mockMapData, generateMockImageUrl);
      const backToMapData = transformNodesToMapData(nodes);

      // 檢查背景圖片節點
      const originalBgCount = mockMapData.backgrounds.length;
      const convertedBgCount = backToMapData.backgrounds.length;

      expect(convertedBgCount).toBe(originalBgCount);

      // 檢查範圍節點
      const originalRangeCount = mockMapData.ranges.length;
      const convertedRangeCount = backToMapData.ranges.length;

      expect(convertedRangeCount).toBe(originalRangeCount);
    });
  });

  describe('Node Type Validation', () => {
    it('should create correct node types for different map elements', () => {
      const nodes = transformApiDataToNodes(mockMapData, generateMockImageUrl);

      // 檢查所有節點都有必要的屬性
      nodes.forEach(node => {
        expect(node).toHaveProperty('id');
        expect(node).toHaveProperty('type');
        expect(node).toHaveProperty('position');
        expect(node).toHaveProperty('data');
      });

      // 檢查圖片節點
      const imageNodes = nodes.filter(n => n.type === 'imageNode');

      imageNodes.forEach(node => {
        expect(node.data).toHaveProperty('imageUrl');
        expect(node.data).toHaveProperty('width');
        expect(node.data).toHaveProperty('height');
      });

      // 檢查矩形節點
      const rectangleNodes = nodes.filter(n => n.type === 'rectangleNode');

      rectangleNodes.forEach(node => {
        expect(node.data).toHaveProperty('color');
        expect(node.data).toHaveProperty('width');
        expect(node.data).toHaveProperty('height');
      });

      // 檢查路徑節點
      const pathNodes = nodes.filter(n => n.type === 'pathNode');

      pathNodes.forEach(node => {
        expect(node.data).toHaveProperty('color');
        expect(node.data).toHaveProperty('points');
        expect(Array.isArray(node.data.points)).toBe(true);
      });
    });
  });
});

describe('Transformation Result Validation', () => {
  /**
   * 驗證轉換結果的完整性的輔助函數
   */
  const validateTransformationResult = (originalMap: Map, transformedNodes: Node[]): boolean => {
    const expectedNodeCount = originalMap.backgrounds.length + originalMap.ranges.length;

    const actualNodeCount = transformedNodes.length;

    if (expectedNodeCount !== actualNodeCount) {
      return false;
    }

    // 檢查節點類型分布
    const imageNodeCount = transformedNodes.filter(n => n.type === 'imageNode').length;

    const rectangleNodeCount = transformedNodes.filter(n => n.type === 'rectangleNode').length;

    const pathNodeCount = transformedNodes.filter(n => n.type === 'pathNode').length;

    const expectedImageCount = originalMap.backgrounds.length;
    const expectedRectangleCount = originalMap.ranges.filter(r => r.type === 'RECTANGLE').length;

    const expectedPathCount = originalMap.ranges.filter(r => r.type === 'POLYGON').length;

    return (
      imageNodeCount === expectedImageCount &&
      rectangleNodeCount === expectedRectangleCount &&
      pathNodeCount === expectedPathCount
    );
  };

  it('should validate mockMapData transformation result', () => {
    const nodes = transformApiDataToNodes(mockMapData, generateMockImageUrl);
    const isValid = validateTransformationResult(mockMapData, nodes);

    expect(isValid).toBe(true);
  });

  it('should validate simpleMapData transformation result', () => {
    const nodes = transformApiDataToNodes(simpleMapData, generateMockImageUrl);
    const isValid = validateTransformationResult(simpleMapData, nodes);

    expect(isValid).toBe(true);
  });

  it('should validate emptyMapData transformation result', () => {
    const nodes = transformApiDataToNodes(emptyMapData, generateMockImageUrl);
    const isValid = validateTransformationResult(emptyMapData, nodes);

    expect(isValid).toBe(true);
  });

  it('should validate largeMapData transformation result', () => {
    const nodes = transformApiDataToNodes(largeMapData, generateMockImageUrl);
    const isValid = validateTransformationResult(largeMapData, nodes);

    expect(isValid).toBe(true);
  });

  it('should validate closedPolygonTestData transformation result', () => {
    const nodes = transformApiDataToNodes(closedPolygonTestData, generateMockImageUrl);

    const isValid = validateTransformationResult(closedPolygonTestData, nodes);

    expect(isValid).toBe(true);
  });
});
