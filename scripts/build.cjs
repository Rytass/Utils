const path = require('path');
const fse = require('fs-extra');
const { execSync } = require('child_process');
const { glob } = require('glob');
const { rollup } = require('rollup');
const { swc } = require('rollup-plugin-swc3');
const postcss = require('rollup-plugin-postcss');

const { PWD } = process.env;
const rootPackagePath = PWD;
const rootPackageJson = require(path.resolve(rootPackagePath, 'package.json'));
const {
  name: rootPackageName,
  dependencies,
  peerDependencies,
} = rootPackageJson;

// Node.js built-in modules that should be treated as external
const nodeBuiltins = [
  'fs', 'fs/promises', 'path', 'crypto', 'stream', 'events', 'http', 'https', 
  'util', 'buffer', 'child_process', 'os', 'url', 'querystring', 'readline',
  'zlib', 'net', 'tls', 'dns', 'dgram', 'cluster', 'worker_threads',
  'node:fs', 'node:fs/promises', 'node:path', 'node:crypto', 'node:stream', 
  'node:events', 'node:http', 'node:https', 'node:util', 'node:buffer',
  'node:child_process', 'node:os', 'node:url', 'node:querystring', 
  'node:readline', 'node:zlib', 'node:net', 'node:tls', 'node:dns', 
  'node:dgram', 'node:cluster', 'node:worker_threads'
];

const externals = [
  ...Object.keys({
    ...dependencies,
    ...peerDependencies,
  }),
  rootPackageName,
  ...nodeBuiltins,
  // Common packages that should be treated as external
  'axios',
  'debug',
  'luxon',
];

const rootPackageDistPath = path.resolve(rootPackagePath, 'lib');
const rootPath = path.resolve(rootPackagePath, '..', '..');
const nodeModulesPath = path.resolve(rootPath, 'node_modules');
const tsPluginCachePath = path.resolve(nodeModulesPath, '.cache', 'rts2');

const ROOT_SYMBOL = '__ROOT__';
const DEPS_SET_RECORD = {};
const TRIGGERS_SET_RECORD = {};

async function getPackagesInfos() {
  const files = await glob('**/package.json');

  return files.reduce((acc, file) => {
    const packageJsonPath = path.resolve(rootPackagePath, file);
    const packageJson = require(packageJsonPath);
    const dirs = file
      .replace(/package\.json|\/package\.json/, '')
      .split('/')
      .filter(Boolean);

    const name = [rootPackageName, ...dirs].join('/');

    if (packageJson.name !== name) {
      // Resolve version conflict
      if (~dirs.indexOf('node_modules')) {
        return acc;
      }

      throw new Error(
        `Package name '${name}' should equal '${packageJson.name}'`,
      );
    }

    const packageSymbol = dirs.join('/') || ROOT_SYMBOL;

    acc[packageSymbol] = {
      packageJson,
      dirs,
    };

    return acc;
  }, {});
}

function isExternal(id) {
  // Handle Node.js built-in modules (both with and without node: prefix)
  const normalizedId = id.startsWith('node:') ? id.slice(5) : id;
  if (nodeBuiltins.includes(id) || nodeBuiltins.includes(normalizedId)) {
    return true;
  }
  
  return externals.some((ext) => id.startsWith(ext));
}

async function rollupBuild({ output, ...options }) {
  const bundle = await rollup(options);

  if (Array.isArray(output)) {
    await Promise.all(output.map((o) => bundle.write(o)));
  } else {
    await bundle.write(output);
  }
}

