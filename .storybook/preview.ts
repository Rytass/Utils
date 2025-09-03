import type { Preview } from '@storybook/react';

// Import Mezzanine UI styles
import './mezzanine-ui-styles.scss';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      toc: true,
    },
  },
  tags: ['autodocs'],
};

export default preview;
