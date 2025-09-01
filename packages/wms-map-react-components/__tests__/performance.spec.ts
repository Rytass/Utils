/**
 * @jest-environment node
 */

import {
  mockMapData,
  simpleMapData,
  emptyMapData,
  largeMapData,
} from '../stories/mock-data';
import { transformApiDataToNodes } from '../src/utils/api-data-transform';
import { generateMockImageUrl } from '../stories/mock-image-utils';

describe('Performance Tests', () => {
  const testCases = [
    {
      name: '簡單資料',
      data: simpleMapData,
      maxTransformTime: 100, // ms
    },
    {
      name: '完整倉庫資料',
      data: mockMapData,
      maxTransformTime: 200, // ms
    },
    {
      name: '空資料',
      data: emptyMapData,
      maxTransformTime: 50, // ms
    },
    {
      name: '大量資料',
      data: largeMapData,
      maxTransformTime: 1000, // ms
    },
  ];

  describe('Data Transformation Performance', () => {
    testCases.forEach(({ name, data, maxTransformTime }) => {
      it(`should transform ${name} within acceptable time limit`, () => {
        const startTime = performance.now();
        const nodes = transformApiDataToNodes(data, generateMockImageUrl);
        const endTime = performance.now();

        const transformTime = endTime - startTime;

        // 驗證轉換結果
        expect(Array.isArray(nodes)).toBe(true);
        expect(nodes.length).toBe(data.backgrounds.length + data.ranges.length);

        // 驗證性能
        expect(transformTime).toBeLessThan(maxTransformTime);

        // 輸出統計資訊供參考
        console.log(`${name} 統計:`, {
          背景數量: data.backgrounds.length,
          範圍數量: data.ranges.length,
          轉換後節點數量: nodes.length,
          轉換時間: `${transformTime.toFixed(2)}ms`,
        });
      });
    });
  });

  describe('Memory Usage Tests', () => {
    it('should handle large datasets without excessive memory usage', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 轉換大量資料
      const nodes = transformApiDataToNodes(largeMapData, generateMockImageUrl);

      const afterTransformMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterTransformMemory - initialMemory;

      // 驗證結果
      expect(nodes.length).toBe(
        largeMapData.backgrounds.length + largeMapData.ranges.length,
      );

      // 記憶體使用量不應超過 50MB (這是一個合理的上限)
      const maxMemoryIncrease = 50 * 1024 * 1024; // 50MB in bytes

      expect(memoryIncrease).toBeLessThan(maxMemoryIncrease);

      console.log('Memory usage:', {
        初始記憶體: `${(initialMemory / 1024 / 1024).toFixed(2)}MB`,
        轉換後記憶體: `${(afterTransformMemory / 1024 / 1024).toFixed(2)}MB`,
        記憶體增量: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
      });
    });
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with data size', () => {
      const sizes = [
        { data: simpleMapData, expectedSize: 'small' },
        { data: mockMapData, expectedSize: 'medium' },
        { data: largeMapData, expectedSize: 'large' },
      ];

      const results = sizes.map(({ data, expectedSize }) => {
        const startTime = performance.now();
        const nodes = transformApiDataToNodes(data, generateMockImageUrl);
        const endTime = performance.now();

        return {
          size: expectedSize,
          inputCount: data.backgrounds.length + data.ranges.length,
          outputCount: nodes.length,
          transformTime: endTime - startTime,
        };
      });

      // 驗證輸入和輸出一致性
      results.forEach(({ inputCount, outputCount }) => {
        expect(outputCount).toBe(inputCount);
      });

      // 驗證時間複雜度大致為線性
      const smallResult = results[0];
      const largeResult = results[2];

      // 大資料集的時間不應該超過小資料集時間的合理倍數
      const sizeRatio = largeResult.inputCount / smallResult.inputCount;
      const timeRatio = largeResult.transformTime / smallResult.transformTime;

      // 時間比例不應該超過大小比例的 3 倍 (允許一些非線性開銷)
      expect(timeRatio).toBeLessThan(sizeRatio * 3);

      console.log('Scalability results:', results);
    });
  });

  describe('Edge Cases Performance', () => {
    it('should handle empty data quickly', () => {
      const startTime = performance.now();
      const nodes = transformApiDataToNodes(emptyMapData, generateMockImageUrl);
      const endTime = performance.now();

      const transformTime = endTime - startTime;

      expect(nodes).toEqual([]);
      expect(transformTime).toBeLessThan(10); // 空資料應該很快處理
    });

    it('should handle repeated transformations consistently', () => {
      const warmupIterations = 3;
      const iterations = 10;

      // Warm-up iterations using functional approach
      const performWarmup = () =>
        transformApiDataToNodes(mockMapData, generateMockImageUrl);
      Array.from({ length: warmupIterations }, performWarmup);

      // Performance measurements using functional approach
      const measurePerformance = () => {
        const startTime = performance.now();
        transformApiDataToNodes(mockMapData, generateMockImageUrl);
        const endTime = performance.now();
        return endTime - startTime;
      };

      const times = Array.from({ length: iterations }, measurePerformance);

      const avgTime = times.reduce((sum, time) => sum + time, 0) / iterations;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      // 性能應該相對穩定，但由於 JIT 編譯和系統負載，允許更大的變異範圍
      expect(maxTime / minTime).toBeLessThan(15);

      console.log('Repeated transformation stats:', {
        平均時間: `${avgTime.toFixed(2)}ms`,
        最短時間: `${minTime.toFixed(2)}ms`,
        最長時間: `${maxTime.toFixed(2)}ms`,
        執行次數: iterations,
      });
    });
  });
});
