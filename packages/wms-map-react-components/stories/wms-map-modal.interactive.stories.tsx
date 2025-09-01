import React, { useState, useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { WMSMapModal, ViewMode } from '../src';
import {
  generateStoryNodes,
  convertToFlowNodes,
  getAvailableDataTypes,
} from './story-utils';
import type { Map, WMSNodeClickInfo } from '../src/typings';
import '@xyflow/react/dist/style.css';

/**
 * 互動式測試組件，提供完整的測試功能
 */
const InteractiveWMSMapModal: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentNodes, setCurrentNodes] = useState<any[]>([]);
  const [currentTestType, setCurrentTestType] = useState<string>('');
  const [testSteps, setTestSteps] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.EDIT);

  // 添加測試步驟記錄
  const addTestStep = useCallback((step: string) => {
    setTestSteps((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${step}`,
    ]);
  }, []);

  // 載入不同類型的測試資料
  const loadTestData = useCallback(
    (type: 'simple' | 'complex' | 'empty' | 'large' | 'polygons') => {
      const dataTypes = getAvailableDataTypes();
      const selectedType = dataTypes[type];

      if (!selectedType) return;

      try {
        const nodes = generateStoryNodes(type);

        action('loadTestData')({ type, nodeCount: nodes.length });

        setCurrentNodes(nodes);
        setCurrentTestType(selectedType.name);
        addTestStep(`載入成功: ${selectedType.name} (${nodes.length} 個節點)`);

        if (!isModalOpen) {
          setIsModalOpen(true);
          addTestStep('開啟 Modal');
        }
      } catch (error) {
        console.error(`載入 ${selectedType.name} 失敗:`, error);
        addTestStep(`載入失敗: ${error}`);
      }
    },
    [isModalOpen, addTestStep],
  );

  // 處理節點點擊事件
  const handleNodeClick = useCallback(
    (nodeInfo: WMSNodeClickInfo) => {
      action('onNodeClick')(nodeInfo);
      addTestStep(`點擊節點: ${nodeInfo.id} (類型: ${nodeInfo.type})`);
    },
    [addTestStep],
  );

  // 處理儲存事件
  const handleSave = useCallback(
    (mapData: Map) => {
      action('onSave')(mapData);
      addTestStep(
        `儲存資料 - 背景: ${mapData.backgrounds.length}, 範圍: ${mapData.ranges.length}`,
      );
    },
    [addTestStep],
  );

  // 處理 breadcrumb 點擊事件
  const handleBreadcrumbClick = useCallback(
    (warehouseId: string, index: number) => {
      action('onBreadcrumbClick')({ warehouseId, index });
      addTestStep(`點擊 breadcrumb: ${warehouseId} (索引: ${index})`);

      // 根據不同的 warehouseId 載入不同的測試資料
      const warehouseMapping: Record<string, 'simple' | 'complex' | 'large'> = {
        10001: 'simple',
        '10001A': 'complex',
        10002: 'large',
      };

      const testType = warehouseMapping[warehouseId] || 'simple';

      loadTestData(testType);
    },
    [addTestStep, loadTestData],
  );

  // 處理倉庫名稱編輯事件
  const handleWarehouseNameEdit = useCallback(
    (warehouseId: string, newName: string, index: number) => {
      action('onWarehouseNameEdit')({ warehouseId, newName, index });
      addTestStep(`編輯倉庫名稱: ${warehouseId} → ${newName} (索引: ${index})`);
    },
    [addTestStep],
  );

  // 關閉 Modal
  const handleClose = useCallback(() => {
    action('onClose')();
    setIsModalOpen(false);
    setCurrentNodes([]);
    setCurrentTestType('');
    addTestStep('關閉 Modal');
  }, [addTestStep]);

  // 清空測試記錄
  const clearTestSteps = useCallback(() => {
    setTestSteps([]);
    addTestStep('清空測試記錄');
  }, [addTestStep]);

  // 切換檢視模式
  const toggleViewMode = useCallback(() => {
    const newMode = viewMode === ViewMode.EDIT ? ViewMode.VIEW : ViewMode.EDIT;

    setViewMode(newMode);
    addTestStep(
      `切換模式: ${newMode === ViewMode.EDIT ? '編輯模式' : '檢視模式'}`,
    );
  }, [viewMode, addTestStep]);

  const dataTypes = getAvailableDataTypes();

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>WMS Map Modal - 互動式測試</h1>

      <div style={{ marginBottom: '20px' }}>
        <h2>測試控制面板</h2>
        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}
        >
          {Object.entries(dataTypes).map(([type, info]) => (
            <button
              key={type}
              onClick={() => loadTestData(type as any)}
              style={{
                padding: '10px 15px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {info.name}
              <br />
              <small>({info.description})</small>
            </button>
          ))}

          <button
            onClick={toggleViewMode}
            style={{
              padding: '10px 15px',
              backgroundColor:
                viewMode === ViewMode.EDIT ? '#22c55e' : '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            切換模式
            <br />
            <small>
              ({viewMode === ViewMode.EDIT ? '編輯模式' : '檢視模式'})
            </small>
          </button>

          <button
            onClick={clearTestSteps}
            style={{
              padding: '10px 15px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            清空記錄
            <br />
            <small>(重置)</small>
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
          <p>
            <strong>當前模式:</strong>{' '}
            {viewMode === ViewMode.EDIT ? '編輯模式' : '檢視模式'}
          </p>
        </div>
      )}

      <div
        style={{
          padding: '15px',
          backgroundColor: '#eff6ff',
          borderRadius: '8px',
          border: '1px solid #bfdbfe',
          marginBottom: '20px',
        }}
      >
        <h3>💡 測試說明</h3>
        <ul>
          <li>
            <strong>資料載入:</strong> 使用上方按鈕載入不同測試資料
          </li>
          <li>
            <strong>模式切換:</strong> 測試編輯模式和檢視模式的不同行為
          </li>
          <li>
            <strong>Breadcrumb 測試:</strong> 點擊 Modal 內的 breadcrumb
            會自動載入對應資料
          </li>
          <li>
            <strong>節點互動:</strong> 點擊節點查看 Actions 面板的輸出
          </li>
          <li>
            <strong>儲存功能:</strong> 使用儲存按鈕測試回調功能
          </li>
          <li>
            <strong>歷史記錄:</strong> 進行編輯操作後測試 Undo/Redo 功能
          </li>
        </ul>
      </div>

      <div
        style={{
          padding: '15px',
          backgroundColor: '#f0fdf4',
          borderRadius: '8px',
          marginBottom: '20px',
        }}
      >
        <h3>📋 測試記錄</h3>
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
      </div>

      {/* WMS Map Modal */}
      {isModalOpen && (
        <WMSMapModal
          open={isModalOpen}
          onClose={handleClose}
          viewMode={viewMode}
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
          onWarehouseNameEdit={handleWarehouseNameEdit}
          initialNodes={convertToFlowNodes(currentNodes)}
          initialEdges={[]}
          debugMode={true}
          title={`互動式測試 - ${currentTestType}`}
        />
      )}
    </div>
  );
};

// Storybook 設定
const meta: Meta<typeof InteractiveWMSMapModal> = {
  title: 'WMS Map Components/Interactive Testing',
  component: InteractiveWMSMapModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '互動式測試環境，提供完整的 WMS Map Modal 功能測試，包括動態資料載入、模式切換、節點互動和測試記錄追蹤。',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const InteractiveTest: Story = {
  render: () => <InteractiveWMSMapModal />,
  parameters: {
    docs: {
      description: {
        story:
          '完整的互動式測試環境，可以測試 WMS Map Modal 的所有功能，包括資料載入、模式切換、breadcrumb 互動等。點擊不同按鈕來測試各種功能。',
      },
    },
  },
};
