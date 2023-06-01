import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VaultSecret, VaultSecretOptions, VaultSecretState } from '@rytass/secret-adapter-vault';
import { VAULT_PATH_TOKEN } from './constants';

@Injectable()
export class VaultService {
  private readonly manager?: VaultSecret<VaultSecretOptions>;

  private readonly onReadyCallbacks: ((dataSource?: { get: (key: string) => Promise<any> }) => void)[] = [];

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

        this.onReadyCallbacks.forEach(done => done(config));
      },
      onReady: () => {
        this.onReadyCallbacks.forEach(done => done());
      },
    });
  }

  public async get<T = string>(key: string): Promise<T> {
    if (this.fallbackToEnvFile) {
      return Promise.resolve((this.config.get<T>(key) || '') as T);
    }

    if (this.manager!.state === VaultSecretState.READY) {
      return this.manager!.get(key);
    }

    return new Promise((resolve) => {
      this.onReadyCallbacks.push((dataSource: { get: (key: string) => Promise<any> } = this.manager!) => {
        resolve(dataSource.get(key));
      });
    });
  }
}
