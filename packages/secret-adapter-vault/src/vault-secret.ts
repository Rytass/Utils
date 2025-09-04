import { SecretManager } from '@rytass/secret';
import axios, { AxiosError } from 'axios';
import { EventEmitter } from 'events';
import { VaultSecretOptions } from './typings';
import {
  VaultAuthMethods,
  VaultEvents,
  VaultGetSecretResponse,
  VaultAPIFailedResponse,
  VaultTokenRetrieveResponse,
  VaultTokenRetrieveSuccessResponse,
  VaultGetSecretSuccessResponse,
  VaultSecretState,
  VaultSecretOnlineOptions,
  VaultGetType,
  VaultSetType,
  VaultDeleteType,
} from './typings';

export class VaultSecret<Options extends VaultSecretOptions> extends SecretManager {
  private readonly _host: string;
  private readonly _auth: VaultAuthMethods;
  private readonly _tokenTTL: number = 2764724;
  private readonly _sessionInterval?: ReturnType<typeof setInterval>;

  private _state: VaultSecretState = VaultSecretState.INIT;

  private readonly emitter = new EventEmitter();

  private _tokenExpiredOn?: number;
  private _token?: string;
  private readonly _online: boolean = false;

  private _cacheData: Record<string, any> | undefined;
  private _cacheVersion: number | undefined;

  constructor(path: string, options: Options) {
    super(path);

    this._host = options.host;
    this._auth = options.auth;
    this._tokenTTL = options.tokenTTL || this._tokenTTL;
    this._online = options.online || this._online;

    this.retrieveToken()
      ?.then(async () => {
        if (!this._online) {
          [this._cacheData, this._cacheVersion] = await this.getSecretVersionOnline();
        }

        this._state = VaultSecretState.READY;

        this.emitter.emit(VaultEvents.READY);
      })
      .catch(ex => {
        this.emitter.emit(VaultEvents.ERROR, ex);
      });

    if (typeof options.onError === 'function') {
      this.emitter.on(VaultEvents.ERROR, options.onError);
    }

    if (typeof options.onReady === 'function') {
      this.emitter.on(VaultEvents.READY, options.onReady);
    }

    if (this._online) {
      this._sessionInterval = setInterval(() => this.checkRenew(), this._tokenTTL);
    }
  }

  private checkRenew() {
    if (this._token) this.renewToken();
  }

  private retrieveToken() {
    if (this._auth.account) {
      return this.retrieveTokenByUserPass(this._auth.account, this._auth.password);
    }
  }

