const path = require('path');
const fse = require('fs-extra');
const { execSync } = require('child_process');
const { glob } = require('glob');
const { rollup } = require('rollup');
const { swc } = require('rollup-plugin-swc3');
const postcss = require('rollup-plugin-postcss');
const { preserveDirectives } = require('rollup-plugin-preserve-directives');

const { PWD } = process.env;
const rootPackagePath = PWD;
const rootPackageJson = require(path.resolve(rootPackagePath, 'package.json'));
const { name: rootPackageName, dependencies, peerDependencies } = rootPackageJson;

// Node.js built-in modules that should be treated as external
const nodeBuiltins = [
  'fs',
  'fs/promises',
  'path',
  'crypto',
  'stream',
  'events',
  'http',
  'https',
  'util',
  'buffer',
  'child_process',
  'os',
  'url',
  'querystring',
  'readline',
  'zlib',
  'net',
  'tls',
  'dns',
  'dgram',
  'cluster',
  'worker_threads',
  'node:fs',
  'node:fs/promises',
  'node:path',
  'node:crypto',
  'node:stream',
  'node:events',
  'node:http',
  'node:https',
  'node:util',
  'node:buffer',
  'node:child_process',
  'node:os',
  'node:url',
  'node:querystring',
  'node:readline',
  'node:zlib',
  'node:net',
  'node:tls',
  'node:dns',
  'node:dgram',
  'node:cluster',
  'node:worker_threads',
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

      throw new Error(`Package name '${name}' should equal '${packageJson.name}'`);
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

  return externals.some(ext => id.startsWith(ext));
}

async function rollupBuild({ output, ...options }) {
  const bundle = await rollup(options);

  if (Array.isArray(output)) {
    await Promise.all(output.map(o => bundle.write(o)));
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
      execSync(`npx tsc --project ${tsconfig} --outDir ${packageDistPath} --emitDeclarationOnly`, { stdio: 'pipe' });
    } catch (error) {
      console.error(`\n❌ TypeScript compilation failed for ${packageJson.name}:`);
      console.error(error.stdout?.toString() || error.message);
      console.error(error.stderr?.toString() || '');
      process.exit(1);
    }

    const isolateEntries = packageJson.isolateEntries || [];

    // Every entry point is built in a SINGLE rollup pass.
    //
    // Building them separately makes rollup plan chunks in isolation, which
    // breaks two ways once an isolate entry shares a module with the index:
    //   - the ESM outputs share one `dir` with preserveModules, so the later
    //     build overwrites the earlier build's shared modules with a variant
    //     tree-shaken for that entry alone (missing exports at runtime);
    //   - each CJS bundle inlines its own copy of every shared module, so
    //     Symbol() injection tokens and entity classes exist twice and stop
    //     matching across entries.
    // One pass lets rollup hoist the shared modules into chunks both entries
    // import, so a module has exactly one instance no matter how it is reached.
    const entryInputs = isolateEntries.reduce(
      (acc, entryPath) => {
        const inputPath = path.resolve(packageSrcPath, entryPath);

        if (!fse.existsSync(inputPath)) return acc;

        return { ...acc, [entryPath.replace(/^(?:\.\/)?(.+)\.[^.]+$/, '$1')]: inputPath };
      },
      { index: indexPath },
    );

    await rollupBuild({
      input: entryInputs,
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
          dir: path.resolve(packageDistPath),
          format: 'cjs',
          externalLiveBindings: false,
          entryFileNames: '[name].cjs.js',
          chunkFileNames: 'chunks/[name]-[hash].cjs.js',
        },
      ],
      onwarn(warning, defaultHandler) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        defaultHandler(warning);
      },
      plugins: [
        swc({
          tsconfig,
        }),
        postcss({
          modules: true,
          use: {
            sass: {
              includePaths: [nodeModulesPath],
            },
          },
          extract: true,
          minimize: true,
        }),
        preserveDirectives({ suppressPreserveModulesWarning: true }),
      ],
    });

    packageJson.main = './index.cjs.js';
    packageJson.module = './index.js';
    packageJson.typings = './index.d.ts';

    // An exports map is only emitted for packages that actually publish
    // subpaths. Adding one everywhere would close off deep paths that
    // consumers may already import from packages with a single entry point.
    const subpathNames = Object.keys(entryInputs).filter(name => name !== 'index');

    if (subpathNames.length) {
      packageJson.exports = {
        '.': {
          types: './index.d.ts',
          import: './index.js',
          require: './index.cjs.js',
        },
        ...subpathNames.reduce(
          (acc, name) => ({
            ...acc,
            [`./${name}`]: {
              types: `./${name}.d.ts`,
              import: `./${name}.js`,
              require: `./${name}.cjs.js`,
            },
          }),
          {},
        ),
        // Tooling (nx, lerna, bundler plugins) reads this directly.
        './package.json': './package.json',
      };
    }
  }

  delete packageJson.scripts;

  fse.writeFileSync(packageJsonDistPath, `${JSON.stringify(packageJson, undefined, 2)}\n`);

  const targetPath = path.resolve(nodeModulesPath, ...packageJson.name.split('/'));

  try {
    fse.unlinkSync(targetPath);
  } catch (error) {
    console.error(`Failed to unlink ${targetPath}: ${error.message}`);
  }

  fse.copySync(packageDistPath, targetPath);
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

  triggers?.forEach(trigger => tryBuild(packagesInfos, trigger, packageSymbol));
}

(async () => {
  const packagesInfos = await getPackagesInfos();

  /**
   * prepare dist
   */
  fse.mkdirSync(rootPackageDistPath, { recursive: true });

  /**
   * copy LICENSE
   */
  fse.copyFileSync(path.resolve(rootPath, 'LICENSE'), path.resolve(rootPackageDistPath, 'LICENSE'));

  /**
   * copy README.md
   */
  fse.copyFileSync(path.resolve(rootPackagePath, 'README.md'), path.resolve(rootPackageDistPath, 'README.md'));

  for (const packageSymbol in packagesInfos) {
    tryBuild(packagesInfos, packageSymbol);
  }
})();
