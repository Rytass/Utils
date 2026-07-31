import { escapeHtml } from './escape-html';

/**
 * A deliberately plain, dependency-free login page.
 *
 * This is a development convenience, not the intended arrangement: reaching it
 * logs a warning. An application is expected to host its own page and point
 * `interaction.loginPageUrl` at it, or — if it would rather render in-process —
 * to supply `interaction.renderLogin`. The page exists so the endpoint is
 * usable the moment it is mounted rather than requiring a template before it
 * can be tried at all.
 *
 * The form posts as a normal browser navigation, so the submission carries
 * `Accept: text/html` and the interaction endpoints answer it with a 303 rather
 * than the JSON an API client gets.
 */
export const renderDefaultLoginPage = ({
  uid,
  channels,
  error,
  submitUrl,
}: {
  uid: string;
  channels: readonly string[];
  error?: string;
  /** default: resolved relative to the page's own URL. */
  submitUrl?: string;
}): string => {
  const banner = error ? `<p class="error">${escapeHtml(error)}</p>` : '';

  // The page is served from `<prefix>/interaction/<uid>`, so a relative action
  // resolves against `<prefix>/interaction/` — the uid has to be repeated and
  // the `interaction` segment must not be.
  const action = submitUrl ?? `${encodeURIComponent(uid)}/login`;

  const channelField =
    channels.length > 1
      ? `<label for="channel">Sign in with</label>
      <select id="channel" name="channel">
        ${channels.map(channel => `<option value="${escapeHtml(channel)}">${escapeHtml(channel)}</option>`).join('')}
      </select>`
      : channels.length === 1
        ? `<input type="hidden" name="channel" value="${escapeHtml(channels[0])}">`
        : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f6f8;color:#1c2536}
form{width:100%;max-width:360px;padding:32px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgb(0 0 0/10%);
  display:flex;flex-direction:column;gap:14px}
h1{font-size:20px;font-weight:600;margin-bottom:6px}
label{font-size:13px;color:#5b6577}
input,select{width:100%;padding:9px 12px;font-size:14px;border:1px solid #d9dee5;border-radius:4px}
input:focus,select:focus{outline:none;border-color:#027ae4}
button{margin-top:6px;padding:10px;font-size:14px;font-weight:500;color:#fff;background:#027ae4;
  border:none;border-radius:4px;cursor:pointer}
button:hover{background:#0167c1}
.error{padding:10px;background:#fff1f0;color:#d4380d;border-radius:4px;font-size:13px;text-align:center}
</style>
</head>
<body>
<form method="post" action="${escapeHtml(action)}">
  <h1>Sign in</h1>
  ${banner}
  ${channelField}
  <label for="account">Account</label>
  <input id="account" name="account" autocomplete="username" autofocus required>
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">Sign in</button>
</form>
</body>
</html>`;
};
