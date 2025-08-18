# Rytass Utils - HashiCorp Vault Secret Adapter

Comprehensive secret management adapter for HashiCorp Vault, providing secure storage and retrieval of sensitive configuration data. Features both online and offline modes with automatic token management, caching mechanisms, and support for Key-Value V2 secret engines.

## Features

### Authentication
- [x] Username/Password authentication (userpass)
- [x] Token-based authentication  
- [x] Automatic token renewal
- [x] Configurable token TTL

### Secret Engines
- [x] Key-Value V2 engine support
- [x] Online mode (real-time operations)
- [x] Offline mode (cached operations)
- [x] Version control and conflict resolution
- [x] Batch synchronization

### Advanced Features
- [x] Automatic caching for offline operations
- [x] Event-driven architecture
- [x] Error handling and retry mechanisms
- [x] TypeScript type safety
- [x] Connection health monitoring

## Installation

```bash
npm install @rytass/secret-adapter-vault
# or
yarn add @rytass/secret-adapter-vault
```

## Basic Usage

### Online Mode (Real-time Operations)

```typescript
import { VaultSecret } from '@rytass/secret-adapter-vault';

// Online mode - all operations hit Vault directly
const onlineVault = new VaultSecret('apps/myapp/config', {
  host: 'https://vault.company.com',
  online: true, // Enable online mode
  auth: {
    account: 'myapp-service',
    password: 'secure-password'
  }
});

// Wait for connection to be ready
await new Promise(resolve => {
  onlineVault.onReady(() => resolve(undefined));
});

// Get secret (async operation)
const dbPassword = await onlineVault.get<string>('DATABASE_PASSWORD');
console.log('DB Password:', dbPassword);

// Set new secret (async operation)
await onlineVault.set<string>('API_KEY', 'new-api-key-value');

// Delete secret (async operation)
await onlineVault.delete('OLD_CONFIG_KEY');
```

### Offline Mode (Cached Operations)

```typescript
import { VaultSecret } from '@rytass/secret-adapter-vault';

// Offline mode - operations use local cache
const offlineVault = new VaultSecret('apps/myapp/config', {
  host: 'https://vault.company.com',
  online: false, // Default offline mode
  auth: {
    account: 'myapp-service',
    password: 'secure-password'
  },
  onReady: async () => {
    console.log('Vault cache ready for offline operations');
    
    // All operations are synchronous and use cache
    const dbHost = offlineVault.get<string>('DATABASE_HOST');
    const dbPort = offlineVault.get<number>('DATABASE_PORT');
    
    // Modify cached values
    offlineVault.set<string>('NEW_FEATURE_FLAG', 'enabled');
    
    // Delete from cache
    offlineVault.delete('DEPRECATED_CONFIG');
    
    // Sync changes to Vault server
    try {
      await offlineVault.sync();
      console.log('Successfully synced changes to Vault');
    } catch (error) {
      console.error('Sync failed:', error);
    }
  },
  onError: (error) => {
    console.error('Vault connection error:', error);
  }
});
```

## Authentication Methods

### Username/Password Authentication

```typescript
const vault = new VaultSecret('secret/myapp', {
  host: 'https://vault.example.com',
  auth: {
    account: 'service-account',
    password: 'strong-password'
  },
  tokenTTL: 3600000 // 1 hour in milliseconds
});
```

### Token-based Authentication

```typescript
// Using existing token
const vault = new VaultSecret('secret/myapp', {
  host: 'https://vault.example.com',
  auth: {
    token: 'hvs.1234567890abcdef...' // Pre-existing token
  }
});
```

## Configuration Options

### VaultSecretOptions

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `host` | `string` | Yes | - | Vault server URL |
| `auth` | `VaultAuthMethods` | Yes | - | Authentication configuration |
| `online` | `boolean` | No | `false` | Enable online mode for real-time operations |
| `tokenTTL` | `number` | No | `2764724` | Token TTL in milliseconds |
| `onReady` | `function` | No | - | Callback when vault is ready |
| `onError` | `function` | No | - | Error callback |

### Authentication Types

```typescript
// Username/Password auth
interface UsernamePasswordAuth {
  account: string;
  password: string;
}

// Token auth  
interface TokenAuth {
  token: string;
}

type VaultAuthMethods = UsernamePasswordAuth | TokenAuth;
```

## Advanced Usage

### Environment-specific Configuration

