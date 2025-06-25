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

const externals = [
  ...Object.keys({
    ...dependencies,
    ...peerDependencies,
  }),
  rootPackageName,
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

    execSync(
      `npx tsc --project ${tsconfig} --outDir ${packageDistPath} --emitDeclarationOnly`,
    );

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
