/**
 * Dual-format smoke test for built packages.
 *
 * Unit tests run against `src`, consumers run against `lib`; nothing in between
 * checked that `lib` is loadable at all. This runner closes that gap: it installs
 * the built artifact into a scratch project OUTSIDE the repo and exercises it the
 * way a real consumer would.
 *
 *   node scripts/smoke/run.cjs                          # every package that has a lib/
 *   node scripts/smoke/run.cjs --packages=payments,invoice
 *   node scripts/smoke/run.cjs --nodes=20.19.6,22.17.0,26.4.0
 *   node scripts/smoke/run.cjs --no-types               # skip the tsc matrix
 *   node scripts/smoke/run.cjs --keep                   # keep the scratch project
 *
 * What it verifies, per package:
 *   1. every entry point resolves BY PACKAGE NAME (so exports/main are really used)
 *   2. the resolved file is the format the consumer asked for (ESM consumers must
 *      not silently receive the CJS build)
 *   3. every entry point loads under both `require` and `import`
 *   4. the two formats expose the SAME export set
 *   5. optional-peer / lazy code paths actually execute (scripts/smoke/probes/*)
 *   6. tsc --noEmit passes for {node10, node16, nodenext, bundler} x {CJS, ESM}
 *   7. all of the above across several Node versions (via fnm, when available)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PACKAGES_DIR = path.resolve(REPO_ROOT, 'packages');
const PROBES_DIR = path.resolve(__dirname, 'probes');
const REPO_NODE_MODULES = path.resolve(REPO_ROOT, 'node_modules');

const TS_MATRIX = [
  { id: 'node10', module: 'commonjs', moduleResolution: 'node' },
  { id: 'node16', module: 'node16', moduleResolution: 'node16' },
  { id: 'nodenext', module: 'nodenext', moduleResolution: 'nodenext' },
  { id: 'bundler', module: 'esnext', moduleResolution: 'bundler' },
];

function parseArgs(argv) {
  return argv.reduce(
    (acc, arg) => {
      const [key, value] = arg.replace(/^--/, '').split('=');

      if (key === 'packages') return { ...acc, packages: value.split(',').filter(Boolean) };
      if (key === 'nodes') return { ...acc, nodes: value.split(',').filter(Boolean) };
      if (key === 'no-types') return { ...acc, types: false };
      if (key === 'keep') return { ...acc, keep: true };
      if (key === 'json') return { ...acc, json: true };

      return acc;
    },
    { packages: [], nodes: [], types: true, keep: false, json: false },
  );
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Packages that currently have a build output, keyed by directory name. */
function discoverPackages(filter) {
  return fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .filter(entry => !filter.length || filter.includes(entry.name))
    .map(entry => {
      const dir = path.resolve(PACKAGES_DIR, entry.name);
      const libDir = path.resolve(dir, 'lib');
      const manifest = path.resolve(libDir, 'package.json');

      if (!fs.existsSync(manifest)) return undefined;

      return { dirName: entry.name, libDir, packageJson: readJson(manifest), bundlerOnly: isBundlerOnly(dir) };
    })
    .filter(Boolean);
}

/**
 * Browser packages are only ever consumed through a bundler, and their peers
 * (@mezzanine-ui/react, @xyflow/react) are not loadable by Node's ESM resolver
 * at all — directory imports, extensionless deep paths. Loading them here would
 * report third-party breakage as ours, so they get resolution + declaration +
 * static checks instead of a runtime load.
 */
function isBundlerOnly(packageDir) {
  const tsconfig = path.resolve(packageDir, 'tsconfig.build.json');

  if (!fs.existsSync(tsconfig)) return false;

  return /tsconfig\.base\.web\.json/.test(fs.readFileSync(tsconfig, 'utf8'));
}

/**
 * Every relative specifier in the emitted JS must point at a file that exists.
 * This catches broken cross-references inside the artifact without depending on
 * third-party packages being loadable.
 */
