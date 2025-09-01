import type { StorybookConfig } from '@storybook/react-vite';
import { join } from 'path';

const config: StorybookConfig = {
  stories: [
    '../packages/*/stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../packages/*/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-essentials',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    defaultName: 'Documentation',
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => {
        if (prop.parent) {
          return !prop.parent.fileName.includes('node_modules');
        }
        return true;
      },
    },
  },
  viteFinal: async (config) => {
    // Customize the Vite config here
    const { mergeConfig } = await import('vite');
    
    return mergeConfig(config, {
      // Ensure proper handling of SCSS modules and Sass imports
      css: {
        modules: {
          localsConvention: 'camelCase',
        },
        preprocessorOptions: {
          scss: {
            // Silent deprecation warnings for legacy JS API
            silenceDeprecations: ['legacy-js-api'],
            // Enable resolving imports from node_modules with ~ prefix
            additionalData: `$node-modules-path: '${join(__dirname, '../node_modules').replace(/\\/g, '/')}/';`,
          },
        },
      },
      resolve: {
        alias: {
          // Add aliases for better module resolution in monorepo
          '@rytass/wms-map-react-components': join(__dirname, '../packages/wms-map-react-components/src'),
          // Add support for ~ syntax to resolve to node_modules (for both JS and CSS)
          '~': join(__dirname, '../node_modules'),
          '~@mezzanine-ui': join(__dirname, '../node_modules/@mezzanine-ui'),
        },
      },
    });
  },
};

export default config;