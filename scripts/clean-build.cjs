const path = require('path');
const { execSync } = require('child_process');

const { PWD, npm_package_name } = process.env;
const PACKAGE_PATH = PWD || process.cwd();

// Clean build artifacts from package directory
let cleanCommand = `rm -rf ${PACKAGE_PATH}/{lib,prebuilts,*.tsbuildinfo}`;

// If npm_package_name is available, also clean node_modules
if (npm_package_name) {
  const PACKAGE_IN_NODE_MODULES_PATH = path.resolve(PACKAGE_PATH, '..', '..', 'node_modules', npm_package_name);
  cleanCommand += ` ${PACKAGE_IN_NODE_MODULES_PATH}`;
}

try {
  execSync(cleanCommand);
} catch (error) {
  console.error('Clean build error:', error.message);
  process.exit(1);
}
