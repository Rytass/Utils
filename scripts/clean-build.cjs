const fs = require('fs');
const path = require('path');

const { PWD } = process.env;
const PACKAGE_PATH = PWD || process.cwd();

// The package name has to come from the manifest, not from `npm_package_name`:
// nx runs this through `nx:run-commands`, which is not an npm lifecycle, so that
// env var is absent there. Relying on it silently skipped the node_modules copy
// and left files removed from `src` behind as orphans in previous builds.
function readPackageName() {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(PACKAGE_PATH, 'package.json'), 'utf8')).name;
  } catch {
    return undefined;
  }
}

const packageName = readPackageName();

// Removal goes through `fs.rmSync` rather than a shell `rm -rf`: the previous
// command relied on brace expansion, which is not portable across the shells
// `execSync` may pick.
const targets = [
  path.resolve(PACKAGE_PATH, 'lib'),
  path.resolve(PACKAGE_PATH, 'prebuilts'),
  ...fs
    .readdirSync(PACKAGE_PATH, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsbuildinfo'))
    .map(entry => path.resolve(PACKAGE_PATH, entry.name)),
  ...(packageName ? [path.resolve(PACKAGE_PATH, '..', '..', 'node_modules', ...packageName.split('/'))] : []),
];

try {
  targets.forEach(target => fs.rmSync(target, { recursive: true, force: true }));
} catch (error) {
  console.error('Clean build error:', error.message);
  process.exit(1);
}
