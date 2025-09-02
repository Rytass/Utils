const path = require('path');
const { execSync } = require('child_process');

const { PWD, npm_package_name } = process.env;
const PACKAGE_PATH = PWD;
const PACKAGE__IN_NODE_MODULES_PATH = path.resolve(PWD, '..', '..', 'node_modules', npm_package_name);

execSync(`rm -rf ${PACKAGE_PATH}/{lib,prebuilts,*.tsbuildinfo} ${PACKAGE__IN_NODE_MODULES_PATH}`);