```typescript
// Development environment
const devVault = new VaultSecret('apps/myapp/dev', {
  host: 'https://vault-dev.company.com',
  auth: {
    account: process.env.VAULT_USERNAME!,
    password: process.env.VAULT_PASSWORD!
  },
  online: true, // Real-time for development
  onReady: () => {
    console.log('Development vault ready');
  }
});

// Production environment  
const prodVault = new VaultSecret('apps/myapp/prod', {
  host: 'https://vault-prod.company.com',
  auth: {
    account: process.env.VAULT_PROD_USERNAME!,
    password: process.env.VAULT_PROD_PASSWORD!
  },
  online: false, // Cached for production performance
  tokenTTL: 7200000, // 2 hours
  onReady: () => {
    console.log('Production vault cache loaded');
  },
  onError: (error) => {
    console.error('Production vault error:', error);
    // Implement alerting/monitoring
  }
});
```

### Type-safe Secret Management

```typescript
// Define secret schema
interface AppSecrets {
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  API_TIMEOUT: number;
  FEATURE_FLAGS: {
    newFeature: boolean;
    betaAccess: boolean;
  };
  EMAIL_CONFIG: {
    smtp_host: string;
    smtp_port: number;
    username: string;
    password: string;
  };
}

class SecretManager {
  constructor(private vault: VaultSecret<any>) {}

  async getDatabaseUrl(): Promise<string> {
    return await this.vault.get<string>('DATABASE_URL');
  }

  async getRedisConfig(): Promise<{ url: string; timeout: number }> {
    const url = await this.vault.get<string>('REDIS_URL');
    const timeout = await this.vault.get<number>('REDIS_TIMEOUT') || 5000;
    
    return { url, timeout };
  }

  async getEmailConfig(): Promise<AppSecrets['EMAIL_CONFIG']> {
    return await this.vault.get<AppSecrets['EMAIL_CONFIG']>('EMAIL_CONFIG');
  }

  async updateFeatureFlag(flag: keyof AppSecrets['FEATURE_FLAGS'], enabled: boolean): Promise<void> {
    const currentFlags = await this.vault.get<AppSecrets['FEATURE_FLAGS']>('FEATURE_FLAGS') || {};
    
    await this.vault.set<AppSecrets['FEATURE_FLAGS']>('FEATURE_FLAGS', {
      ...currentFlags,
      [flag]: enabled
    });
  }
}
```

### Offline Mode with Synchronization Strategies

```typescript
class VaultManager {
  private vault: VaultSecret<any>;
  private syncInterval?: NodeJS.Timeout;

  constructor(secretPath: string, vaultConfig: any) {
    this.vault = new VaultSecret(secretPath, {
      ...vaultConfig,
      online: false,
      onReady: () => {
        this.startPeriodicSync();
      }
    });
  }

  // Periodic synchronization
  private startPeriodicSync() {
    this.syncInterval = setInterval(async () => {
      try {
        await this.vault.sync();
        console.log('Periodic sync completed');
      } catch (error) {
        console.error('Periodic sync failed:', error);
      }
    }, 300000); // Sync every 5 minutes
  }

  // Force sync with conflict resolution
  async forceSyncWithBackup(): Promise<void> {
    try {
      // Create backup of current cache
      const currentCache = { ...this.vault.getCacheData() };
      
      // Force sync (ignore version conflicts)
      await this.vault.sync(true);
      
      console.log('Force sync completed successfully');
    } catch (error) {
      console.error('Force sync failed:', error);
      // Could implement rollback logic here
      throw error;
    }
  }

  // Conditional sync based on last update
  async smartSync(maxCacheAge: number = 600000): Promise<boolean> {
    const lastSync = this.getLastSyncTime();
    const now = Date.now();
    
    if (now - lastSync > maxCacheAge) {
      try {
        await this.vault.sync();
        this.setLastSyncTime(now);
        return true;
      } catch (error) {
        console.error('Smart sync failed:', error);
        return false;
      }
    }
    
    return false; // No sync needed
  }

  private getLastSyncTime(): number {
    // Implementation depends on storage mechanism
    return parseInt(localStorage.getItem('vault_last_sync') || '0');
  }

  private setLastSyncTime(timestamp: number): void {
    localStorage.setItem('vault_last_sync', timestamp.toString());
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}
```

## Integration Examples

### Express.js Application