  private async retrieveTokenByUserPass(account: string, password: string) {
    const { data } = await axios.post<VaultTokenRetrieveResponse>(
      `${this._host}/v1/auth/userpass/login/${account}`,
      JSON.stringify({
        password,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (Array.isArray((data as VaultAPIFailedResponse)?.errors)) {
      (data as VaultAPIFailedResponse)?.errors.forEach(error => {
        this.emitter.emit(VaultEvents.ERROR, error);
      });

      this.terminate();

      return;
    }

    this._token = (data as VaultTokenRetrieveSuccessResponse).auth.client_token;
    this._tokenExpiredOn =
      Date.now() + Math.max((data as VaultTokenRetrieveSuccessResponse).auth.lease_duration - 300, 0); // Calculate safety expires time
  }

  private async renewToken() {
    if (this._tokenExpiredOn! < Date.now()) {
      return this.retrieveToken();
    }

    const { data } = await axios.post<VaultTokenRetrieveResponse>(`${this._host}/v1/auth/token/renew-self`, null, {
      headers: {
        'X-Vault-Token': this._token!,
      },
    });

    if (Array.isArray((data as VaultAPIFailedResponse)?.errors)) {
      (data as VaultAPIFailedResponse)?.errors.forEach(error => {
        this.emitter.emit(VaultEvents.ERROR, error);
      });

      this.terminate();

      return;
    }

    this._token = (data as VaultTokenRetrieveSuccessResponse).auth.client_token;
    this._tokenExpiredOn = Date.now() + (data as VaultTokenRetrieveSuccessResponse).auth.lease_duration - 300; // Calculate safety expires time

    this.emitter.emit(VaultEvents.TOKEN_RENEWED);
  }

  private async getSecretVersionOnline(): Promise<[Record<string, any>, number]> {
    try {
      const { data } = await axios.get<VaultGetSecretResponse>(`${this._host}/v1/secret/data/${this.project}`, {
        headers: {
          'X-Vault-Token': this._token!,
        },
      });

      if (Array.isArray((data as VaultAPIFailedResponse)?.errors)) {
        (data as VaultAPIFailedResponse)?.errors.forEach(error => {
          this.emitter.emit(VaultEvents.ERROR, error);
        });

        throw new Error((data as VaultAPIFailedResponse)?.errors.join(', '));
      }

      return [
        (data as VaultGetSecretSuccessResponse).data.data,
        (data as VaultGetSecretSuccessResponse).data.metadata.version,
      ];
    } catch (ex) {
      if (axios.isAxiosError(ex)) {
        const { response } = ex as AxiosError;

        switch (response?.status) {
          case 404:
            return [{}, 0];

          case 403:
          default:
            this.emitter.emit(VaultEvents.ERROR, ex);

            throw ex;
        }
      }

      throw ex;
    }
  }

  private getSecretValue<T>(key: string): Promise<T> | T {
    if (!this._online) {
      return this._cacheData![key];
    }

    return this.getSecretVersionOnline().then(([currentVersion]) => currentVersion[key] || undefined);
  }

  private async fullReplaceSecretValue(newData: Record<string, any>): Promise<void> {
    await this.renewToken();

    const { data } = await axios.post<VaultGetSecretResponse>(
      `${this._host}/v1/secret/data/${this.project}`,
      JSON.stringify({
        data: newData,
      }),
      {
        headers: {
          'X-Vault-Token': this._token!,
        },
      },
    );

    if (Array.isArray((data as VaultAPIFailedResponse)?.errors)) {
      (data as VaultAPIFailedResponse)?.errors.forEach(error => {
        this.emitter.emit(VaultEvents.ERROR, error);
      });

      throw new Error((data as VaultAPIFailedResponse)?.errors.join(', '));
    }
  }

  private async setSecretValueOnline<T>(key: string, value: T): Promise<void> {
    const [currentValue, currentVersion] = await this.getSecretVersionOnline();

    const { data } = await axios.post<VaultGetSecretResponse>(
      `${this._host}/v1/secret/data/${this.project}`,
      JSON.stringify({
        data: {
          ...currentValue,
          [key]: value,
        },
        options: {
          cas: currentVersion,
        },
      }),
      {
        headers: {
          'X-Vault-Token': this._token!,
        },
      },
    );

    if (Array.isArray((data as VaultAPIFailedResponse)?.errors)) {
      (data as VaultAPIFailedResponse)?.errors.forEach(error => {
        this.emitter.emit(VaultEvents.ERROR, error);
      });

      throw new Error((data as VaultAPIFailedResponse)?.errors.join(', '));
    }

    if (!this._online) {
      this._cacheData![key] = value;
    }
  }

  private async removeSecretKeyOnline(key: string): Promise<void> {
    const [currentValue, currentVersion] = await this.getSecretVersionOnline();

    if (!currentValue[key]) throw new Error('Secret key not found');

    const { data } = await axios.post<VaultGetSecretResponse>(
      `${this._host}/v1/secret/data/${this.project}`,
      JSON.stringify({
        data: {
          ...Object.entries(currentValue).reduce((vars, [secretKey, secret]) => {
            if (secretKey === key) return vars;

            return {
              ...vars,
              [secretKey]: secret,
            };
          }, {}),
        },
        options: {
          cas: currentVersion,
        },
      }),
      {
        headers: {
          'X-Vault-Token': this._token!,
        },
      },
    );

    if (Array.isArray((data as VaultAPIFailedResponse)?.errors)) {
      (data as VaultAPIFailedResponse)?.errors.forEach(error => {
        this.emitter.emit(VaultEvents.ERROR, error);
      });

      throw new Error((data as VaultAPIFailedResponse)?.errors.join(', '));
    }

    if (!this._online) {
      delete this._cacheData![key];
    }
  }

  public terminate(): void {
    this._state = VaultSecretState.TERMINATED;
    this._tokenExpiredOn = Date.now();

    if (this._sessionInterval) {
      clearInterval(this._sessionInterval);
    }

    this.emitter.emit(VaultEvents.TERMINATED);
  }

  get state(): VaultSecretState {
    return this._state;
  }

  get<T>(key: string): VaultGetType<Options, T> {
    if (!this._online) {
      if (this._state === VaultSecretState.INIT) {
        throw new Error('Cache data not ready');
      }

      return this.getSecretValue<T>(key) as VaultGetType<Options, T>;
    }

    if (this._token && this._tokenExpiredOn && this._tokenExpiredOn >= Date.now()) {
      return this.getSecretValue<T>(key) as VaultGetType<Options, T>;
    }

    return new Promise<T>(resolve => {
      const onTokenRetrieved = () => {
        this.emitter.removeListener(VaultEvents.READY, onTokenRetrieved);
        this.emitter.removeListener(VaultEvents.TOKEN_RENEWED, onTokenRetrieved);

        resolve(this.getSecretValue<T>(key));
      };

      this.emitter.on(VaultEvents.READY, onTokenRetrieved);
      this.emitter.on(VaultEvents.TOKEN_RENEWED, onTokenRetrieved);
    }) as VaultGetType<Options, T>;
  }

  set<T>(key: string, value: T, syncToOnline = false): VaultSetType<Options> {
    if (!syncToOnline) {
      if (this._state === VaultSecretState.INIT) {
        throw new Error('Cache data not ready');
      }

      this._cacheData![key] = value;

      return Promise.resolve() as VaultSetType<Options>;
    }

    if (this._token && this._tokenExpiredOn && this._tokenExpiredOn >= Date.now()) {
      return this.setSecretValueOnline<T>(key, value) as VaultSetType<Options>;
    }

    return new Promise<void>(resolve => {
      const onTokenRetrieved = async () => {
        this.emitter.removeListener(VaultEvents.READY, onTokenRetrieved);
        this.emitter.removeListener(VaultEvents.TOKEN_RENEWED, onTokenRetrieved);

        resolve(this.setSecretValueOnline<T>(key, value));
      };

      this.emitter.on(VaultEvents.READY, onTokenRetrieved);
      this.emitter.on(VaultEvents.TOKEN_RENEWED, onTokenRetrieved);
    }) as VaultSetType<Options>;
  }

  delete(key: string, syncToOnline = false): VaultDeleteType<Options> {
    if (!syncToOnline) {
      if (this._state === VaultSecretState.INIT) {
        throw new Error('Cache data not ready');
      }

      delete this._cacheData![key];

      return Promise.resolve() as VaultSetType<Options>;
    }

    if (this._token && this._tokenExpiredOn && this._tokenExpiredOn >= Date.now()) {
      return this.removeSecretKeyOnline(key) as VaultDeleteType<Options>;
    }

    return new Promise<void>(resolve => {
      const onTokenRetrieved = async () => {
        this.emitter.removeListener(VaultEvents.READY, onTokenRetrieved);
        this.emitter.removeListener(VaultEvents.TOKEN_RENEWED, onTokenRetrieved);

        resolve(this.removeSecretKeyOnline(key));
      };

      this.emitter.on(VaultEvents.READY, onTokenRetrieved);
      this.emitter.on(VaultEvents.TOKEN_RENEWED, onTokenRetrieved);
    }) as VaultDeleteType<Options>;
  }

  async sync(force = false): Promise<void> {
    if (this._online) {
      throw new Error('This feature only works for offline mode');
    }

    const [data, version] = await this.getSecretVersionOnline();

    if (version !== this._cacheVersion && !force) {
      throw new Error('Online version is not match cached version, please use force mode instead');
    }

    await this.fullReplaceSecretValue(this._cacheData!);

    [this._cacheData, this._cacheVersion] = await this.getSecretVersionOnline();
  }
}
