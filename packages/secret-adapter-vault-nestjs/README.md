# Rytass Utils - Secret Adapter Vault NestJS

NestJS module for HashiCorp Vault integration, providing secure secret management with automatic fallback to environment variables. Seamlessly integrates with NestJS dependency injection and configuration system.

## Features

- [x] HashiCorp Vault integration for NestJS
- [x] Automatic fallback to environment variables
- [x] Global module support
- [x] TypeScript support with generics
- [x] Asynchronous secret retrieval
- [x] Secret writing and deletion
- [x] Online/offline sync support
- [x] Connection state management
- [x] Error handling with graceful degradation

## Installation

```bash
npm install @rytass/secret-adapter-vault-nestjs @rytass/secret-adapter-vault
# or
yarn add @rytass/secret-adapter-vault-nestjs @rytass/secret-adapter-vault
```

## Environment Configuration

Configure the following environment variables for Vault connection:

```bash
# Required for Vault connection
VAULT_HOST=https://vault.example.com:8200  # Vault service base URL
VAULT_ACCOUNT=your-username                # Vault username
VAULT_PASSWORD=your-password               # Vault password

# Optional - defaults to root path if not specified
VAULT_PATH=/secret/data/myapp             # Vault secret path from root
```

## Basic Usage

### Module Setup

```typescript
import { Module } from '@nestjs/common';
import { VaultModule } from '@rytass/secret-adapter-vault-nestjs';

@Module({
  imports: [
    VaultModule.forRoot({
      path: '/secret/data/myapp',  // Vault path for secrets
      fallbackFile: '.env',         // Optional: fallback env file
    })
  ],
})
export class AppModule {}
```

### Global Module Configuration

Make the VaultService available throughout your application:

```typescript
import { Module } from '@nestjs/common';
import { VaultModule } from '@rytass/secret-adapter-vault-nestjs';

@Module({
  imports: [
    VaultModule.forRoot({
      path: '/secret/data/myapp',
      fallbackFile: '.env'
    })
  ],
})
export class AppModule {}
```

### Using VaultService

```typescript
import { Injectable } from '@nestjs/common';
import { VaultService } from '@rytass/secret-adapter-vault-nestjs';

@Injectable()
export class ConfigurationService {
  constructor(private readonly vault: VaultService) {}

  async getDatabaseConfig() {
    const host = await this.vault.get<string>('DB_HOST');
    const port = await this.vault.get<number>('DB_PORT');
    const username = await this.vault.get<string>('DB_USERNAME');
    const password = await this.vault.get<string>('DB_PASSWORD');

    return {
      host,
      port,
      username,
      password
    };
  }

  async getApiKey(): Promise<string> {
    return this.vault.get<string>('API_KEY');
  }

  async updateApiKey(newKey: string): Promise<void> {
    // Update locally and sync to Vault
    await this.vault.set('API_KEY', newKey, true);
  }
}
```

## Advanced Usage

### Type-Safe Secret Retrieval

```typescript
interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  ssl: boolean;
}

@Injectable()
export class DatabaseService {
  constructor(private readonly vault: VaultService) {}

  async getConfig(): Promise<DatabaseConfig> {
    // Retrieve complex objects
    return this.vault.get<DatabaseConfig>('database');
  }

  async getConnectionString(): Promise<string> {
    const config = await this.getConfig();
    return `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/mydb`;
  }
}
```

### Managing Secrets

```typescript
@Injectable()
export class SecretManagementService {
  constructor(private readonly vault: VaultService) {}

  // Create or update a secret
  async createSecret(key: string, value: any): Promise<void> {
    // Save locally only
    await this.vault.set(key, value, false);
  }

  // Create and sync to Vault immediately
  async createAndSyncSecret(key: string, value: any): Promise<void> {
    await this.vault.set(key, value, true);
  }

  // Delete a secret
  async removeSecret(key: string): Promise<void> {
    // Delete locally only
    await this.vault.delete(key, false);
  }

  // Delete and sync removal to Vault
  async removeAndSyncSecret(key: string): Promise<void> {
    await this.vault.delete(key, true);
  }
}
```

### Fallback Mechanism

When Vault is unavailable, the service automatically falls back to environment variables:

```typescript
@Injectable()
export class ResilientConfigService {
  constructor(private readonly vault: VaultService) {}

  async getConfig() {
    // If Vault is unavailable, this will read from process.env
    const apiUrl = await this.vault.get<string>('API_URL');
    const apiKey = await this.vault.get<string>('API_KEY');

    return {
      apiUrl,
      apiKey
    };
  }
}
```

### Environment File Configuration

Specify a fallback environment file for when Vault is unavailable:

```typescript
// app.module.ts
@Module({
  imports: [
    VaultModule.forRoot({
      path: '/secret/data/production',
      fallbackFile: '.env.production'  // Fallback to .env.production file
    })
  ],
})
export class AppModule {}
```

## Integration Examples

### With TypeORM

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VaultModule, VaultService } from '@rytass/secret-adapter-vault-nestjs';