function verifyInternalSpecifiers(libDir) {
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)(['"])(\.{1,2}\/[^'"]*)\1/g;

  return collect(libDir, filePath => /\.(js|cjs|mjs)$/.test(filePath)).flatMap(filePath => {
    const source = fs.readFileSync(filePath, 'utf8');

    return [...source.matchAll(pattern)]
      .map(match => match[2])
      .filter(specifier => {
        const target = path.resolve(path.dirname(filePath), specifier);

        // A directory is not a valid target: ESM never applies directory
        // resolution, so `existsSync` alone would pass a broken specifier.
        return !fs.existsSync(target) || !fs.statSync(target).isFile();
      })
      .map(specifier => `${path.relative(libDir, filePath)} references missing '${specifier}'`);
  });
}

function collect(dir, predicate, acc = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) collect(entryPath, predicate, acc);
    else if (predicate(entryPath)) acc.push(entryPath);
  });

  return acc;
}

/**
 * Entry points a consumer may legitimately address. Wildcards are skipped —
 * they are covered by the deep-path assertions in package-specific probes.
 */
function entryPointsOf(packageJson) {
  const { exports: exportsMap } = packageJson;

  if (!exportsMap || typeof exportsMap !== 'object') return ['.'];

  return Object.keys(exportsMap).filter(key => key !== './package.json' && !key.includes('*'));
}

/**
 * Which module system Node will use for a file inside this package.
 * `.cjs`/`.mjs` are explicit; a bare `.js` follows the package `type` field,
 * and a missing `type` means CommonJS (with Node's syntax detection as a
 * fallback, which is exactly the ambiguity this migration removes).
 */
function formatOfFile(packageJson, filePath) {
  if (filePath.endsWith('.cjs')) return { format: 'cjs', reason: '.cjs extension' };
  if (filePath.endsWith('.mjs')) return { format: 'esm', reason: '.mjs extension' };
  if (packageJson.type === 'module') return { format: 'esm', reason: '"type": "module"' };

  return {
    format: 'cjs',
    reason: packageJson.type
      ? '"type": "commonjs"'
      : 'no "type" field, so Node treats .js as CommonJS (real ESM only survives via syntax detection, i.e. Node >= 20.10)',
  };
}

function createScratch(pkg) {
  // realpath keeps macOS's /var -> /private/var symlink out of resolved paths.
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `rytass-smoke-${pkg.dirName}-`));

  // Peer dependencies come from the repo's node_modules; ESM does not honour
  // NODE_PATH, so the scratch project needs a real node_modules layout above it.
  fs.symlinkSync(REPO_NODE_MODULES, path.join(root, 'node_modules'), 'dir');

  const consumers = ['cjs', 'esm'].map(flavour => {
    const consumerDir = path.join(root, flavour);
    const target = path.join(consumerDir, 'node_modules', ...pkg.packageJson.name.split('/'));

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(pkg.libDir, target, { recursive: true });
    fs.writeFileSync(
      path.join(consumerDir, 'package.json'),
      `${JSON.stringify({ name: `smoke-${flavour}`, private: true, ...(flavour === 'esm' ? { type: 'module' } : {}) }, null, 2)}\n`,
    );

    return { flavour, dir: consumerDir };
  });

  return { root, consumers };
}

