import { escapeHtml } from './escape-html';

/**
 * The claims oidc-provider always asks for and that carry no meaning to a
 * person reading a consent screen. Listing them would bury the ones that do.
 */
const IMPLIED_CLAIMS = new Set(['sub', 'sid', 'auth_time', 'acr', 'amr', 'iss']);

/** `openid` is what makes this an authentication request at all. */
const IMPLIED_SCOPES = new Set(['openid']);

const renderList = (title: string, items: readonly string[]): string => {
  if (!items.length) return '';

  return `<section>
    <h2>${escapeHtml(title)}</h2>
    <ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
  </section>`;
};

/**
 * A deliberately plain, dependency-free consent page.
 *
 * The counterpart of the built-in login page and, like it, a development
 * convenience rather than the intended arrangement: reaching it logs a warning.
 * An application is expected to host its own page and point
 * `interaction.consentPageUrl` at it, or supply `interaction.renderConsent`.
 *
 * Both buttons are plain form submissions, so they arrive with
 * `Accept: text/html` and the endpoints answer with a 303.
 */
export const renderDefaultConsentPage = ({
  uid,
  clientName,
  missingScopes,
  missingClaims,
  missingResourceScopes,
  submitUrl,
  abortUrl,
}: {
  uid: string;
  clientName: string;
  missingScopes: readonly string[];
  missingClaims: readonly string[];
  missingResourceScopes: Readonly<Record<string, readonly string[]>>;
  /** default: resolved relative to the page's own URL. */
  submitUrl?: string;
  abortUrl?: string;
}): string => {
  // See renderDefaultLoginPage: the page is served from
  // `<prefix>/interaction/<uid>`, so relative actions repeat the uid.
  const consentAction = submitUrl ?? `${encodeURIComponent(uid)}/consent`;
  const denyAction = abortUrl ?? `${encodeURIComponent(uid)}/abort`;

  const scopes = missingScopes.filter(scope => !IMPLIED_SCOPES.has(scope));
  const claims = missingClaims.filter(claim => !IMPLIED_CLAIMS.has(claim));

  const resources = Object.entries(missingResourceScopes)
    .map(([indicator, indicatorScopes]) => renderList(indicator, indicatorScopes))
    .join('');

  const nothingToShow = !scopes.length && !claims.length && !resources;

  const body = nothingToShow
    ? '<p class="muted">This application is asking to confirm your identity.</p>'
    : `${renderList('Access', scopes)}${renderList('Information', claims)}${resources}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Authorize ${escapeHtml(clientName)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f6f8;color:#1c2536}
main{width:100%;max-width:400px;padding:32px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgb(0 0 0/10%)}
h1{font-size:20px;font-weight:600;margin-bottom:16px}
h2{font-size:13px;font-weight:600;color:#5b6577;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
section{margin-bottom:16px}
ul{list-style:none}
li{padding:6px 10px;background:#f4f6f8;border-radius:4px;font-size:14px;margin-bottom:4px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.muted{font-size:14px;color:#5b6577;margin-bottom:16px}
.actions{display:flex;gap:10px;margin-top:24px}
form{flex:1}
button{width:100%;padding:10px;font-size:14px;font-weight:500;border-radius:4px;cursor:pointer;border:none}
.allow{color:#fff;background:#027ae4}
.allow:hover{background:#0167c1}
.deny{color:#1c2536;background:#fff;border:1px solid #d9dee5}
.deny:hover{background:#f4f6f8}
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(clientName)} wants to access your account</h1>
  ${body}
  <div class="actions">
    <form method="post" action="${escapeHtml(denyAction)}">
      <button type="submit" class="deny">Deny</button>
    </form>
    <form method="post" action="${escapeHtml(consentAction)}">
      <button type="submit" class="allow">Allow</button>
    </form>
  </div>
</main>
</body>
</html>`;
};
