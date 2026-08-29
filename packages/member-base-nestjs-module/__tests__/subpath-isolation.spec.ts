import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

/**
 * Guards the opt-in promise made by the subpath entry points.
 *
 * The claim is not "a bundler will tree-shake it away" — backend applications
 * externalize node_modules and never tree-shake them. The claim is stronger:
 * a subpath that is never imported is never resolved, so its dependencies are
 * never required. That is a property of module resolution, and this test keeps
 * it honest.
 *
 * Runs against lib/, so it is skipped when the package has not been built.
 */

const packageRoot = resolve(__dirname, '..');
const libPath = resolve(packageRoot, 'lib');
const builtIndex = resolve(libPath, 'index.cjs');

const describeBuilt = existsSync(builtIndex) ? describe : describe.skip;

describeBuilt('subpath isolation', () => {
  const requireFromLib = createRequire(resolve(libPath, 'noop.cjs'));

  const loadInIsolation = (specifiers: string[]): string[] => {
    // A fresh require cache per assertion; otherwise an earlier test importing
    // the ldap entry would make every later assertion pass trivially.
    Object.keys(requireFromLib.cache).forEach(key => delete requireFromLib.cache[key]);

    specifiers.forEach(specifier => requireFromLib(specifier));

    return Object.keys(requireFromLib.cache);
  };

  it('should not pull ldapts in when only the package root is imported', () => {
    const loaded = loadInIsolation([builtIndex]);

    expect(loaded.some(file => file.includes('/ldapts/'))).toBe(false);
  });

  it('should not reach the ldap entry from the package root', () => {
    const loaded = loadInIsolation([builtIndex]);

    expect(loaded.some(file => file.endsWith('ldap.cjs'))).toBe(false);
  });

  it('should not pull ldapts in through the entra entry', () => {
    // Entra needs no dependency of its own — Node's fetch and the jsonwebtoken
    // peer the package already requires — and must not drag another entry's in.
    const loaded = loadInIsolation([resolve(libPath, 'entra.cjs')]);

    expect(loaded.some(file => file.includes('/ldapts/'))).toBe(false);
  });

  it('should pull ldapts in once the ldap entry is imported', () => {
    const loaded = loadInIsolation([resolve(libPath, 'ldap.cjs')]);

    expect(loaded.some(file => file.includes('/ldapts/'))).toBe(true);
  });

  it('should not reach the oidc provider entry from the package root', () => {
    const loaded = loadInIsolation([builtIndex]);

    expect(loaded.some(file => file.endsWith('oidc-provider.cjs'))).toBe(false);
  });

  it('should not register the oidc tables when only the package root is imported', () => {
    loadInIsolation([builtIndex]);

    // autoLoadEntities only ever sees an entity once a module registering it
    // enters the graph, so an unregistered entity means no table.
    const { getMetadataArgsStorage } = require('typeorm') as typeof import('typeorm');
    const tables = getMetadataArgsStorage().tables.map(table => table.name);

    expect(tables).not.toContain('oidc_payloads');
    expect(tables).not.toContain('oidc_clients');
  });

  it('should register the oidc tables once the provider entry is imported', () => {
    loadInIsolation([builtIndex, resolve(libPath, 'oidc-provider.cjs')]);

    const { getMetadataArgsStorage } = require('typeorm') as typeof import('typeorm');
    const tables = getMetadataArgsStorage().tables.map(table => table.name);

    expect(tables).toEqual(expect.arrayContaining(['oidc_payloads', 'oidc_clients']));
  });

  it('should share one module instance between the root and a subpath', () => {
    // Separate rollup passes per entry used to inline a private copy of every
    // shared module, which broke Symbol() injection tokens and entity classes.
    Object.keys(requireFromLib.cache).forEach(key => delete requireFromLib.cache[key]);

    const root = requireFromLib(builtIndex) as Record<string, unknown>;
    const graphql = requireFromLib(resolve(libPath, 'graphql.cjs')) as Record<string, unknown>;

    expect(typeof root.MemberBaseService).toBe('function');
    expect(typeof graphql.TokenPairGraphQLDto).toBe('function');
  });

  it('should declare every published subpath in the exports map', () => {
    const packageJson = requireFromLib(resolve(libPath, 'package.json')) as {
      exports?: Record<string, unknown>;
    };

    expect(Object.keys(packageJson.exports ?? {})).toEqual(
      expect.arrayContaining(['.', './entra', './graphql', './ldap', './oidc-provider', './package.json']),
    );
  });
});