const PROBE_SOURCE = {
  cjs: `
const name = process.argv[2];
const entries = JSON.parse(process.argv[3]);
const resolveOnly = process.argv[4] === 'resolve-only';
const report = {};

for (const entry of entries) {
  const specifier = entry === '.' ? name : \`\${name}/\${entry.replace(/^\\.\\//, '')}\`;
  const record = { specifier };

  try {
    record.resolved = require.resolve(specifier);
  } catch (error) {
    record.error = describe(error, specifier);
    report[entry] = record;
    continue;
  }

  if (resolveOnly) {
    report[entry] = record;
    continue;
  }

  try {
    const loaded = require(specifier);
    record.keys = exportKeys(loaded);
  } catch (error) {
    record.error = describe(error, specifier);
  }

  report[entry] = record;
}

function exportKeys(loaded) {
  return Object.keys(loaded)
    .filter(key => key !== 'default' && key !== '__esModule')
    .sort();
}

// Node embeds a "Require stack" in MODULE_NOT_FOUND messages, so substring
// matching on the package name misreports a package's own missing dependency
// as the package itself being absent. Compare the quoted module name instead.
function describe(error, specifier) {
  const quoted = /Cannot find (?:module|package) '([^']+)'/.exec(error.message);

  return {
    code: error.code || null,
    message: error.message.split('\\n')[0],
    missingModule: quoted ? quoted[1] : null,
    selfMissing: quoted ? quoted[1] === specifier : false,
    // The importer that issued the failing require. Without it, ownership of a
    // CommonJS MODULE_NOT_FOUND cannot be decided: the message carries no
    // "imported from" the way the ESM loader's does.
    importer: Array.isArray(error.requireStack) ? error.requireStack[0] : null,
  };
}

process.stdout.write(JSON.stringify(report));
`,
  esm: `
import { existsSync } from 'node:fs';

const name = process.argv[2];
const entries = JSON.parse(process.argv[3]);
const resolveOnly = process.argv[4] === 'resolve-only';
const report = {};

for (const entry of entries) {
  const specifier = entry === '.' ? name : \`\${name}/\${entry.replace(/^\\.\\//, '')}\`;
  const record = { specifier };

  try {
    record.resolved = new URL(import.meta.resolve(specifier)).pathname;
  } catch (error) {
    record.error = describe(error, specifier);
    report[entry] = record;
    continue;
  }

  // import.meta.resolve maps the specifier without touching the disk, so an
  // exports map pointing at a file that was never emitted still "resolves".
  if (!existsSync(record.resolved)) {
    record.error = { code: 'RESOLVED_TARGET_MISSING', message: \`exports map points at \${record.resolved}, which does not exist\`, missingModule: null, selfMissing: true };
    report[entry] = record;
    continue;
  }

  if (resolveOnly) {
    report[entry] = record;
    continue;
  }

  try {
    const loaded = await import(specifier);
    record.keys = Object.keys(loaded).filter(key => key !== 'default').sort();
  } catch (error) {
    record.error = describe(error, specifier);
  }

  report[entry] = record;
}

function describe(error, specifier) {
  const quoted = /Cannot find (?:module|package) '([^']+)'/.exec(error.message);

  return {
    code: error.code || null,
    message: error.message.split('\\n')[0],
    missingModule: quoted ? quoted[1] : null,
    selfMissing: quoted ? quoted[1] === specifier : false,
  };
}

process.stdout.write(JSON.stringify(report));
`,
};

