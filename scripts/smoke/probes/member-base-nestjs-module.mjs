/**
 * Lazy-path probe (ESM consumer). Mirrors the CommonJS probe so both formats
 * are exercised along the same runtime paths, not just loaded.
 */

const name = process.argv[2];

const factory = await import(`${name}/oidc/oidc.factory`);

if (typeof factory.assertOidcProviderInstalled !== 'function') {
  console.error('assertOidcProviderInstalled missing from deep path oidc/oidc.factory');
  process.exit(1);
}

await factory.assertOidcProviderInstalled();

const bridge = await import(`${name}/oidc/sso-bridge.service.js`);

if (typeof bridge.OidcSsoBridge !== 'function') {
  console.error('OidcSsoBridge missing (jsonwebtoken default-import path)');
  process.exit(1);
}

const { escapeHtml } = await import(`${name}/oidc-provider`);

if (escapeHtml('<a>') !== '&lt;a&gt;') {
  console.error(`escapeHtml returned unexpected output: ${escapeHtml('<a>')}`);
  process.exit(1);
}

console.log('lazy paths ok: opaque dynamic import, jsonwebtoken default import, extensionless deep path');
