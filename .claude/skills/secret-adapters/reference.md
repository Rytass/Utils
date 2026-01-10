# Secret Adapters API Reference

## @rytass/secret (Base Package)

### SecretManager Abstract Class

```typescript
abstract class SecretManager {
  constructor(project: string);

  get project(): string;

  abstract get<T>(key: string): Promise<T> | T;
  abstract set<T>(key: string, value: T): Promise<void> | void;
  abstract delete(key: string): Promise<void> | void;
}
```

---

## @rytass/secret-adapter-vault

### VaultSecret Class

```typescript
class VaultSecret<Options extends VaultSecretOptions> extends SecretManager {
  constructor(path: string, options: Options);

  // 狀態
  get state(): VaultSecretState;

  // CRUD 操作（返回型別依 online 模式）
  get<T>(key: string): VaultGetType<Options, T>;
  set<T>(key: string, value: T, syncToOnline?: boolean): VaultSetType<Options>;
  delete(key: string, syncToOnline?: boolean): VaultDeleteType<Options>;

  // 同步與終止
  sync(force?: boolean): Promise<void>;
  terminate(): void;
}
```

### VaultSecretOptions

```typescript
interface VaultSecretOptions {
  host: string;                              // Vault URL (必須 HTTPS)
  auth: VaultAuthMethods;                    // 認證配置
  online?: boolean;                          // 線上模式 (預設 false)
  tokenTTL?: number;                         // Token TTL 毫秒 (預設 2764724)
  onReady?: () => void;                      // 就緒回調
  onError?: (error: string) => void;         // 錯誤回調
}

// 線上模式專用
interface VaultSecretOnlineOptions extends VaultSecretOptions {
  online: true;
}

// 離線模式專用
interface VaultSecretOfflineOptions extends VaultSecretOptions {
  online?: false;
}
```

### VaultAuthMethods

```typescript
interface VaultAuthMethodAccountPassword {
  account: string;
  password: string;
}

type VaultAuthMethods = VaultAuthMethodAccountPassword;
```

### VaultSecretState

```typescript
enum VaultSecretState {
  INIT = 'INIT',
  READY = 'READY',
  TERMINATED = 'TERMINATED',
}
```

### VaultEvents

```typescript
enum VaultEvents {
  INITED = 'INITED',
  READY = 'READY',
  TOKEN_RENEWED = 'TOKEN_RENEWED',
  TERMINATED = 'TERMINATED',
  ERROR = 'ERROR',
}
```

### Type Inference

```typescript
// 線上模式返回型別
type VaultGetType<O extends VaultSecretOnlineOptions, T> = Promise<T>;
type VaultSetType<O extends VaultSecretOnlineOptions> = Promise<void>;
type VaultDeleteType<O extends VaultSecretOnlineOptions> = Promise<void>;

// 離線模式返回型別
type VaultGetType<O extends VaultSecretOfflineOptions, T> = T;
type VaultSetType<O extends VaultSecretOfflineOptions> = void;
type VaultDeleteType<O extends VaultSecretOfflineOptions> = void;
```

---

## @rytass/secret-adapter-vault-nestjs

### VaultModule

```typescript
@Global()
@Module({})
class VaultModule {
  static forRoot(options?: VaultModuleOptions): DynamicModule;
}
```

### VaultModuleOptions

```typescript
interface VaultModuleOptions {
  path?: string;          // Vault 路徑 (預設 '/')
  fallbackFile?: string;  // 備用 .env 檔案路徑
}
```

### VaultService

```typescript
@Injectable()
class VaultService {
  async get<T = string>(key: string): Promise<T>;
  async set<T = string>(key: string, value: T, syncToOnline?: boolean): Promise<void>;
  async delete(key: string, syncToOnline?: boolean): Promise<void>;
}
```

### Environment Variables

