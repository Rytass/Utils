#!/usr/bin/env node

const { execSync } = require('child_process');
const { readFileSync, writeFileSync } = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');

console.log('📚 Building documentation...');

// Change to the root directory
process.chdir(rootDir);

try {
  // Read the current package.json
  const packageJson = readFileSync(packageJsonPath, 'utf8');
  const originalContent = packageJson;

  // Temporarily disable ESM mode
  console.log('⚙️  Temporarily switching to CommonJS mode...');
  const modifiedContent = packageJson.replace('"type": "module"', '"_type": "module"');
  writeFileSync(packageJsonPath, modifiedContent);

  // Build the documentation
  console.log('🔨 Running docusaurus build...');
  execSync('npx docusaurus build docs', {
    stdio: 'inherit',
  });

  // Restore ESM mode
  console.log('⚙️  Restoring ESM mode...');
  writeFileSync(packageJsonPath, originalContent);

  console.log('✅ Documentation built successfully!');
} catch (error) {
  // Make sure to restore ESM mode even if build fails
  try {
    const currentContent = readFileSync(packageJsonPath, 'utf8');
    if (currentContent.includes('"_type": "module"')) {
      console.log('🔄 Restoring ESM mode after error...');
      const restoredContent = currentContent.replace('"_type": "module"', '"type": "module"');
      writeFileSync(packageJsonPath, restoredContent);
    }
  } catch (restoreError) {
    console.error('❌ Failed to restore ESM mode:', restoreError.message);
  }

  console.error('❌ Documentation build failed:', error.message);
  process.exit(1);
}
