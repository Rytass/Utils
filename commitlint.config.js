/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

const { default: { utils }} = await import('@commitlint/config-lerna-scopes');

export default {
  rules: {
    'scope-enum': async ctx => [2, 'always', [...(await utils.getPackages(ctx)), 'release']],
  },
};
