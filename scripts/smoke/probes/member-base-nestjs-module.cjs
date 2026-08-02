/**
 * Lazy-path probe (CommonJS consumer).
 *
 * Importing a module is not proof that it works: the paths that broke before
 * were reached only at runtime. This one actually executes them.
 *
 *   1. a deep path WITHOUT an extension, to prove the exports wildcards resolve
 *   2. assertOidcProviderInstalled(), which performs the deliberately opaque
 *      dynamic import of the ESM-only `oidc-provider`
 *   3. a module that default-imports the CJS-only `jsonwebtoken`
 *   4. a pure function from the isolated `/oidc-provider` entry point
 */

const name = process.argv[2];

(async () => {
  const factory = require(`${name}/oidc/oidc.factory`);

  if (typeof factory.assertOidcProviderInstalled !== 'function') {
    throw new Error('assertOidcProviderInstalled missing from deep path oidc/oidc.factory');
  }

  await factory.assertOidcProviderInstalled();

  const bridge = require(`${name}/oidc/sso-bridge.service.js`);

  if (typeof bridge.OidcSsoBridge !== 'function') {
    throw new Error('OidcSsoBridge missing (jsonwebtoken default-import path)');
  }

  const { escapeHtml } = require(`${name}/oidc-provider`);

  if (escapeHtml('<a>') !== '&lt;a&gt;') {
    throw new Error(`escapeHtml returned unexpected output: ${escapeHtml('<a>')}`);
  }

  console.log('lazy paths ok: opaque dynamic import, jsonwebtoken default import, extensionless deep path');
})().catch(error => {
  console.error(error.message);
  process.exit(1);
});
