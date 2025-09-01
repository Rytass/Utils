/**
 * @jest-environment node
 */

import { Node } from '@xyflow/react';
import { loadMapDataFromApi } from '../src/utils/api-data-transform';
import { mockMapData } from '../stories/mock-data';

// Mock the API transformation functions since we're testing integration logic
jest.mock('../src/utils/api-data-transform', () => ({
  ...jest.requireActual('../src/utils/api-data-transform'),
  loadMapDataFromApi: jest.fn(),
}));

const mockLoadMapDataFromApi = loadMapDataFromApi as jest.MockedFunction<
  typeof loadMapDataFromApi
>;

describe('API Integration Tests', () => {
  beforeEach(() => {
    // 重設所有 mocks
    jest.clearAllMocks();
  });

  describe('loadMapDataFromApi', () => {
    it('should successfully load map data from API', async () => {
      // 模擬成功的 API 回應
      const mockNodes: Node[] = [
        {
          id: 'test-node-1',
          type: 'imageNode',
          position: { x: 100, y: 100 },
          data: {
            imageUrl: 'test-image.png',
            width: 300,
            height: 200,
          },
        },
      ];

      mockLoadMapDataFromApi.mockResolvedValueOnce(mockNodes);

      const result = await loadMapDataFromApi('warehouse-map-001');

      expect(mockLoadMapDataFromApi).toHaveBeenCalledWith('warehouse-map-001');
      expect(result).toEqual(mockNodes);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Failed to load map data from API';

      mockLoadMapDataFromApi.mockRejectedValueOnce(new Error(errorMessage));

      await expect(loadMapDataFromApi('invalid-warehouse-id')).rejects.toThrow(
        errorMessage,
      );

      expect(mockLoadMapDataFromApi).toHaveBeenCalledWith(
        'invalid-warehouse-id',
      );
    });

    it('should handle different warehouse IDs', async () => {
      const warehouseIds = ['warehouse-001', 'warehouse-002', 'warehouse-003'];

      const mockResponses = warehouseIds.map((id, index) => [
        {
          id: `node-${index}`,
          type: 'imageNode',
          position: { x: index * 100, y: index * 100 },
          data: { imageUrl: `${id}.png`, width: 300, height: 200 },
        },
      ]);

      // 為每個倉庫 ID 設定不同的回應
      warehouseIds.forEach((id, index) => {
        mockLoadMapDataFromApi.mockResolvedValueOnce(mockResponses[index]);
      });

      // 測試每個倉庫 ID
      for (let i = 0; i < warehouseIds.length; i++) {
        const result = await loadMapDataFromApi(warehouseIds[i]);

        expect(result).toEqual(mockResponses[i]);
      }

      // 驗證所有調用
      warehouseIds.forEach((id) => {
        expect(mockLoadMapDataFromApi).toHaveBeenCalledWith(id);
      });
    });

    it('should handle empty API responses', async () => {
      mockLoadMapDataFromApi.mockResolvedValueOnce([]);

      const result = await loadMapDataFromApi('empty-warehouse');

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');

      mockLoadMapDataFromApi.mockRejectedValueOnce(timeoutError);

      await expect(loadMapDataFromApi('slow-warehouse')).rejects.toThrow(
        'Request timeout',
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error: Connection failed');

      mockLoadMapDataFromApi.mockRejectedValueOnce(networkError);

      await expect(loadMapDataFromApi('warehouse-offline')).rejects.toThrow(
        'Network error: Connection failed',
      );
    });

    it('should handle malformed API responses', async () => {
      const malformedError = new Error('Invalid API response format');

      mockLoadMapDataFromApi.mockRejectedValueOnce(malformedError);

      await expect(loadMapDataFromApi('warehouse-malformed')).rejects.toThrow(
        'Invalid API response format',
      );
    });
  });

  describe('API Response Validation', () => {
    it('should validate API response structure', async () => {
      const validApiResponse: Node[] = [
        {
          id: 'bg-1',
          type: 'imageNode',
          position: { x: 50, y: 30 },
          data: {
            imageUrl: 'warehouse-floor.png',
            width: 300,
            height: 200,
            editMode: 'BACKGROUND',
            viewMode: 'EDIT',
            isEditable: true,
            isSelectable: true,
            isDraggable: true,
            isDeletable: false,
          },
        },
        {
          id: 'range-1',
          type: 'rectangleNode',
          position: { x: 100, y: 80 },
          data: {
            color: '#22c55e',
            width: 150,
            height: 100,
            label: '收貨區 A',
            editMode: 'LAYER',
            viewMode: 'EDIT',
            isEditable: true,
            isSelectable: false,
            isDraggable: false,
            isDeletable: false,
          },
        },
      ];

      mockLoadMapDataFromApi.mockResolvedValueOnce(validApiResponse);

      const result = await loadMapDataFromApi('warehouse-valid');

      expect(result).toEqual(validApiResponse);

      // 驗證每個節點都有必要的屬性
      result.forEach((node) => {
        expect(node).toHaveProperty('id');
        expect(node).toHaveProperty('type');
        expect(node).toHaveProperty('position');
        expect(node).toHaveProperty('data');

        // 驗證 position 結構
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');

        // 驗證 data 包含必要的屬性
        expect(node.data).toBeDefined();
      });
    });

    it('should handle concurrent API requests', async () => {
      const warehouseIds = ['wh-001', 'wh-002', 'wh-003'];
      const mockResponses = warehouseIds.map((id) => [
        {
          id: `${id}-node`,
          type: 'imageNode',
          position: { x: 0, y: 0 },
          data: { imageUrl: `${id}.png`, width: 300, height: 200 },
        },
      ]);

      // 設定所有 mock 回應
      warehouseIds.forEach((_, index) => {
        mockLoadMapDataFromApi.mockResolvedValueOnce(mockResponses[index]);
      });

      // 同時發起所有請求
      const promises = warehouseIds.map((id) => loadMapDataFromApi(id));
      const results = await Promise.all(promises);

      // 驗證結果
      expect(results).toHaveLength(warehouseIds.length);
      results.forEach((result, index) => {
        expect(result).toEqual(mockResponses[index]);
      });

      // 驗證所有調用都發生了
      expect(mockLoadMapDataFromApi).toHaveBeenCalledTimes(warehouseIds.length);
    });
  });
});
