import React, { useState } from 'react';
import WmsMapModal from '../src/WmsMapModal';
import { transformApiDataToNodes } from '../src/utils/apiDataTransform';
import {
  mockMapData,
  simpleMapData,
  largeMapData,
} from '../src/utils/mockData';
import { ViewMode } from '../typings';
import { debugLog, debugSuccess, debugError } from '../src/utils/debugLogger';

/**
 * Mock Data 測試組件
 * 用於測試 WmsMapModal 是否能正確載入和顯示 mock data
 */
const MockDataTest: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentNodes, setCurrentNodes] = useState<any[]>([]);
  const [currentTestType, setCurrentTestType] = useState<string>('');

  // 載入不同類型的測試資料
  const loadTestData = (type: 'simple' | 'complex' | 'large') => {
    let testData;
    let typeName;

    switch (type) {
      case 'simple':
        testData = simpleMapData;
        typeName = '簡單測試資料';
        break;
      case 'complex':
        testData = mockMapData;
        typeName = '完整倉庫資料';
        break;
      case 'large':
        testData = largeMapData;
        typeName = '大量測試資料';
        break;
      default:
        return;
    }

    try {
      // 轉換 API 資料為 React Flow 節點
      const nodes = transformApiDataToNodes(testData);

      debugSuccess('testing', `載入 ${typeName}:`, {
        原始資料: testData,
        轉換後節點: nodes,
        節點統計: {
          總數: nodes.length,
          背景圖片: nodes.filter((n) => n.type === 'imageNode').length,
          矩形區域: nodes.filter((n) => n.type === 'rectangleNode').length,
          多邊形區域: nodes.filter((n) => n.type === 'pathNode').length,
        },
      });

      setCurrentNodes(nodes);
      setCurrentTestType(typeName);
      setIsModalOpen(true);
    } catch (error) {
      debugError('testing', `載入 ${typeName} 失敗:`, error);
      alert(`載入失敗: ${error}`);
    }
  };

  // 處理節點點擊事件
  const handleNodeClick = (nodeInfo: any) => {
    debugLog('events', '節點點擊事件:', nodeInfo);
  };

  // 關閉 Modal
  const handleClose = () => {
    setIsModalOpen(false);
    setCurrentNodes([]);
    setCurrentTestType('');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>WMS Map Modal - Mock Data 測試</h1>

      <div style={{ marginBottom: '20px' }}>
        <h2>測試資料載入</h2>
        <p>點擊下方按鈕載入不同的測試資料到 WmsMapModal 中：</p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => loadTestData('simple')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            簡單測試資料
            <br />
            <small>(1個背景 + 2個區域)</small>
          </button>

          <button
            onClick={() => loadTestData('complex')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            完整倉庫資料
            <br />
            <small>(2個背景 + 8個區域)</small>
          </button>

          <button
            onClick={() => loadTestData('large')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            大量測試資料
            <br />
            <small>(5個背景 + 30個區域)</small>
          </button>
        </div>
      </div>

      {currentNodes.length > 0 && (
        <div
          style={{
            marginBottom: '20px',
            padding: '15px',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
          }}
        >
          <h3>📊 當前載入的資料統計</h3>
          <p>
            <strong>測試類型:</strong> {currentTestType}
          </p>
          <p>
            <strong>節點總數:</strong> {currentNodes.length}
          </p>
          <p>
            <strong>背景圖片:</strong>{' '}
            {currentNodes.filter((n) => n.type === 'imageNode').length}
          </p>
          <p>
            <strong>矩形區域:</strong>{' '}
            {currentNodes.filter((n) => n.type === 'rectangleNode').length}
          </p>
          <p>
            <strong>多邊形區域:</strong>{' '}
            {currentNodes.filter((n) => n.type === 'pathNode').length}
          </p>

          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              🔍 查看節點詳細資料 (點擊展開)
            </summary>
            <pre
              style={{
                backgroundColor: 'white',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '300px',
                marginTop: '10px',
              }}
            >
              {JSON.stringify(currentNodes, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <div
        style={{
          padding: '15px',
          backgroundColor: '#eff6ff',
          borderRadius: '8px',
          border: '1px solid #bfdbfe',
        }}
      >
        <h3>💡 測試說明</h3>
        <ul>
          <li>
            <strong>簡單測試資料:</strong> 適合基本功能驗證，包含最基本的元素
          </li>
          <li>
            <strong>完整倉庫資料:</strong>{' '}
            模擬真實倉庫的複雜佈局，包含多種形狀和區域
          </li>
          <li>
            <strong>大量測試資料:</strong> 用於性能測試，包含大量節點
          </li>
          <li>
            <strong>檢視模式:</strong> Modal
            預設為檢視模式，可以測試底圖顯示切換功能
          </li>
          <li>
            <strong>點擊測試:</strong> 點擊任何區域或背景，會在 console
            輸出點擊資訊
          </li>
        </ul>
      </div>

      {/* WmsMapModal */}
      {isModalOpen && (
        <WmsMapModal
          open={isModalOpen}
          onClose={handleClose}
          viewMode={ViewMode.VIEW} // 預設為檢視模式以測試所有功能
          colorPalette={[
            '#3b82f6',
            '#ef4444',
            '#22c55e',
            '#f59e0b',
            '#8b5cf6',
            '#06b6d4',
          ]}
          onNodeClick={handleNodeClick}
          initialNodes={currentNodes}
          initialEdges={[]} // WMS 地圖通常不需要邊
          debugMode={true} // 啟用 debug 模式以便查看 console 輸出
        />
      )}
    </div>
  );
};

export default MockDataTest;
