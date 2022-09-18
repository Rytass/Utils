# Rytass Utils - Secret Manager Nestjs Module (Vault)

### Getting Started

This module will get vault config from env with @nestjs/common, please set following env before use.

- VAULT_HOST (Vault service base url)
- VAULT_ACCOUNT
- VAULT_PASSWORD
- VAULT_PATH (Vault secret path from root)

```typescript
import { Module } from '@nestjs/common';
import { VaultService, VaultModule } from '@rytass/secret-adapter-vault-nestjs';

@Injectable()
class TestService {
  constructor(private readonly vault: VaultService) {}

  async getValue() {
    return vault.get<string>('key');
  }
}

@Module({
  imports: [VaultModule],
  providers: [TestService],
})
class TestModule {};
```
