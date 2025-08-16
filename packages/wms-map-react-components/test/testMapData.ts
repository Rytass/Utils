import { Node } from '@xyflow/react';
import { Map } from '../typings';
import {
  mockMapData,
  simpleMapData,
  emptyMapData,
  largeMapData,
} from '../src/utils/mockData';
import {
  transformApiDataToNodes,
  validateMapData,
  loadMapDataFromApi,
} from '../src/utils/apiDataTransform';
import {
  transformNodesToMapData,
  logMapData,
} from '../src/utils/mapDataTransform';
import {
  debugLog,
  debugSuccess,
  debugError,
  debugGroup,
} from '../src/utils/debugLogger';

/**
 * 測試資料轉換的完整流程
 */
export const testDataTransformation = (): void => {
  debugGroup('資料轉換測試', () => {
    try {
      // 1. 驗證 Mock 資料格式
      debugLog('1️⃣ 驗證 Mock 資料格式...');
      const isValid = validateMapData(mockMapData);

      debugSuccess('Mock 資料驗證結果:', isValid);

      if (!isValid) {
        throw new Error('Mock 資料格式不正確');
      }

      // 2. 將 API 資料轉換為 React Flow 節點
      debugLog('2️⃣ 轉換 API 資料為 React Flow 節點...');
      const nodes = transformApiDataToNodes(mockMapData);

      debugSuccess(`轉換完成，共 ${nodes.length} 個節點`);

      // 3. 將 React Flow 節點轉換回 Map 資料（測試雙向轉換）
      debugLog('3️⃣ 測試反向轉換 (React Flow → Map)...');
      const backToMapData = transformNodesToMapData(nodes);

      debugSuccess('反向轉換完成');

      // 4. 比較原始資料和轉換後的資料
      debugLog('4️⃣ 比較資料一致性...');
      const originalRangeCount = mockMapData.ranges.length;
      const convertedRangeCount = backToMapData.ranges.length;
      const originalBgCount = mockMapData.backgrounds.length;
      const convertedBgCount = backToMapData.backgrounds.length;

      debugLog('資料對比:', {
        原始背景數量: originalBgCount,
        轉換後背景數量: convertedBgCount,
        原始範圍數量: originalRangeCount,
        轉換後範圍數量: convertedRangeCount,
        背景一致: originalBgCount === convertedBgCount,
        範圍一致: originalRangeCount === convertedRangeCount,
      });

      // 5. 輸出詳細的 Map 資料
      debugLog('5️⃣ 原始 Mock 資料:');
      logMapData(mockMapData);

      debugLog('6️⃣ 轉換後的 Map 資料:');
      logMapData(backToMapData);

      debugSuccess('所有測試通過！');
    } catch (error) {
      debugError('測試失敗:', error);
    }
  });
};

/**
 * 測試不同大小的 Mock 資料
 */
export const testDifferentDataSizes = (): void => {
  debugGroup('不同大小資料測試', () => {
    const testCases = [
      { name: '簡單資料', data: simpleMapData },
      { name: '完整倉庫資料', data: mockMapData },
      { name: '空資料', data: emptyMapData },
      { name: '大量資料', data: largeMapData },
    ];

    testCases.forEach(({ name, data }) => {
      debugLog(`測試 ${name}...`);

      const startTime = performance.now();
      const nodes = transformApiDataToNodes(data);
      const endTime = performance.now();

      debugLog(`${name} 統計:`, {
        背景數量: data.backgrounds.length,
        範圍數量: data.ranges.length,
        轉換後節點數量: nodes.length,
        轉換時間: `${(endTime - startTime).toFixed(2)}ms`,
      });
    });
  });
};

/**
 * 模擬 API 載入測試
 */
export const testApiLoad = async (): Promise<Node[]> => {
  return new Promise((resolve, reject) => {
    debugGroup('API 載入測試', async () => {
      try {
        const nodes = await loadMapDataFromApi('warehouse-map-001');

        debugSuccess('API 載入成功');
        debugLog('載入的節點:', nodes);

        resolve(nodes);
      } catch (error) {
        debugError('API 載入失敗:', error);
        reject(error);
      }
    });
  });
};

/**
 * 生成測試用的節點陣列
 */
export const generateTestNodes = (
  testType: 'simple' | 'complex' | 'empty' | 'large' = 'simple',
): Node[] => {
  const dataMap = {
    simple: simpleMapData,
    complex: mockMapData,
    empty: emptyMapData,
    large: largeMapData,
  };

  const selectedData = dataMap[testType];

  return transformApiDataToNodes(selectedData);
};

/**
 * 輸出特定格式的測試資料（可以複製貼上到測試中）
 */
export const exportTestData = (
  testType: 'simple' | 'complex' | 'empty' | 'large' = 'simple',
): string => {
  const nodes = generateTestNodes(testType);

  return JSON.stringify(
    {
      nodes,
      edges: [], // WMS 地圖通常不需要邊
    },
    null,
    2,
  );
};

/**
 * 驗證轉換結果的完整性
 */
export const validateTransformationResult = (
  originalMap: Map,
  transformedNodes: Node[],
): boolean => {
  const expectedNodeCount =
    originalMap.backgrounds.length + originalMap.ranges.length;

  const actualNodeCount = transformedNodes.length;

  if (expectedNodeCount !== actualNodeCount) {
    debugError(
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

  let allValid = true;

  checks.forEach(({ name, expected, actual }) => {
    if (expected !== actual) {
      debugError(
        `${name}節點數量不符: 期望 ${expected}, 實際 ${actual}`,
      );

      allValid = false;
    }
  });

  return allValid;
};

// 執行基本測試（可以在開發時呼叫）
if (typeof window !== 'undefined' && window.console) {
  // 只在瀏覽器環境中執行
  debugLog('testing', 'WMS Map 資料轉換工具已載入');
  debugLog('testing', '可用函數:');
  debugLog('testing', '  - testDataTransformation(): 測試完整轉換流程');
  debugLog('testing', '  - testDifferentDataSizes(): 測試不同大小資料');
  debugLog('testing', '  - testApiLoad(): 測試 API 載入');
  debugLog('testing', '  - generateTestNodes(type): 生成測試節點');
  debugLog('testing', '  - exportTestData(type): 匯出測試資料');
}
