import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { WMSMapModal, ViewMode } from '../src';
import { generateStoryNodes, convertToFlowNodes } from './story-utils';
import '@xyflow/react/dist/style.css';

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
  },
  args: {
    open: true,
    onClose: action('onClose'),
    onNodeClick: action('onNodeClick'),
    onSave: action('onSave'),
    onBreadcrumbClick: action('onBreadcrumbClick'),
    onWarehouseNameEdit: action('onWarehouseNameEdit'),
  },
} satisfies Meta<typeof WMSMapModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Default: Story = {
  args: {
    title: '倉庫地圖編輯器',
    viewMode: ViewMode.EDIT,
    colorPalette: [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
    ],
    debugMode: false,
    open: true,
  },
  render: (args) => <WMSMapModal {...args} />,
};

export const WithSimpleData: Story = {
  args: {
    title: '簡單倉庫地圖',
    viewMode: ViewMode.EDIT,
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
    initialNodes: convertToFlowNodes(generateStoryNodes('simple')),
    initialEdges: [],
    debugMode: false,
    open: true,
  },
  render: (args) => <WMSMapModal {...args} />,
};

export const WithComplexData: Story = {
  args: {
    title: '複雜倉庫地圖',
    viewMode: ViewMode.EDIT,
    colorPalette: [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
      '#FFB6C1',
      '#98FB98',
    ],
    initialNodes: convertToFlowNodes(generateStoryNodes('complex')),
    initialEdges: [],
    debugMode: false,
    open: true,
  },
  render: (args) => <WMSMapModal {...args} />,
};

export const ViewOnlyMode: Story = {
  args: {
    title: '檢視模式 - 倉庫地圖',
    viewMode: ViewMode.VIEW,
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
    initialNodes: convertToFlowNodes(generateStoryNodes('complex')),
    initialEdges: [],
    debugMode: false,
    open: true,
  },
  render: (args) => <WMSMapModal {...args} />,
};

export const LargeDataSet: Story = {
  args: {
    title: '大量資料測試',
    viewMode: ViewMode.EDIT,
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
    initialNodes: convertToFlowNodes(generateStoryNodes('large')),
    initialEdges: [],
    debugMode: false,
    open: true,
  },
  render: (args) => <WMSMapModal {...args} />,
};

export const EmptyMap: Story = {
  args: {
    title: '空白地圖',
    viewMode: ViewMode.EDIT,
    colorPalette: [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
    ],
    initialNodes: convertToFlowNodes(generateStoryNodes('empty')),
    initialEdges: [],
    debugMode: false,
    open: true,
  },
  render: (args) => <WMSMapModal {...args} />,
};

export const PolygonShapes: Story = {
  args: {
    title: '閉合多邊形測試',
    viewMode: ViewMode.EDIT,
    colorPalette: [
      '#3b82f6',
      '#22c55e',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#06b6d4',
    ],
    initialNodes: convertToFlowNodes(generateStoryNodes('polygons')),
    initialEdges: [],
    debugMode: false,
    open: true,
  },
  render: (args) => <WMSMapModal {...args} />,
};

export const DebugMode: Story = {
  args: {
    title: '偵錯模式',
    viewMode: ViewMode.EDIT,
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
    initialNodes: convertToFlowNodes(generateStoryNodes('simple')),
    initialEdges: [],
    debugMode: true,
    open: true,
  },
  render: (args) => <WMSMapModal {...args} />,
};