| 變數 | 必需 | 說明 |
|------|------|------|
| `VAULT_HOST` | 是 | Vault 伺服器 URL |
| `VAULT_ACCOUNT` | 是 | Vault 帳戶 |
| `VAULT_PASSWORD` | 是 | Vault 密碼 |
| `VAULT_PATH` | 否 | Vault 路徑 (預設 `/`) |

---

## Complete Examples

### 離線模式完整範例

```typescript
import { VaultSecret, VaultSecretState } from '@rytass/secret-adapter-vault';

interface AppConfig {
  database: {
    host: string;
    port: number;
    password: string;
  };
  api: {
    key: string;
    secret: string;
  };
}

const vault = new VaultSecret<{
  host: string;
  auth: { account: string; password: string };
  online: false;
}>('apps/production/config', {
  host: process.env.VAULT_HOST!,
  online: false,
  auth: {
    account: process.env.VAULT_ACCOUNT!,
    password: process.env.VAULT_PASSWORD!,
  },
  onReady: () => {
    console.log('Vault initialized');

    // 同步讀取
    const dbHost = vault.get<string>('DB_HOST');
    const dbPort = vault.get<number>('DB_PORT');
    const dbPassword = vault.get<string>('DB_PASSWORD');

    console.log(`Database: ${dbHost}:${dbPort}`);

    // 設置新值（本地快取）
    vault.set('LAST_UPDATED', new Date().toISOString());

    // 同步到 Vault
    vault.sync().then(() => {
      console.log('Changes synced to Vault');
    });
  },
  onError: (error) => {
    console.error('Vault error:', error);
    process.exit(1);
  },
});

// 優雅關閉
process.on('SIGTERM', () => {
  if (vault.state !== VaultSecretState.TERMINATED) {
    vault.terminate();
  }
  process.exit(0);
});
```

### 線上模式完整範例

```typescript
import { VaultSecret } from '@rytass/secret-adapter-vault';

async function main() {
  const vault = new VaultSecret('apps/production/config', {
    host: process.env.VAULT_HOST!,
    online: true,
    tokenTTL: 3600000, // 1 小時
    auth: {
      account: process.env.VAULT_ACCOUNT!,
      password: process.env.VAULT_PASSWORD!,
    },
  });

  // 等待就緒（線上模式需要）
  await new Promise<void>((resolve, reject) => {
    const checkReady = setInterval(() => {
      if (vault.state === 'READY') {
        clearInterval(checkReady);
        resolve();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkReady);
      reject(new Error('Vault connection timeout'));
    }, 10000);
  });

  // 異步操作
  const apiKey = await vault.get<string>('API_KEY');
  console.log('API Key loaded');

  await vault.set('API_USAGE_COUNT', 0);
  console.log('Usage counter initialized');

  // 批量讀取
  const [dbHost, dbPort, dbName] = await Promise.all([
    vault.get<string>('DB_HOST'),
    vault.get<number>('DB_PORT'),
    vault.get<string>('DB_NAME'),
  ]);

  console.log(`Database: ${dbHost}:${dbPort}/${dbName}`);
}

main().catch(console.error);
```

### NestJS 完整整合範例