@Module({
  imports: [
    VaultModule.forRoot({
      path: '/secret/data/database'
    }),
    TypeOrmModule.forRootAsync({
      imports: [VaultModule],
      inject: [VaultService],
      useFactory: async (vault: VaultService) => ({
        type: 'postgres',
        host: await vault.get<string>('DB_HOST'),
        port: await vault.get<number>('DB_PORT'),
        username: await vault.get<string>('DB_USERNAME'),
        password: await vault.get<string>('DB_PASSWORD'),
        database: await vault.get<string>('DB_NAME'),
        synchronize: false,
        logging: true,
      })
    })
  ],
})
export class DatabaseModule {}
```

### With JWT Module

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VaultModule, VaultService } from '@rytass/secret-adapter-vault-nestjs';

@Module({
  imports: [
    VaultModule.forRoot({
      path: '/secret/data/auth'
    }),
    JwtModule.registerAsync({
      imports: [VaultModule],
      inject: [VaultService],
      useFactory: async (vault: VaultService) => ({
        secret: await vault.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: await vault.get<string>('JWT_EXPIRY') || '1h'
        }
      })
    })
  ],
})
export class AuthModule {}
```

### With Microservices

```typescript
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { VaultService } from '@rytass/secret-adapter-vault-nestjs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const vault = app.get(VaultService);

  const microservice = await NestFactory.createMicroservice({
    transport: Transport.REDIS,
    options: {
      host: await vault.get<string>('REDIS_HOST'),
      port: await vault.get<number>('REDIS_PORT'),
      password: await vault.get<string>('REDIS_PASSWORD'),
    }
  });

  await app.startAllMicroservices();
  await app.listen(3000);
}
```

## Error Handling

```typescript
@Injectable()
export class SafeConfigService {
  constructor(private readonly vault: VaultService) {}

  async getSensitiveConfig() {
    try {
      const secret = await this.vault.get<string>('SENSITIVE_KEY');
      
      if (!secret) {
        throw new Error('Sensitive key not found');
      }

      return secret;
    } catch (error) {
      // When Vault is down, it falls back to env vars automatically
      console.error('Failed to retrieve secret:', error);
      
      // You can implement additional fallback logic
      return process.env.FALLBACK_SENSITIVE_KEY || 'default-value';
    }
  }

  async trySaveSecret(key: string, value: string): Promise<boolean> {
    try {
      await this.vault.set(key, value, true);
      return true;
    } catch (error) {
      // Cannot save when in fallback mode
      console.error('Failed to save secret:', error.message);
      return false;
    }
  }
}
```

## Best Practices

### 1. Always Use Type Parameters

```typescript
// Good - Type-safe
const port = await vault.get<number>('PORT');
const config = await vault.get<DatabaseConfig>('db_config');

// Avoid - Returns any
const value = await vault.get('SOME_KEY');
```

### 2. Handle Fallback Scenarios

```typescript
@Injectable()
export class ConfigService {
  constructor(private readonly vault: VaultService) {}

  async initialize() {
    try {
      // Try to save a test value to check if Vault is writable
      await this.vault.set('health_check', 'ok', true);
      console.log('Vault is connected and writable');
    } catch (error) {
      console.warn('Running in read-only mode with environment variables');
    }
  }
}
```

### 3. Organize Secrets by Path

```typescript
// auth.module.ts
VaultModule.forRoot({ path: '/secret/data/auth' })

// database.module.ts  
VaultModule.forRoot({ path: '/secret/data/database' })

// api.module.ts
VaultModule.forRoot({ path: '/secret/data/external-apis' })
```

### 4. Use Environment-Specific Paths

```typescript
const environment = process.env.NODE_ENV || 'development';

@Module({
  imports: [
    VaultModule.forRoot({
      path: `/secret/data/${environment}`,
      fallbackFile: `.env.${environment}`
    })
  ],
})
export class AppModule {}
```

## API Reference

### VaultModule

#### `forRoot(options: VaultModuleOptions): DynamicModule`

Configure the Vault module.

**Options:**
- `path` (string, required): Vault secret path from root
- `fallbackFile` (string, optional): Path to fallback environment file

### VaultService

#### `get<T>(key: string): Promise<T>`

Retrieve a secret value.

**Parameters:**
- `key`: Secret key name

**Returns:** Promise resolving to the secret value

#### `set<T>(key: string, value: T, syncToOnline?: boolean): Promise<void>`

Store a secret value.

**Parameters:**
- `key`: Secret key name
- `value`: Value to store
- `syncToOnline`: Whether to sync immediately to Vault (default: false)

#### `delete(key: string, syncToOnline?: boolean): Promise<void>`

Delete a secret.

**Parameters:**
- `key`: Secret key name
- `syncToOnline`: Whether to sync deletion to Vault (default: false)

## Migration from ConfigService

```typescript
// Before - Using ConfigService
@Injectable()
export class OldService {
  constructor(private config: ConfigService) {}
  
  getValue() {
    return this.config.get('MY_KEY');
  }
}

// After - Using VaultService
@Injectable()
export class NewService {
  constructor(private vault: VaultService) {}
  
  async getValue() {
    return this.vault.get<string>('MY_KEY');
  }
}
```

## Troubleshooting

### Vault Connection Issues

If you see fallback warnings:
1. Check `VAULT_HOST` is accessible
2. Verify `VAULT_ACCOUNT` and `VAULT_PASSWORD` are correct
3. Ensure `VAULT_PATH` exists in Vault
4. Check network connectivity to Vault server

### Type Safety

Always specify type parameters for better TypeScript support:

```typescript
// Explicit types prevent runtime errors
const port = await vault.get<number>('PORT');
const features = await vault.get<string[]>('FEATURE_FLAGS');
const config = await vault.get<AppConfig>('APP_CONFIG');
```

## License

MIT