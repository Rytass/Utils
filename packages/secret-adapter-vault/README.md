# Rytass Utils - Secret Manager (Vault)

## Featues

### Auth
- [x] Vault Auth (userpass)
- [ ] Vault Auth (token)

### Engines
- [x] Key-Value V2 [Online mode]
- [x] Key-Value V2 [Offline mode]
## Getting Started

```typescript
import { VaultSecret } from '@rytass/secret-adapter-vault';

const offlineManager = new VaultSecret('rytass/utils', {
  host: 'https://vault.server.com',
  auth: {
    account: 'account',
    password: 'complex_text',
  },
  onReady: () => {
    const dbHost = offlineManager.get<string>('DB_HOST');

    offlineManager.set<string>('NEW_KEY', 'BAR');

    const newKey = offlineManager.get<string>('NEW_KEY'); // BAR

    offlineManager.delete('NEW_KEY');

    offlineManager.sync().then(() => {
      // Synced local cache to server
    });

    // Force replace online data (ignore version check)
    offlineManager.sync(true);
  },
});

const onlineManager = new VaultSecret('rytass/utils', {
  host: 'https://vault.server.com',
  online: true,
  auth: {
    account: 'account',
    password: 'complex_text',
  },
});

const dbUser = await onlineManager.get<string>('DB_USER');

await onlineManager.set<number>('USAGE_COUNT', 6);

const usage = await onlineManager.get<number>('USAGE_COUNT');

await onlineManager.delete('USAGE_COUNT');
```
