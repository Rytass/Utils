# Rytass Utils - Secret Manager

An abstract base class for secret management adapters in the Rytass ecosystem. Provides a unified interface for managing secrets across different secret storage backends like HashiCorp Vault, AWS Secrets Manager, and more.

## Features

- [x] Abstract base class for secret management
- [x] Project-based secret organization
- [x] Generic type support for secret values
- [x] CRUD operations for secrets
- [x] TypeScript support
- [x] Extensible architecture

## Installation

```bash
npm install @rytass/secret
# or
yarn add @rytass/secret
```

## Available Adapters

- **[@rytass/secret-adapter-vault](https://www.npmjs.com/package/@rytass/secret-adapter-vault)** - HashiCorp Vault adapter
- **[@rytass/secret-adapter-vault-nestjs](https://www.npmjs.com/package/@rytass/secret-adapter-vault-nestjs)** - NestJS module for Vault integration

## Basic Usage

### Implementing a Secret Manager

```typescript
import { SecretManager } from '@rytass/secret';

class MySecretManager extends SecretManager {
  constructor(project: string) {
    super(project);
  }

  async get<T>(key: string): Promise<T> {
    // Implement secret retrieval logic
    const secret = await this.retrieveFromBackend(key);
    return secret as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    // Implement secret storage logic
    await this.storeToBackend(key, value);
  }

  async delete(key: string): Promise<void> {
    // Implement secret deletion logic
    await this.deleteFromBackend(key);
  }

  private async retrieveFromBackend(key: string): Promise<any> {
    // Your implementation here
  }

  private async storeToBackend(key: string, value: any): Promise<void> {
    // Your implementation here
  }

  private async deleteFromBackend(key: string): Promise<void> {
    // Your implementation here
  }
}
```

### Using with Vault Adapter

```typescript
import { VaultSecretService } from '@rytass/secret-adapter-vault';

// Create Vault secret manager
const secretManager = new VaultSecretService('my-project', {
  baseURL: 'https://vault.example.com',
  token: 'your-vault-token',
  version: 'v1'
});

// Store a secret
await secretManager.set('database-password', 'super-secure-password');

// Retrieve a secret
const password = await secretManager.get<string>('database-password');
console.log('Database password:', password);

// Delete a secret
await secretManager.delete('old-api-key');
```

## Core Concepts

### Project-based Organization

The `SecretManager` class organizes secrets by project:

```typescript
// Different projects can have isolated secret namespaces
const productionSecrets = new VaultSecretService('production', options);
const stagingSecrets = new VaultSecretService('staging', options);

// Same key, different values per project
await productionSecrets.set('api-key', 'prod-key-12345');
await stagingSecrets.set('api-key', 'staging-key-67890');
```

### Generic Type Support

Store and retrieve typed secrets:

```typescript
interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

// Store complex objects
await secretManager.set<DatabaseConfig>('db-config', {
  host: 'localhost',
  port: 5432,
  username: 'admin',
  password: 'secret123'
});

// Retrieve with proper typing
const dbConfig = await secretManager.get<DatabaseConfig>('db-config');
console.log(`Connecting to ${dbConfig.host}:${dbConfig.port}`);
```

## Advanced Usage

### Configuration Management

```typescript
class ConfigManager {
  constructor(private secretManager: SecretManager) {}

  async getDatabaseConfig(): Promise<DatabaseConfig> {
    return this.secretManager.get<DatabaseConfig>('database');
  }

  async getApiKeys(): Promise<{ [service: string]: string }> {
    return this.secretManager.get<Record<string, string>>('api-keys');
  }

  async updateSecret(key: string, value: any): Promise<void> {
    await this.secretManager.set(key, value);
    console.log(`Secret '${key}' updated successfully`);
  }
}

// Usage
const configManager = new ConfigManager(secretManager);
const dbConfig = await configManager.getDatabaseConfig();
```

### Error Handling

```typescript
class SafeSecretManager extends SecretManager {
  constructor(project: string, private fallbackManager?: SecretManager) {
    super(project);
  }

  async get<T>(key: string): Promise<T> {
    try {
      return await this.primaryGet<T>(key);
    } catch (error) {
      console.warn(`Primary secret retrieval failed for '${key}':`, error);
      
      if (this.fallbackManager) {
        console.log(`Attempting fallback for '${key}'`);
        return this.fallbackManager.get<T>(key);
      }
      
      throw error;
    }
  }

  private async primaryGet<T>(key: string): Promise<T> {
    // Primary secret retrieval implementation
    throw new Error('Not implemented');
  }

  async set<T>(key: string, value: T): Promise<void> {
    // Implementation
  }

  async delete(key: string): Promise<void> {
    // Implementation
  }
}
```

### Caching Layer

```typescript
class CachedSecretManager extends SecretManager {
  private cache = new Map<string, { value: any; expiry: number }>();
  private ttl = 5 * 60 * 1000; // 5 minutes

  constructor(
    project: string,
    private baseManager: SecretManager
  ) {
    super(project);
  }

  async get<T>(key: string): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && cached.expiry > Date.now()) {
      return cached.value as T;
    }

    const value = await this.baseManager.get<T>(key);
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });

    return value;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.baseManager.set(key, value);
    // Invalidate cache
    this.cache.delete(key);
  }

  async delete(key: string): Promise<void> {
    await this.baseManager.delete(key);
    this.cache.delete(key);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

## Integration Examples

### Express.js Configuration

```typescript
import express from 'express';
import { VaultSecretService } from '@rytass/secret-adapter-vault';

const app = express();
const secrets = new VaultSecretService('api-server', {
  baseURL: process.env.VAULT_URL!,
  token: process.env.VAULT_TOKEN!
});

// Load configuration from secrets
async function loadConfig() {
  const config = {
    port: await secrets.get<number>('server-port'),
    jwtSecret: await secrets.get<string>('jwt-secret'),
    dbConfig: await secrets.get<DatabaseConfig>('database'),
    apiKeys: await secrets.get<Record<string, string>>('external-apis')
  };

  return config;
}

// Start server with secret-based configuration
loadConfig().then(config => {
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}).catch(error => {
  console.error('Failed to load configuration:', error);
  process.exit(1);
});
```

### NestJS Integration

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VaultSecretService } from '@rytass/secret-adapter-vault';

@Injectable()
export class SecretsService implements OnModuleInit {
  private secretManager: VaultSecretService;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.secretManager = new VaultSecretService(
      this.configService.get('PROJECT_NAME'),
      {
        baseURL: this.configService.get('VAULT_URL'),
        token: this.configService.get('VAULT_TOKEN')
      }
    );
  }

  async getDatabasePassword(): Promise<string> {
    return this.secretManager.get<string>('database-password');
  }

  async getApiKey(service: string): Promise<string> {
    const apiKeys = await this.secretManager.get<Record<string, string>>('api-keys');
    return apiKeys[service];
  }

  async updateSecret(key: string, value: any): Promise<void> {
    await this.secretManager.set(key, value);
  }
}
```

### Docker Secrets Integration

```typescript
import { readFileSync } from 'fs';
import { SecretManager } from '@rytass/secret';

class DockerSecretManager extends SecretManager {
  private secretsPath = '/run/secrets';

  async get<T>(key: string): Promise<T> {
    try {
      const secretPath = `${this.secretsPath}/${key}`;
      const content = readFileSync(secretPath, 'utf8').trim();
      
      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(content) as T;
      } catch {
        return content as T;
      }
    } catch (error) {
      throw new Error(`Failed to read Docker secret '${key}': ${error.message}`);
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    throw new Error('Docker secrets are read-only');
  }

  async delete(key: string): Promise<void> {
    throw new Error('Docker secrets cannot be deleted');
  }
}

// Usage in containerized environment
const dockerSecrets = new DockerSecretManager('myapp');
const dbPassword = await dockerSecrets.get<string>('db-password');
```

## API Reference

### SecretManager

The abstract base class that all secret managers must extend.

#### Constructor

```typescript
constructor(project: string)
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `project` | `string` | The project name for organizing secrets |

#### Methods

| Method | Description |
|--------|-------------|
| `get<T>(key: string): Promise<T> \| T` | Retrieve a secret by key |
| `set<T>(key: string, value: T): Promise<void> \| void` | Store a secret |
| `delete(key: string): Promise<void> \| void` | Delete a secret |

## Best Practices

### Security
- Never log secret values
- Use environment variables for secret manager credentials
- Implement proper access controls
- Regularly rotate secrets
- Use least-privilege principles

### Performance
- Implement caching for frequently accessed secrets
- Use connection pooling for secret backends
- Cache secret manager instances
- Implement circuit breakers for resilience

### Organization
- Use consistent naming conventions for secrets
- Group related secrets logically
- Document secret schemas and usage
- Implement secret lifecycle management

### Error Handling
- Implement graceful fallbacks
- Log security events appropriately
- Handle network failures gracefully
- Validate secret formats before use

## Development

### Creating a Custom Adapter

```typescript
import { SecretManager } from '@rytass/secret';

export interface MyBackendOptions {
  endpoint: string;
  apiKey: string;
}

export class MyBackendSecretManager extends SecretManager {
  constructor(
    project: string,
    private options: MyBackendOptions
  ) {
    super(project);
  }

  async get<T>(key: string): Promise<T> {
    // Implement your backend-specific logic
    const response = await fetch(`${this.options.endpoint}/secrets/${key}`, {
      headers: {
        'Authorization': `Bearer ${this.options.apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to retrieve secret: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.value as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const response = await fetch(`${this.options.endpoint}/secrets/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.options.apiKey}`
      },
      body: JSON.stringify({ value })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to store secret: ${response.statusText}`);
    }
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(`${this.options.endpoint}/secrets/${key}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.options.apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete secret: ${response.statusText}`);
    }
  }
}
```

## License

MIT