```typescript
import express from 'express';
import { VaultSecret } from '@rytass/secret-adapter-vault';

class AppConfig {
  private vault: VaultSecret<any>;
  private ready = false;

  constructor() {
    this.vault = new VaultSecret('apps/express-api/config', {
      host: process.env.VAULT_HOST!,
      auth: {
        account: process.env.VAULT_USERNAME!,
        password: process.env.VAULT_PASSWORD!
      },
      online: false, // Use cache for better performance
      onReady: () => {
        this.ready = true;
        console.log('Application configuration loaded from Vault');
      },
      onError: (error) => {
        console.error('Vault configuration error:', error);
        process.exit(1);
      }
    });
  }

  async waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ready) {
        resolve();
      } else {
        this.vault.onReady(() => resolve());
      }
    });
  }

  getDatabaseConfig() {
    return {
      host: this.vault.get<string>('DB_HOST'),
      port: this.vault.get<number>('DB_PORT'),
      database: this.vault.get<string>('DB_NAME'),
      username: this.vault.get<string>('DB_USER'),
      password: this.vault.get<string>('DB_PASSWORD')
    };
  }

  getJwtSecret(): string {
    return this.vault.get<string>('JWT_SECRET');
  }

  getRedisUrl(): string {
    return this.vault.get<string>('REDIS_URL');
  }
}

// Usage
const config = new AppConfig();

async function startServer() {
  // Wait for configuration to load
  await config.waitForReady();

  const app = express();
  
  // Use configuration
  const dbConfig = config.getDatabaseConfig();
  const jwtSecret = config.getJwtSecret();
  
  // Setup database connection
  // Setup JWT middleware
  // ... other setup
  
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch(console.error);
```

### NestJS Integration

```typescript
// Use with @rytass/secret-adapter-vault-nestjs for full NestJS integration
import { Injectable, OnModuleInit } from '@nestjs/common';
import { VaultSecret } from '@rytass/secret-adapter-vault';

@Injectable()
export class ConfigService implements OnModuleInit {
  private vault: VaultSecret<any>;
  private configLoaded = false;

  async onModuleInit() {
    this.vault = new VaultSecret('apps/nestjs-api/config', {
      host: process.env.VAULT_HOST!,
      auth: {
        account: process.env.VAULT_USERNAME!,
        password: process.env.VAULT_PASSWORD!
      },
      online: true, // Real-time for NestJS
      onReady: () => {
        this.configLoaded = true;
      }
    });

    // Wait for vault to be ready
    await new Promise(resolve => {
      if (this.configLoaded) {
        resolve(undefined);
      } else {
        this.vault.onReady(() => resolve(undefined));
      }
    });
  }

  async getDatabaseUrl(): Promise<string> {
    return await this.vault.get<string>('DATABASE_URL');
  }

  async getSecret(key: string): Promise<any> {
    return await this.vault.get(key);
  }

  async updateSecret(key: string, value: any): Promise<void> {
    await this.vault.set(key, value);
  }
}
```

### Microservices Configuration

```typescript
class MicroserviceConfig {
  private vault: VaultSecret<any>;
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.vault = new VaultSecret(`microservices/${serviceName}`, {
      host: process.env.VAULT_HOST!,
      auth: {
        account: `${serviceName}-service`,
        password: process.env[`${serviceName.toUpperCase()}_VAULT_PASSWORD`]!
      },
      online: false, // Offline for microservice performance
      tokenTTL: 1800000, // 30 minutes
      onReady: () => {
        console.log(`${serviceName} configuration ready`);
        this.registerHealthCheck();
      }
    });
  }

  private registerHealthCheck() {
    // Register with service discovery/health check system
    setInterval(() => {
      this.healthCheck();
    }, 30000);
  }

  private async healthCheck() {
    try {
      // Test vault connectivity
      await this.vault.get<string>('HEALTH_CHECK');
      console.log(`${this.serviceName}: Vault health check passed`);
    } catch (error) {
      console.error(`${this.serviceName}: Vault health check failed`, error);
      // Could trigger alerts or restart procedures
    }
  }

  getServiceConfig() {
    return {
      port: this.vault.get<number>('PORT') || 3000,
      logLevel: this.vault.get<string>('LOG_LEVEL') || 'info',
      timeout: this.vault.get<number>('TIMEOUT') || 30000,
      retries: this.vault.get<number>('RETRIES') || 3
    };
  }

  getDatabaseConfig() {
    return {
      url: this.vault.get<string>('DATABASE_URL'),
      maxConnections: this.vault.get<number>('DB_MAX_CONNECTIONS') || 10
    };
  }

  async rotateSecret(key: string, newValue: any) {
    // Store old value for rollback
    const oldValue = this.vault.get(key);
    
    try {
      this.vault.set(key, newValue);
      await this.vault.sync();
      console.log(`Secret ${key} rotated successfully`);
    } catch (error) {
      // Rollback on failure
      this.vault.set(key, oldValue);
      throw new Error(`Secret rotation failed for ${key}: ${error.message}`);
    }
  }
}
```

## Error Handling