function nodeCommand(version, args, cwd) {
  const useFnm = Boolean(version);
  const file = useFnm ? 'fnm' : process.execPath;
  const argv = useFnm ? ['exec', `--using=${version}`, 'node', ...args] : args;

  return spawnSync(file, argv, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function runProbe(consumer, pkg, entries, nodeVersion) {
  const flavour = consumer.flavour;
  const probeFile = path.join(consumer.dir, flavour === 'cjs' ? 'probe.cjs' : 'probe.mjs');

  fs.writeFileSync(probeFile, PROBE_SOURCE[flavour]);

  const argv = [probeFile, pkg.packageJson.name, JSON.stringify(entries), ...(pkg.bundlerOnly ? ['resolve-only'] : [])];
  const result = nodeCommand(nodeVersion, argv, consumer.dir);

  if (result.status !== 0 || !result.stdout) {
    return { fatal: (result.stderr || result.stdout || 'probe crashed').split('\n').slice(0, 3).join(' ') };
  }

  try {
    return { report: JSON.parse(result.stdout) };
  } catch {
    return { fatal: result.stdout.slice(0, 200) };
  }
}

/** Package-specific probes exercise lazy paths that a bare import would not reach. */
function runExtraProbes(pkg, scratch, nodeVersion) {
  return ['cjs', 'mjs']
    .map(ext => ({ ext, file: path.join(PROBES_DIR, `${pkg.dirName}.${ext}`) }))
    .filter(({ file }) => fs.existsSync(file))
    .map(({ ext, file }) => {
      const consumer = scratch.consumers.find(c => c.flavour === (ext === 'cjs' ? 'cjs' : 'esm'));
      const copied = path.join(consumer.dir, `extra-probe.${ext}`);

      fs.copyFileSync(file, copied);

      const result = nodeCommand(nodeVersion, [copied, pkg.packageJson.name], consumer.dir);

      return {
        name: `${pkg.dirName}.${ext}`,
        ok: result.status === 0,
        detail: (result.stdout || '').trim().split('\n').slice(-3).join(' | '),
        error: result.status === 0 ? undefined : (result.stderr || '').split('\n').slice(0, 3).join(' '),
      };
    });
}

function runTypeMatrix(pkg, scratch) {
  const tsc = path.resolve(REPO_NODE_MODULES, 'typescript', 'bin', 'tsc');
  const entries = entryPointsOf(pkg.packageJson);

  return scratch.consumers.flatMap(consumer => {
    const srcDir = path.join(consumer.dir, 'src');

    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'index.ts'),
      `${entries
        .map((entry, index) => {
          const specifier = entry === '.' ? pkg.packageJson.name : `${pkg.packageJson.name}/${entry.replace(/^\.\//, '')}`;

          return `import * as ns${index} from '${specifier}';\nexport const e${index} = ns${index};`;
        })
        .join('\n')}\n`,
    );

    return TS_MATRIX.map(profile => {
      const tsconfig = path.join(consumer.dir, `tsconfig.${profile.id}.json`);

      fs.writeFileSync(
        tsconfig,
        `${JSON.stringify(
          {
            compilerOptions: {
              noEmit: true,
              strict: true,
              skipLibCheck: true,
              esModuleInterop: true,
              experimentalDecorators: true,
              emitDecoratorMetadata: true,
              target: 'es2022',
              types: ['node'],
              module: profile.module,
              moduleResolution: profile.moduleResolution,
            },
            include: ['src'],
          },
          null,
          2,
        )}\n`,
      );

      const result = spawnSync(process.execPath, [tsc, '-p', tsconfig], { cwd: consumer.dir, encoding: 'utf8' });
      // Third-party type errors (missing optional @types of a peer) are not ours.
      const ours = (result.stdout || '')
        .split('\n')
        .filter(line => line.includes('error TS'))
        .filter(line => line.startsWith('src/'));

      return { consumer: consumer.flavour, profile: profile.id, ok: ours.length === 0, errors: ours.slice(0, 3) };
    });
  });
}

/**
 * A load failure caused by a peer's own packaging is not a regression in this
 * artifact. Ownership is decided by whether the failing module belongs to the
 * package under test, never by substring-matching its name against the message:
 * Node embeds a "Require stack" that would make a package's own missing
 * dependency look like the package itself being absent.
 */
function ownsFailure(pkg, error) {
  if (error.selfMissing) return true;
  if (error.missingModule && error.missingModule.startsWith(pkg.packageJson.name)) return true;

  const insidePackage = filePath => filePath.includes(`node_modules/${pkg.packageJson.name}/`);
  // ESM reports the importer in the message; CommonJS reports it as a require
  // stack, whose first frame is the file that issued the failing require.
  const esmImporter = /imported from (\S+)/.exec(error.message);

  if (esmImporter) return insidePackage(esmImporter[1]);
  if (error.importer) return insidePackage(error.importer);

  // Undecidable failures count as ours: a guard rail that guesses "not my
  // problem" reports a broken package as green, which is the failure mode it
  // exists to prevent.
  return true;
}

function verify(pkg, entries, cjs, esm) {
  const issues = [];
  const warnings = [];

  if (cjs.fatal) issues.push(`CJS probe crashed: ${cjs.fatal}`);
  if (esm.fatal) issues.push(`ESM probe crashed: ${esm.fatal}`);
  if (cjs.fatal || esm.fatal) return { issues, warnings };

  const record = (error, description) => {
    const line = `${description} → ${error.code || ''} ${error.message}`;

    (ownsFailure(pkg, error) ? issues : warnings).push(line);
  };

  for (const entry of entries) {
    const c = cjs.report[entry];
    const e = esm.report[entry];

    if (c.error) record(c.error, `require('${c.specifier}')`);
    if (e.error) record(e.error, `import('${e.specifier}')`);

    const cjsFormat = c.resolved ? formatOfFile(pkg.packageJson, c.resolved) : undefined;
    const esmFormat = e.resolved ? formatOfFile(pkg.packageJson, e.resolved) : undefined;

    if (cjsFormat && cjsFormat.format !== 'cjs') {
      issues.push(`require('${c.specifier}') → ${path.basename(c.resolved)}, which is ESM (${cjsFormat.reason})`);
    }

    if (esmFormat && esmFormat.format !== 'esm') {
      issues.push(`import('${e.specifier}') → ${path.basename(e.resolved)}, which is CJS (${esmFormat.reason})`);
    }

    if (c.keys && e.keys) {
      const onlyCjs = c.keys.filter(key => !e.keys.includes(key));
      const onlyEsm = e.keys.filter(key => !c.keys.includes(key));

      if (onlyCjs.length || onlyEsm.length) {
        issues.push(
          `export sets differ for '${entry}': CJS-only [${onlyCjs.slice(0, 5).join(', ')}] ESM-only [${onlyEsm.slice(0, 5).join(', ')}]`,
        );
      }
    }
  }

  return { issues, warnings };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const packages = discoverPackages(args.packages);

  if (!packages.length) {
    console.error('No built packages found. Run `npm run build` (or `nx build <pkg>`) first.');
    process.exit(1);
  }

  const nodeVersions = args.nodes.length ? args.nodes : [null];
  const results = [];

  for (const pkg of packages) {
    const entries = entryPointsOf(pkg.packageJson);
    const scratch = createScratch(pkg);

    try {
      const staticIssues = verifyInternalSpecifiers(pkg.libDir);

      results.push({
        package: pkg.packageJson.name,
        node: 'static',
        kind: pkg.bundlerOnly ? 'artifact (bundler-only)' : 'artifact',
        issues: staticIssues,
        warnings: [],
      });

      for (const nodeVersion of nodeVersions) {
        const label = nodeVersion || process.version;
        const cjs = runProbe(scratch.consumers[0], pkg, entries, nodeVersion);
        const esm = runProbe(scratch.consumers[1], pkg, entries, nodeVersion);
        const { issues, warnings } = verify(pkg, entries, cjs, esm);
        const extras = pkg.bundlerOnly ? [] : runExtraProbes(pkg, scratch, nodeVersion);

        extras.filter(extra => !extra.ok).forEach(extra => issues.push(`probe ${extra.name}: ${extra.error}`));

        results.push({
          package: pkg.packageJson.name,
          node: label,
          kind: pkg.bundlerOnly ? 'resolve-only' : 'runtime',
          issues,
          warnings,
          extras,
        });
      }

      if (args.types) {
        const typeResults = runTypeMatrix(pkg, scratch);
        const issues = typeResults
          .filter(result => !result.ok)
          .map(result => `tsc ${result.consumer} consumer / ${result.profile}: ${result.errors.join(' ')}`);

        results.push({ package: pkg.packageJson.name, node: 'tsc', kind: 'types', issues, warnings: [] });
      }
    } finally {
      if (!args.keep) fs.rmSync(scratch.root, { recursive: true, force: true });
      else console.log(`scratch kept: ${scratch.root}`);
    }
  }

  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const result of results) {
      const status = result.issues.length ? 'FAIL' : 'ok';

      console.log(`[${status.padEnd(4)}] ${result.package.padEnd(46)} ${String(result.node).padEnd(10)} ${result.kind}`);
      result.issues.forEach(issue => console.log(`         ${issue}`));
      (result.warnings || []).forEach(warning => console.log(`         (peer) ${warning}`));
      (result.extras || []).filter(extra => extra.ok).forEach(extra => console.log(`         probe ${extra.name}: ${extra.detail}`));
    }
  }

  const failed = results.filter(result => result.issues.length).length;

  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main();
