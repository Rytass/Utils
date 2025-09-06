import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { WMSMapModal, ViewMode } from '../src';
import { generateStoryNodes, convertToFlowNodes } from './story-utils';
import '@xyflow/react/dist/style.css';

// Story wrapper component for managing warehouseIds state
const WMSMapModalWrapper: React.FC<any> = props => {
  const [warehouseIds, setWarehouseIds] = useState<string[]>(props.warehouseIds || []);

  const handleNameChange = async (name: string): Promise<void> => {
    console.log('模擬名稱變更:', name);
    // 模擬 API 調用延遲
    await new Promise(resolve => setTimeout(resolve, 500));

    // 更新最後一筆 warehouseId
    setWarehouseIds(prev => {
      const newIds = [...prev];

      if (newIds.length > 0) {
        newIds[newIds.length - 1] = name;
      }

      return newIds;
    });

    action('onNameChange')(name);
  };

  console.log({ warehouseIds });

  return <WMSMapModal {...props} warehouseIds={warehouseIds} onNameChange={handleNameChange} />;
};

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta: Meta<typeof WMSMapModal> = {
  title: 'WMS Map Components/WMSMapModal',
  component: WMSMapModal,
  parameters: {
    // Optional parameter to center the component in the Canvas
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A comprehensive warehouse map editor modal component built with React Flow. Supports editing backgrounds, drawing rectangles and polygons, and various interaction modes.',
      },
    },
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Controls whether the modal is open',
    },
    viewMode: {
      control: 'select',
      options: [ViewMode.EDIT, ViewMode.VIEW],
      description: 'Initial view mode (edit or view only)',
    },
    colorPalette: {
      control: 'object',
      description: 'Array of colors available for drawing shapes',
    },
    debugMode: {
      control: 'boolean',
      description: 'Enable debug logging',
    },
    title: {
      control: 'text',
      description: 'Modal title',
    },
    warehouseIds: {
      control: 'object',
      description: 'Array of warehouse IDs for breadcrumb navigation',
    },
  },
  args: {
    open: true,
    onClose: action('onClose'),
    onNodeClick: action('onNodeClick'),
    onSave: action('onSave'),
    onBreadcrumbClick: action('onBreadcrumbClick'),
    onUpload: async (files: File[]): Promise<string[]> => {
      console.log(
        '模擬上傳:',
        files.map(f => f.name),
      );

      // 模擬上傳延遲
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 直接返回 createObjectURL，不使用 getFilenameFQDN
      return files.map(file => URL.createObjectURL(file));
    },
    maxFileSizeKB: 10240, // 10MB
    warehouseIds: ['MAIN-WAREHOUSE', 'SECTION-A', 'ZONE-B1', 'STORAGE-UNIT-42'],
  },
} satisfies Meta<typeof WMSMapModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Default: Story = {
  render: args => <WMSMapModalWrapper {...args} />,
  args: {
    title: '倉庫地圖編輯器',
    viewMode: ViewMode.EDIT,
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'],
    debugMode: false,
    warehouseIds: ['MAIN-WAREHOUSE', 'SECTION-A', 'ZONE-B1', 'STORAGE-UNIT-42'],
  },
};

export const WithSimpleData: Story = {
  render: args => <WMSMapModalWrapper {...args} />,
  args: {
    title: '簡單倉庫地圖',
    viewMode: ViewMode.EDIT,
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
    initialNodes: convertToFlowNodes(generateStoryNodes('simple')),
    initialEdges: [],
    debugMode: false,
    warehouseIds: ['PRIMARY-FACILITY', 'LOADING-DOCK', 'STORAGE-AREA', 'DISPATCH-ZONE'],
  },
};

export const WithComplexData: Story = {
  render: args => <WMSMapModalWrapper {...args} />,
  args: {
    title: '複雜倉庫地圖',
    viewMode: ViewMode.EDIT,
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FFB6C1', '#98FB98'],
    initialNodes: convertToFlowNodes(generateStoryNodes('complex')),
    initialEdges: [],
    debugMode: false,
    warehouseIds: ['WH-ALPHA', 'WH-BETA', 'WH-GAMMA', 'WH-DELTA', 'WH-EPSILON'],
  },
};

export const ViewOnlyMode: Story = {
  render: args => <WMSMapModalWrapper {...args} />,
  args: {
    title: '檢視模式 - 倉庫地圖',
    viewMode: ViewMode.VIEW,
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
    initialNodes: convertToFlowNodes(generateStoryNodes('complex')),
    initialEdges: [],
    debugMode: false,
    warehouseIds: ['PRODUCTION-FLOOR', 'QUALITY-CHECK', 'PACKAGING', 'SHIPPING-DOCK'],
  },
};

export const LargeDataSet: Story = {
  render: args => <WMSMapModalWrapper {...args} />,
  args: {
    title: '大量資料測試',
    viewMode: ViewMode.EDIT,
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
    initialNodes: convertToFlowNodes(generateStoryNodes('large')),
    initialEdges: [],
    debugMode: false,
    warehouseIds: ['MEGA-WAREHOUSE', 'SECTOR-1', 'SECTOR-2', 'STORAGE-RACK-A15'],
  },
};

export const EmptyMap: Story = {
  render: args => <WMSMapModalWrapper {...args} />,
  args: {
    title: '空白地圖',
    viewMode: ViewMode.EDIT,
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'],
    initialNodes: convertToFlowNodes(generateStoryNodes('empty')),
    initialEdges: [],
    debugMode: false,
    warehouseIds: ['NEW-FACILITY', 'CONSTRUCTION-AREA', 'FUTURE-EXPANSION', 'PLANNING-ZONE'],
  },
};

export const PolygonShapes: Story = {
  render: args => <WMSMapModalWrapper {...args} />,
  args: {
    title: '閉合多邊形測試',
    viewMode: ViewMode.EDIT,
    colorPalette: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
    initialNodes: convertToFlowNodes(generateStoryNodes('polygons')),
    initialEdges: [],
    debugMode: false,
    warehouseIds: ['POLYGON-LAB', 'TEST-AREA', 'SHAPE-VALIDATION', 'GEOMETRY-ZONE'],
  },
};

export const DebugMode: Story = {
  render: args => <WMSMapModalWrapper {...args} />,
  args: {
    title: '偵錯模式',
    viewMode: ViewMode.EDIT,
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
    initialNodes: convertToFlowNodes(generateStoryNodes('simple')),
    initialEdges: [],
    debugMode: true,
    warehouseIds: ['DEBUG-FACILITY', 'TEST-ENVIRONMENT', 'LOG-ANALYSIS', 'MONITORING-ZONE'],
  },
};
