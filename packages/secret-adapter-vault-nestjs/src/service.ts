import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VaultSecret, VaultSecretOptions, VaultSecretState } from '@rytass/secret-adapter-vault';
import { VAULT_PATH_TOKEN } from './constants';

@Injectable()
export class VaultService {
  private readonly manager: VaultSecret<VaultSecretOptions>;

  private readonly onReadyCallbacks: (() => void)[] = [];

  constructor(
    config: ConfigService,
    @Inject(VAULT_PATH_TOKEN) path: string,
  ) {
    const host = config.get<string>('VAULT_HOST') as string;
    const user = config.get<string>('VAULT_ACCOUNT') as string;
    const pass = config.get<string>('VAULT_PASSWORD') as string;

    this.manager = new VaultSecret(path, {
      host,
      auth: {
        account: user,
        password: pass,
      },
      onReady: () => {
        this.onReadyCallbacks.forEach(done => done());
      },
    });
  }

  public async get<T = string>(key: string): Promise<T> {
    if (this.manager.state === VaultSecretState.READY) {
      return this.manager.get(key);
    }

    return new Promise((resolve) => {
      this.onReadyCallbacks.push(() => {
        resolve(this.manager.get(key));
      });
    });
  }
}
