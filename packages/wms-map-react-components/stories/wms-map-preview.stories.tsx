import type { Meta, StoryObj } from '@storybook/react-vite';
import { WMSMapPreview } from '../src';
import { generateStoryNodes, convertToFlowNodes } from './story-utils';
import { generateMockImageUrl } from './mock-image-utils';
import '@xyflow/react/dist/style.css';

const complexNodes = convertToFlowNodes(generateStoryNodes('complex'));

const meta: Meta<typeof WMSMapPreview> = {
  title: 'WMS Map Components/WMSMapPreview',
  component: WMSMapPreview,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Read-only map preview. Fits to the nodes once they are measured, and to `highlightIds` when given. ' +
          'Requires `@xyflow/react/dist/style.css` to be imported by the host app.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    highlightIds: { control: 'object' },
    dimOthers: { control: 'boolean' },
    fitPadding: { control: { type: 'number', min: 0, max: 1, step: 0.05 } },
    interactive: { control: 'boolean' },
  },
  args: {
    initialNodes: complexNodes,
    getFilenameFQDN: generateMockImageUrl,
    style: { width: 640, height: 400, border: '1px solid #e0e0e0' },
  },
} satisfies Meta<typeof WMSMapPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithHighlight: Story = {
  args: {
    highlightIds: ['range-storage-b'],
  },
};

export const WithoutHighlight: Story = {
  args: {},
};

export const NarrowContainer: Story = {
  args: {
    highlightIds: ['range-storage-b'],
    style: { width: 200, height: 160, border: '1px solid #e0e0e0' },
  },
};

export const NarrowContainerWithoutHighlight: Story = {
  args: {
    style: { width: 200, height: 160, border: '1px solid #e0e0e0' },
  },
};
