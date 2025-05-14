import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VaultSecret, VaultSecretOptions, VaultSecretState } from '@rytass/secret-adapter-vault';
import { VAULT_PATH_TOKEN } from './constants';

@Injectable()
export class VaultService {
  private readonly manager?: VaultSecret<VaultSecretOptions>;

  private readonly onReadyCallbacks: ((dataSource?: {
    get: (key: string) => Promise<any>;
  }) => void)[] = [];

  private fallbackToEnvFile = false;

  constructor(
    private readonly config: ConfigService,
    @Inject(VAULT_PATH_TOKEN) path: string,
  ) {
    const host = config.get<string>('VAULT_HOST') as string;
    const user = config.get<string>('VAULT_ACCOUNT') as string;
    const pass = config.get<string>('VAULT_PASSWORD') as string;

    if (!host) {
      this.fallbackToEnvFile = true;

      return;
    }

    this.manager = new VaultSecret(path, {
      host,
      auth: {
        account: user,
        password: pass,
      },
      onError: (err) => {
        this.fallbackToEnvFile = true;

        this.onReadyCallbacks.forEach((done) => done(config));
      },
      onReady: () => {
        this.onReadyCallbacks.forEach((done) => done());
      },
    });
  }

  /**
   * Retrieves a configuration value from Vault or falls back to `.env` if Vault is unavailable.
   *
   * This method returns the raw configuration value as type `T`.
   * If the value is a numeric string (e.g., `'900'`), it may be automatically parsed into a `number`.
   *
   * This method does not perform strict validation; if the key is missing, it may return `undefined` or an empty string,
   * depending on the source and the value's format.
   *
   * Use {@link VaultService.getStrict} if the value must be guaranteed to exist.
   *
   * @template T The expected return type of the configuration value.
   * @param {string} key - The configuration key to retrieve.
   * @returns {Promise<T>} The resolved configuration value, possibly `undefined` if not present.
   */
  public async get<T = string>(key: string): Promise<T> {
    if (this.fallbackToEnvFile) {
      return this.getFromEnvFile<T>(key);
    }

    return this.getFromVault<T>(key);
  }

  /**
   * Retrieves a configuration value for the given key.
   *
   * Similar to {@link VaultService.get}, but enforces strict presence.
   * Throws an error if the resolved value is `undefined`, `null`, or an empty string.
   *
   * Recommended for critical configuration keys that must always be defined.
   *
   * @template T The expected return type of the configuration value.
   * @param {string} key - The configuration key to retrieve.
   * @returns {Promise<T>} The resolved configuration value.
   * @throws {Error} If the value is missing or invalid.
   */
  public async getStrict<T = string>(key: string): Promise<T> {
    const value = await this.get<T>(key);

    // Strictly reject undefined, null, or empty string values; modify this check based on specific use cases.
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      throw new Error(`Missing required config key: "${key}"`);
    }

    return value;
  }

  private async getFromEnvFile<T = string>(key: string): Promise<T> {
    const raw = this.config.get<string>(key);
    const parsed = this.parseValue(raw);

    return (parsed ?? '') as T;
  }

  private async getFromVault<T = string>(key: string): Promise<T> {
    const raw =
      this.manager!.state === VaultSecretState.READY
        ? await this.manager!.get(key)
        : await new Promise<any>((resolve) => {
            this.onReadyCallbacks.push((dataSource) => {
              const source = dataSource ?? this.manager!;

              resolve(source.get(key));
            });
          });

    const parsed = this.parseValue(raw);

    return parsed as T;
  }

  private parseValue<T>(raw: unknown): T {
    if (typeof raw === 'number') {
      return raw as T;
    }

    if (typeof raw === 'string') {
      // Parse as number if string looks numeric — TS can't infer T at runtime.
      if (/^-?\d+$/.test(raw.trim())) {
        return Number(raw) as unknown as T;
      }
    }

    return raw as T;
  }
}
