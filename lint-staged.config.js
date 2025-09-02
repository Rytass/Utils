export default {
  'packages/**/*.{ts,tsx}': files => `nx affected --target=typecheck --files=${files.join(',')}`,
  'packages/**/*.{js,jsx,ts,tsx,json,css,scss,json}': [
    files => `nx affected:lint --fix --files=${files.join(',')}`,
    files => `nx format:write --files=${files.join(',')}`,
  ],
};