```typescript
import { VaultSecret } from '@rytass/secret-adapter-vault';

// Comprehensive error handling
const vault = new VaultSecret('apps/myapp/config', {
  host: 'https://vault.company.com',
  auth: {
    account: 'service-account',
    password: 'secure-password'
  },
  online: true,
  onReady: () => {
    console.log('Vault connection established');
  },
  onError: (error) => {
    console.error('Vault error occurred:', error);
    
    // Handle different error types
    if (error.message.includes('authentication')) {
      console.error('Authentication failed - check credentials');
      // Could trigger credential rotation
    } else if (error.message.includes('network')) {
      console.error('Network error - vault unreachable');
      // Could trigger fallback to cached values
    } else if (error.message.includes('permission')) {
      console.error('Permission denied - check vault policies');
    }
    
    // Implement alerting/monitoring
    sendAlert(`Vault error: ${error.message}`);
  }
});

// Graceful error handling in operations
async function safeGetSecret(key: string, defaultValue?: any) {
  try {
    const value = await vault.get(key);
    return value !== undefined ? value : defaultValue;
  } catch (error) {
    console.error(`Failed to get secret ${key}:`, error);
    return defaultValue;
  }
}

async function safeSetSecret(key: string, value: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await vault.set(key, value);
      return true;
    } catch (error) {
      console.error(`Attempt ${attempt} failed for setting ${key}:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to set secret ${key} after ${maxRetries} attempts`);
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
  
  return false;
}

function sendAlert(message: string) {
  // Implement your alerting mechanism
  // Could be email, Slack, PagerDuty, etc.
}
```

## Security Best Practices

### Credential Management

```bash
# Environment variables for credentials
export VAULT_HOST="https://vault.company.com"
export VAULT_USERNAME="myapp-service"
export VAULT_PASSWORD="$(cat /run/secrets/vault-password)"
export VAULT_TOKEN_TTL="3600000"
```

### Access Policies

```hcl
# Example Vault policy for application
path "apps/myapp/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "shared/database/*" {
  capabilities = ["read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}
```

### Network Security

```typescript
// Use HTTPS and validate certificates
const vault = new VaultSecret('apps/myapp/config', {
  host: 'https://vault.company.com', // Always use HTTPS
  auth: {
    account: process.env.VAULT_USERNAME!,
    password: process.env.VAULT_PASSWORD!
  },
  // Additional security options could be added
});

// Implement network timeouts
const VAULT_TIMEOUT = 30000; // 30 seconds
```

## Performance Optimization

### Caching Strategies

```typescript
class OptimizedVaultManager {
  private vault: VaultSecret<any>;
  private localCache = new Map<string, { value: any; expiry: number }>();
  private cacheTimeout = 300000; // 5 minutes

  constructor(secretPath: string, vaultConfig: any) {
    this.vault = new VaultSecret(secretPath, {
      ...vaultConfig,
      online: false // Use offline mode for performance
    });
  }

  async getCached<T>(key: string): Promise<T> {
    const cached = this.localCache.get(key);
    
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }
    
    // Cache miss or expired
    const value = await this.vault.get<T>(key);
    
    this.localCache.set(key, {
      value,
      expiry: Date.now() + this.cacheTimeout
    });
    
    return value;
  }

  clearCache(): void {
    this.localCache.clear();
  }

  // Batch operations for efficiency
  async getBatch<T>(keys: string[]): Promise<Record<string, T>> {
    const results: Record<string, T> = {};
    
    for (const key of keys) {
      results[key] = await this.vault.get<T>(key);
    }
    
    return results;
  }
}
```

## Testing

```typescript
// Mock Vault for testing
class MockVaultSecret {
  private data = new Map<string, any>();
  private ready = true;

  constructor(private path: string, private options: any) {
    // Populate with test data
    this.data.set('TEST_SECRET', 'test-value');
    this.data.set('DB_HOST', 'localhost');
    this.data.set('DB_PORT', 5432);
  }

  get<T>(key: string): T {
    return this.data.get(key);
  }

  set<T>(key: string, value: T): void {
    this.data.set(key, value);
  }

  delete(key: string): void {
    this.data.delete(key);
  }

  async sync(): Promise<void> {
    // Mock sync operation
  }

  onReady(callback: () => void): void {
    if (this.ready) {
      callback();
    }
  }
}

// Test example
describe('VaultSecret', () => {
  let vault: MockVaultSecret;

  beforeEach(() => {
    vault = new MockVaultSecret('test/secrets', {});
  });

  it('should retrieve secrets', () => {
    const secret = vault.get<string>('TEST_SECRET');
    expect(secret).toBe('test-value');
  });

  it('should store secrets', () => {
    vault.set('NEW_SECRET', 'new-value');
    expect(vault.get('NEW_SECRET')).toBe('new-value');
  });
});
```

## License

MIT