```typescript
// vault.module.ts
import { Module } from '@nestjs/common';
import { VaultModule } from '@rytass/secret-adapter-vault-nestjs';

@Module({
  imports: [
    VaultModule.forRoot({
      path: '/secret/data/production',
      fallbackFile: '.env.production',
    }),
  ],
  exports: [VaultModule],
})
export class SecretModule {}

// database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VaultService } from '@rytass/secret-adapter-vault-nestjs';
import { SecretModule } from './vault.module';

@Module({
  imports: [
    SecretModule,
    TypeOrmModule.forRootAsync({
      imports: [SecretModule],
      inject: [VaultService],
      useFactory: async (vault: VaultService) => ({
        type: 'postgres',
        host: await vault.get<string>('DB_HOST'),
        port: await vault.get<number>('DB_PORT'),
        username: await vault.get<string>('DB_USERNAME'),
        password: await vault.get<string>('DB_PASSWORD'),
        database: await vault.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        logging: await vault.get<string>('DB_LOGGING') === 'true',
      }),
    }),
  ],
})
export class DatabaseModule {}

// config.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { VaultService } from '@rytass/secret-adapter-vault-nestjs';

@Injectable()
export class ConfigService implements OnModuleInit {
  private config: Record<string, unknown> = {};

  constructor(private readonly vault: VaultService) {}

  async onModuleInit() {
    // 預載入常用配置
    this.config = {
      apiUrl: await this.vault.get<string>('API_URL'),
      apiKey: await this.vault.get<string>('API_KEY'),
      logLevel: await this.vault.get<string>('LOG_LEVEL'),
    };
  }

  get<T>(key: string): T {
    return this.config[key] as T;
  }

  async refresh(): Promise<void> {
    this.config = {
      apiUrl: await this.vault.get<string>('API_URL'),
      apiKey: await this.vault.get<string>('API_KEY'),
      logLevel: await this.vault.get<string>('LOG_LEVEL'),
    };
  }
}

// app.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { VaultService } from '@rytass/secret-adapter-vault-nestjs';

@Controller('config')
export class AppController {
  constructor(private readonly vault: VaultService) {}

  @Get('api-key')
  async getApiKey(): Promise<{ key: string }> {
    const key = await this.vault.get<string>('API_KEY');
    return { key: key.substring(0, 4) + '****' }; // 遮蔽
  }

  @Post('update')
  async updateConfig(
    @Body() body: { key: string; value: string },
  ): Promise<{ success: boolean }> {
    await this.vault.set(body.key, body.value, true); // 同步到 Vault
    return { success: true };
  }
}
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    應用程式（NestJS）                     │
└─────────────────────────────┬───────────────────────────┘
                              │ @Inject(VaultService)
                              ▼
┌─────────────────────────────────────────────────────────┐
│        @rytass/secret-adapter-vault-nestjs              │
│                   VaultModule + VaultService             │
│  • 全域模組        • 非同步初始化                         │
│  • 自動備用        • 依賴注入                            │
└─────────────────────────────┬───────────────────────────┘
                              │ 建立實例
                              ▼
┌─────────────────────────────────────────────────────────┐
│         @rytass/secret-adapter-vault                    │
│              VaultSecret 類別                            │
│  • 線上/離線模式   • Token 管理                         │
│  • 事件驅動        • 版本控制                           │
└─────────────────────────────┬───────────────────────────┘
                              │ 繼承
                              ▼
┌─────────────────────────────────────────────────────────┐
│              @rytass/secret                             │
│         SecretManager 抽象類別                           │
│  • 統一介面        • 泛型支持                           │
│  • 專案隔離        • CRUD 操作                          │
└─────────────────────────────────────────────────────────┘
```

---

## Comparison Table

| 功能 | @rytass/secret | @rytass/secret-adapter-vault | vault-nestjs |
|------|----------------|------------------------------|--------------|
| 類型 | 抽象類別 | 具體實現 | NestJS 模組 |
| get() | `Promise<T> \| T` | 依 online | `Promise<T>` |
| set() | `Promise<void> \| void` | 依 online | `Promise<void>` |
| 備用機制 | 無 | 無 | 自動 (env) |
| Token 管理 | 無 | 自動續期 | 自動 |
| 依賴注入 | 無 | 無 | 全域 |

---

## Dependency Matrix

| 套件 | 依賴 | 版本 |
|------|------|------|
| @rytass/secret | - | - |
| @rytass/secret-adapter-vault | axios, @rytass/secret | ^1.13.2, ^0.1.3 |
| @rytass/secret-adapter-vault-nestjs | 上述 + @nestjs/common, @nestjs/config | ^10.0.0 |
