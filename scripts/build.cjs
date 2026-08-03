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

// Node 20.19 is the floor: it is the first LTS with require(ESM), which keeps any
// deep path we did not anticipate loadable from CommonJS, and the dependency tree
// (typeorm -> uuid, file-type v21) already refuses to run on anything older.
const DEFAULT_ENGINES = { node: '>=20.19.0' };

/**
 * Relative specifiers inside emitted declarations carry no extension, which
 * breaks `moduleResolution: nodenext` consumers (TS2305) once the package is
 * ESM. Resolution is done against the emitted files rather than by pattern:
 * `./member-base.module` must not be mistaken for something already carrying an
 * extension, and `./models` has to become `./models/index.js`.
 */
const DECLARATION_SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bmodule\s+)(['"])(\.{1,2}\/[^'"]*)\2/g;

function addDeclarationExtensions(filePath) {
  const dir = path.dirname(filePath);
  const source = fse.readFileSync(filePath, 'utf8');

  const patched = source.replace(DECLARATION_SPECIFIER, (match, head, quote, specifier) => {
    const resolved = path.resolve(dir, specifier);

    if (fse.existsSync(`${resolved}.d.ts`)) return `${head}${quote}${specifier}.js${quote}`;
    if (fse.existsSync(path.join(resolved, 'index.d.ts'))) return `${head}${quote}${specifier}/index.js${quote}`;

    // Anything else (asset imports such as `./x.module.scss`, already-suffixed
    // specifiers) is left untouched on purpose.
    return match;
  });

  if (patched !== source) fse.writeFileSync(filePath, patched);
}

/**
 * A CommonJS consumer on `moduleResolution: node16` resolves the `require`
 * condition's types; if those are ESM-flavoured declarations it fails with
 * TS1479 even though the runtime is fine. So the whole declaration tree is
 * mirrored as `.d.cts` with `.js` specifiers rewritten to `.cjs` — mirroring
 * only the entry points would dangle for consumers with `skipLibCheck: false`.
 */
function writeCommonJsDeclarations(declarationFiles) {
  declarationFiles.forEach(filePath => {
    const source = fse.readFileSync(filePath, 'utf8');

    fse.writeFileSync(filePath.replace(/\.d\.ts$/, '.d.cts'), source.replace(/(['"])(\.{1,2}\/[^'"]*?)\.js\1/g, '$1$2.cjs$1'));
  });
}

function collectFiles(dir, predicate, acc = []) {
  fse.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) collectFiles(entryPath, predicate, acc);
    else if (predicate(entryPath)) acc.push(entryPath);
  });

  return acc;
}

function conditionsFor(name) {
  // `types` must sit inside every condition and before `default`: TypeScript
  // takes the first match and stops. The trailing `default` is for resolvers
  // that understand neither `import` nor `require`.
  return {
    import: { types: `./${name}.d.ts`, default: `./${name}.js` },
    require: { types: `./${name}.d.cts`, default: `./${name}.cjs` },
    default: `./${name}.js`,
  };
}

/**
 * Directories a consumer may address without a filename, at any depth. ESM never
 * applies directory resolution and the `./*` wildcard would map
 * `components/Table` to a non-existent `components/Table.js`, so every directory
 * holding an index has to be spelled out. CommonJS consumers could resolve these
 * before the package had an exports map, and an exports map turns that off.
 */
function directoryEntries(distPath, prefix = '') {
  return fse
    .readdirSync(path.resolve(distPath, prefix), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry => {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const hasIndex = fse.existsSync(path.resolve(distPath, relativePath, 'index.js'));

      return [...(hasIndex ? [relativePath] : []), ...directoryEntries(distPath, relativePath)];
    });
}

function buildExportsMap(distPath, subpathNames) {
  const wildcard = {
    import: { types: './*.d.ts', default: './*.js' },
    require: { types: './*.d.cts', default: './*.cjs' },
    default: './*.js',
  };

  return {
    '.': conditionsFor('index'),
    ...subpathNames.reduce((acc, name) => ({ ...acc, [`./${name}`]: conditionsFor(name) }), {}),
    ...directoryEntries(distPath).reduce((acc, name) => ({ ...acc, [`./${name}`]: conditionsFor(`${name}/index`) }), {}),
    // Tooling (nx, lerna, bundler plugins) reads this directly.
    './package.json': './package.json',
    './*.css': './*.css',
    './*.json': './*.json',
    // Both wildcards are needed: Node picks the more specific pattern, so
    // `./x.js` keeps its extension while a bare `./x` gains one. An array
    // fallback (`["./*", "./*.js"]`) does NOT work — Node only falls through on
    // unmatched conditions, never on a missing file.
    './*.js': wildcard,
    './*': wildcard,
  };
}

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
      // Both formats preserve modules so the two trees are mirror images. That
      // keeps every deep path addressable in either format (the exports map can
      // then use symmetric wildcards) and guarantees a shared module has exactly
      // one instance per format no matter which entry reaches it.
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
          preserveModules: true,
          preserveModulesRoot: packageSrcPath,
          // Rollup writes the cross-references itself, so naming the outputs
          // `.cjs` is all it takes — no post-hoc rewriting of require() paths.
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name].cjs',
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

    const declarationFiles = collectFiles(packageDistPath, filePath => filePath.endsWith('.d.ts'));

    declarationFiles.forEach(addDeclarationExtensions);
    writeCommonJsDeclarations(declarationFiles);

    packageJson.type = 'module';
    packageJson.main = './index.cjs';
    packageJson.module = './index.js';
    packageJson.types = './index.d.ts';
    packageJson.typings = './index.d.ts';
    packageJson.engines = { ...DEFAULT_ENGINES, ...packageJson.engines };

    // Every package gets an exports map: without one, Node's ESM resolver falls
    // back to `main` and hands an ESM consumer the CommonJS build, which would
    // defeat the point of shipping ESM by default. Wildcards keep deep paths
    // open so existing imports do not break.
    packageJson.exports = buildExportsMap(
      packageDistPath,
      Object.keys(entryInputs).filter(name => name !== 'index'),
    );
  }

  delete packageJson.scripts;

  fse.writeFileSync(packageJsonDistPath, `${JSON.stringify(packageJson, undefined, 2)}\n`);

  const targetPath = path.resolve(nodeModulesPath, ...packageJson.name.split('/'));

  // `unlinkSync` only works on the workspace symlink yarn creates; once this
  // script has replaced it with a real directory the call fails and the copy
  // below merges into stale output, leaving orphaned files behind. `rmSync`
  // handles both cases (on a symlink it removes the link, not the target).
  fse.rmSync(targetPath, { recursive: true, force: true });

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

  /**
   * copy CHANGELOG.md
   *
   * Published alongside the README, which links to it for migration notes —
   * without this that link is dead on npm. Not every package has one yet, so
   * its absence is not an error.
   */
  const changelogPath = path.resolve(rootPackagePath, 'CHANGELOG.md');

  if (fse.existsSync(changelogPath)) {
    fse.copyFileSync(changelogPath, path.resolve(rootPackageDistPath, 'CHANGELOG.md'));
  }

  for (const packageSymbol in packagesInfos) {
    tryBuild(packagesInfos, packageSymbol);
  }
})();
