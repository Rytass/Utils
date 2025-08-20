import React, { useState } from 'react';
import WmsMapModal from '../src/WmsMapModal';
import { transformApiDataToNodes } from '../src/utils/apiDataTransform';
import {
  mockMapData,
  simpleMapData,
  largeMapData,
} from '../src/utils/mockData';
import { ViewMode, Map } from '../typings';
import { debugLog, debugSuccess, debugError } from '../src/utils/debugLogger';
import { TEXT_MAPPINGS } from '../src/constants';

/**
 * WmsMapModal 綜合測試組件
 * 用於測試：
 * 1. Mock data 載入和顯示
 * 2. 動態資料切換功能
 * 3. 節點狀態規則驗證
 * 4. Breadcrumb 互動功能
 * 5. 儲存功能回調
 * 6. 歷史記錄管理功能 (Undo/Redo)
 * 7. 測試操作自動記錄與追蹤
 */
const MockDataTest: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentNodes, setCurrentNodes] = useState<any[]>([]);
  const [currentTestType, setCurrentTestType] = useState<string>('');
  const [testSteps, setTestSteps] = useState<string[]>([]);

  // 添加測試步驟記錄
  const addTestStep = (step: string) => {
    setTestSteps((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${step}`,
    ]);
  };

  // 載入不同類型的測試資料
  const loadTestData = (type: 'simple' | 'complex' | 'large') => {
    let testData;
    let typeName;

    switch (type) {
      case 'simple':
        testData = simpleMapData;
        typeName = TEXT_MAPPINGS.TEST_MESSAGES.SIMPLE_TEST_DATA;
        break;
      case 'complex':
        testData = mockMapData;
        typeName = TEXT_MAPPINGS.TEST_MESSAGES.COMPLEX_WAREHOUSE_DATA;
        break;
      case 'large':
        testData = largeMapData;
        typeName = TEXT_MAPPINGS.TEST_MESSAGES.LARGE_TEST_DATA;
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
      addTestStep(`${TEXT_MAPPINGS.TEST_MESSAGES.LOAD_SUCCESS} ${typeName} (${nodes.length} ${TEXT_MAPPINGS.FORMATTERS.NODES_UNIT})`);

      if (!isModalOpen) {
        setIsModalOpen(true);
        addTestStep(TEXT_MAPPINGS.TEST_MESSAGES.OPEN_MODAL);
      }
    } catch (error) {
      debugError('testing', `載入 ${typeName} 失敗: ${error}`);
      alert(`載入失敗: ${error}`);
    }
  };

  // 處理節點點擊事件
  const handleNodeClick = (nodeInfo: any) => {
    debugLog('節點點擊事件:', nodeInfo);
  };

  // 處理儲存事件
  const handleSave = (mapData: Map) => {
    debugLog('儲存事件觸發，接收到的資料:', mapData);
    addTestStep(
      `儲存資料 - 背景: ${mapData.backgrounds.length}, 範圍: ${mapData.ranges.length}`,
    );

    alert(
      `儲存成功！接收到 ${mapData.backgrounds.length} 個背景圖片和 ${mapData.ranges.length} 個範圍資料`,
    );
  };

  // 處理 breadcrumb 點擊事件
  const handleBreadcrumbClick = (warehouseId: string, index: number) => {
    debugLog('Breadcrumb 點擊事件:', { warehouseId, index });
    addTestStep(`點擊 breadcrumb: ${warehouseId} (索引: ${index})`);

    // 根據不同的 warehouseId 載入不同的測試資料
    let testData;
    let typeName;

    switch (warehouseId) {
      case '10001':
        testData = simpleMapData;
        typeName = '簡單測試資料 (Warehouse 10001)';
        break;
      case '10001A':
        testData = mockMapData;
        typeName = '完整倉庫資料 (Warehouse 10001A)';
        break;
      case '10002':
        testData = largeMapData;
        typeName = '大量測試資料 (Warehouse 10002)';
        break;
      default:
        // 其他 warehouse 使用簡單資料
        testData = simpleMapData;
        typeName = `預設測試資料 (Warehouse ${warehouseId})`;
        break;
    }

    try {
      // 轉換 API 資料為 React Flow 節點
      const nodes = transformApiDataToNodes(testData);

      debugSuccess('breadcrumb 觸發載入:', {
        warehouseId,
        index,
        資料類型: typeName,
        轉換後節點數: nodes.length,
      });

      setCurrentNodes(nodes);
      setCurrentTestType(typeName);

      if (!isModalOpen) {
        setIsModalOpen(true);
        addTestStep('透過 breadcrumb 開啟 Modal');
      }

      alert(`已載入 ${typeName}！包含 ${nodes.length} 個節點`);
    } catch (error) {
      debugError('breadcrumb 載入失敗:', error);
      alert(`載入失敗: ${error}`);
    }
  };

  // 關閉 Modal
  const handleClose = () => {
    setIsModalOpen(false);
    setCurrentNodes([]);
    setCurrentTestType('');
    addTestStep('關閉 Modal');
  };

  // 清空測試記錄
  const clearTestSteps = () => {
    setTestSteps([]);
    addTestStep('清空測試記錄');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>WMS Map Modal - 綜合功能測試</h1>

      <div style={{ marginBottom: '20px' }}>
        <h2>測試資料載入與動態切換</h2>
        <p>
          點擊下方按鈕載入不同的測試資料到 WmsMapModal 中，也可以在 Modal
          開啟狀態下動態切換：
        </p>

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

          <button
            onClick={clearTestSteps}
            style={{
              padding: '10px 20px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            清空測試記錄
            <br />
            <small>(重置記錄)</small>
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
            <strong>按鈕載入:</strong> 使用上方按鈕可手動載入不同的測試資料
          </li>
          <li>
            <strong>動態載入:</strong> Modal
            開啟狀態下點擊不同按鈕，測試資料動態切換功能
          </li>
          <li>
            <strong>歷史記錄測試:</strong> 載入資料後進行編輯操作，測試
            Undo/Redo 功能是否正常
          </li>
          <li>
            <strong>Breadcrumb 載入:</strong> 點擊 Modal 內的 breadcrumb
            路徑可自動載入對應資料：
            <ul>
              <li>10001 → 簡單測試資料</li>
              <li>10001A → 完整倉庫資料</li>
              <li>10002 → 大量測試資料</li>
              <li>其他 → 預設簡單資料</li>
            </ul>
          </li>
          <li>
            <strong>模式測試:</strong> 切換檢視模式/編輯模式，測試節點狀態規則
          </li>
          <li>
            <strong>圖層測試:</strong>{' '}
            在編輯模式下切換底圖/圖層模式，驗證節點互動限制
          </li>
          <li>
            <strong>互動測試:</strong>
            <ul>
              <li>點擊節點會在 console 輸出詳細資訊</li>
              <li>儲存功能會觸發 alert 和 console 輸出</li>
              <li>Breadcrumb 點擊會自動載入對應測試資料</li>
            </ul>
          </li>
        </ul>

        <h4>📋 狀態規則驗證清單</h4>
        <ul>
          <li>
            <strong>檢視模式:</strong> 所有節點都不可選取、不可拖曳、不可刪除
          </li>
          <li>
            <strong>編輯模式 - 底圖:</strong>{' '}
            只有底圖節點(圖片)可選取拖曳，圖層節點不可互動
          </li>
          <li>
            <strong>編輯模式 - 圖層:</strong>{' '}
            只有圖層節點(矩形/路徑)可選取拖曳，底圖節點不可互動
          </li>
          <li>
            <strong>刪除權限:</strong> 只有路徑節點在圖層模式下可刪除
          </li>
        </ul>

        <h4>🎯 預期行為</h4>
        <ul>
          <li>每次載入新資料時，節點狀態會立即套用當前模式的規則</li>
          <li>模式切換時，所有節點狀態會重新計算</li>
          <li>Console 會顯示詳細的節點狀態統計資訊</li>
          <li>動態載入不會出現新舊資料混合或狀態錯誤的情況</li>
          <li>載入新資料後，歷史記錄系統會重新初始化並正常工作</li>
          <li>編輯操作會被正確記錄，Undo/Redo 按鈕狀態正確更新</li>
        </ul>

        <h4>📋 歷史記錄測試步驟</h4>
        <ol>
          <li>
            <strong>載入資料:</strong> 點擊載入按鈕開啟 Modal
          </li>
          <li>
            <strong>進行編輯:</strong> 移動節點、編輯文字、繪製圖形等
          </li>
          <li>
            <strong>測試 Undo:</strong> 使用 Cmd+Z 或工具列 Undo 按鈕
          </li>
          <li>
            <strong>測試 Redo:</strong> 使用 Cmd+Shift+Z 或工具列 Redo 按鈕
          </li>
          <li>
            <strong>動態切換:</strong> 在有編輯歷史時載入其他資料
          </li>
          <li>
            <strong>重複測試:</strong> 確認新資料也有正確的歷史記錄功能
          </li>
        </ol>
      </div>

      <div
        style={{
          padding: '15px',
          backgroundColor: '#f0fdf4',
          borderRadius: '8px',
          marginBottom: '20px',
        }}
      >
        <h3>📋 測試記錄與歷史追蹤</h3>
        <div
          style={{
            maxHeight: '200px',
            overflowY: 'auto',
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #d1d5db',
          }}
        >
          {testSteps.length === 0 ? (
            <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
              尚無測試記錄 - 開始進行測試操作
            </p>
          ) : (
            testSteps.map((step, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '5px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  color: '#374151',
                }}
              >
                {step}
              </div>
            ))
          )}
        </div>
        <p style={{ marginTop: '10px', fontSize: '14px', color: '#6b7280' }}>
          💡 此記錄會自動追蹤您的測試操作，包括資料載入、Modal 開關、breadcrumb
          點擊等，便於驗證歷史記錄功能是否正常。
        </p>
      </div>

      {/* WmsMapModal */}
      {isModalOpen && (
        <WmsMapModal
          open={isModalOpen}
          onClose={handleClose}
          viewMode={ViewMode.EDIT} // 預設為編輯模式以便測試歷史記錄功能
          colorPalette={[
            '#3b82f6',
            '#ef4444',
            '#22c55e',
            '#f59e0b',
            '#8b5cf6',
            '#06b6d4',
          ]}
          onNodeClick={handleNodeClick}
          onSave={handleSave}
          onBreadcrumbClick={handleBreadcrumbClick}
          initialNodes={currentNodes}
          initialEdges={[]} // WMS 地圖通常不需要邊
          debugMode={true} // 啟用 debug 模式以便查看 console 輸出
        />
      )}
    </div>
  );
};

export default MockDataTest;