async function build(packageSymbol, packageInfos) {
  const { packageJson, dirs } = packageInfos;
  const isRoot = packageSymbol === ROOT_SYMBOL;
  const packagePath = path.resolve(rootPackagePath, ...dirs);
  const packageDistPath = path.resolve(rootPackageDistPath, ...dirs);
  const packageJsonDistPath = path.resolve(packageDistPath, 'package.json');
  const packageSrcPath = path.resolve(packagePath, 'src');
  const indexPath = path.resolve(packageSrcPath, 'index.ts');

  if (!(isRoot && !fse.existsSync(indexPath))) {
    const tsconfig = path.resolve(packagePath, 'tsconfig.build.json');

    try {
      execSync(
        `npx tsc --project ${tsconfig} --outDir ${packageDistPath} --emitDeclarationOnly`,
        { stdio: 'pipe' }
      );
    } catch (error) {
      console.error(`\n❌ TypeScript compilation failed for ${packageJson.name}:`);
      console.error(error.stdout?.toString() || error.message);
      console.error(error.stderr?.toString() || '');
      process.exit(1);
    }

    await rollupBuild({
      input: indexPath,
      external: isExternal,
      output: [
        {
          dir: path.resolve(packageDistPath),
          format: 'es',
          externalLiveBindings: false,
          preserveModules: true,
          preserveModulesRoot: packageSrcPath,
        },
        {
          file: path.resolve(packageDistPath, 'index.cjs.js'),
          format: 'cjs',
          externalLiveBindings: false,
        },
      ],
      plugins: [
        swc({
          tsconfig,
        }),
        postcss({
          modules: true,
          use: ['sass'],
          extract: true,
          minimize: true,
        }),
      ],
    });

    packageJson.main = './index.cjs.js';
    packageJson.module = './index.js';
    packageJson.typings = './index.d.ts';

    const isolateEntries = packageJson.isolateEntries || [];

    await isolateEntries
      .map((entryPath) => async () => {
        const inputPath = path.resolve(packageSrcPath, entryPath);
        const filename = entryPath.replace(/^(.+)\.[^.]+$/, '$1');

        if (fse.existsSync(inputPath)) {
          await rollupBuild({
            input: inputPath,
            external: isExternal,
            output: [
              {
                dir: path.resolve(packageDistPath),
                format: 'es',
                externalLiveBindings: false,
                preserveModules: true,
                preserveModulesRoot: packageSrcPath,
              },
              {
                file: path.resolve(packageDistPath, `${filename}.cjs.js`),
                format: 'cjs',
                externalLiveBindings: false,
              },
            ],
            plugins: [
              swc({
                tsconfig,
              }),
              postcss({
                modules: true,
                use: ['sass'],
                extract: true,
                minimize: true,
              }),
            ],
          });
        }
      })
      .reduce((prev, next) => prev.then(next), Promise.resolve());
  }

  delete packageJson.scripts;

  fse.writeFileSync(
    packageJsonDistPath,
    `${JSON.stringify(packageJson, undefined, 2)}\n`,
  );

  fse.copySync(
    packageDistPath,
    path.resolve(nodeModulesPath, ...packageJson.name.split('/')),
  );
}

async function tryBuild(packagesInfos, packageSymbol, triggerSymbol) {
  const deps = DEPS_SET_RECORD[packageSymbol];
  const triggers = TRIGGERS_SET_RECORD[packageSymbol];

  if (deps && triggerSymbol) {
    deps.delete(triggerSymbol);
  }

  if (deps && deps.size > 0) {
    return;
  }

  await build(packageSymbol, packagesInfos[packageSymbol]);

  triggers?.forEach((trigger) =>
    tryBuild(packagesInfos, trigger, packageSymbol),
  );
}

(async () => {
  const packagesInfos = await getPackagesInfos();

  /**
   * prepare dist
   */
  fse.mkdirSync(rootPackageDistPath);

  /**
   * copy LICENSE
   */
  fse.copyFileSync(
    path.resolve(rootPath, 'LICENSE'),
    path.resolve(rootPackageDistPath, 'LICENSE'),
  );

  /**
   * copy README.md
   */
  fse.copyFileSync(
    path.resolve(rootPackagePath, 'README.md'),
    path.resolve(rootPackageDistPath, 'README.md'),
  );

  for (const packageSymbol in packagesInfos) {
    tryBuild(packagesInfos, packageSymbol);
  }
})();
