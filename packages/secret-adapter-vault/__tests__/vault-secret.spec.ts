import axios from 'axios';
import { VaultSecret, VaultSecretState } from '@rytass/secret-adapter-vault';

const VAULT_HOST = 'https://vault.yourserver.com';
const VAULT_ACCOUNT = 'utils';
const VAULT_PASSWORD = 'utils';
const VAULT_PROJECT = 'rytass/utils';
const VAULT_EMPTY_PROJECT = 'rytass/utils_empty';

const secretDataMap = {
  [VAULT_PROJECT]: {
    test: 'abc',
    test2: '123',
    COULD_NOT_BE_REMOVED: 'aaa',
  },
  [VAULT_EMPTY_PROJECT]: undefined,
} as Record<string, Record<string, unknown> | undefined>;

const secretVersionMap = {
  [VAULT_PROJECT]: 3,
  [VAULT_EMPTY_PROJECT]: 0,
} as Record<string, number>;

const TOKEN = 'hvs.CAESIHKbC7ihFPU3_rCfEaKXxI0NA_lZqdn4BcMLRh_8Y_aXGhgawheoi_u99_20aJtdkahjrSOGhgbC2xVRlM5Um8';

const LOGIN_RESPONSE_SAMPLE = {
  request_id: 'fbc5688f-932f-4484-3ab5-9967d10dc3eb',
  lease_id: '',
  renewable: false,
  lease_duration: 0,
  data: null,
  wrap_info: null,
  warnings: null,
  auth: {
    client_token: TOKEN,
    accessor: 'C7ShyDLIQ8KBx5fqQGwRAlKrf',
    policies: ['default', 'utils-unit-test'],
    token_policies: ['default', 'utils-unit-test'],
    identity_policies: ['utils-unit-test'],
    metadata: {
      username: 'utils',
    },
    lease_duration: 2764800,
    renewable: true,
    entity_id: 'a1f180f4-6fbe-91c4-bcdc-a1d40541d6e6',
    token_type: 'service',
    orphan: true,
    mfa_requirement: null,
    num_uses: 0,
  },
};

const UPDATE_RESPONSE_SAMPLE = {
  request_id: '9b3688e7-a784-5e1a-2871-85fbd19134a3',
  lease_id: '',
  renewable: false,
  lease_duration: 0,
  data: {
    created_time: '2022-04-28T13:14:20.398160664Z',
    custom_metadata: null,
    deletion_time: '',
    destroyed: false,
  },
  wrap_info: null,
  warnings: null,
  auth: null,
};

const GET_RESPONSE_SAMPLE = {
  request_id: '8d614706-238d-17b4-bb81-c50d8afefd47',
  lease_id: '',
  renewable: false,
  lease_duration: 0,
  data: {
    metadata: {
      created_time: '2022-04-28T15:16:48.393073426Z',
      custom_metadata: null,
      deletion_time: '',
      destroyed: false,
    },
  },
  wrap_info: null,
  warnings: null,
  auth: null,
};

class AxiosError extends Error {
  constructor(status: number) {
    super();

    this.response.status = status;
  }

  isAxiosError = true;

  response: {
    status: number;
  } = {
    status: 200,
  };
}

describe('VaultSecret', () => {
  const get = jest.spyOn(axios, 'get');
  const post = jest.spyOn(axios, 'post');

  const URLRegex = new RegExp(`${VAULT_HOST}/v1/secret/data/(.+)$`);

  get.mockImplementation(async (url: string, _data: unknown) => {
    URLRegex.test(url);

    const project = RegExp.$1;

    if (!~[VAULT_PROJECT, VAULT_EMPTY_PROJECT].indexOf(project)) {
      throw new AxiosError(403);
    }

    if (!secretDataMap[project]) {
      throw new AxiosError(404);
    }

    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          data: {
            ...GET_RESPONSE_SAMPLE,
            data: {
              ...GET_RESPONSE_SAMPLE.data,
              data: {
                ...secretDataMap[project],
              },
              metadata: {
                ...GET_RESPONSE_SAMPLE.data.metadata,
                version: secretVersionMap[project] ?? 0,
              },
            },
          },
        });
      }, 10);
    });
  });

  post.mockImplementation(async (url: string, data: unknown, _config) => {
    if (!url.match(new RegExp(`^${VAULT_HOST}`))) throw new AxiosError(404);

    if (url === `${VAULT_HOST}/v1/auth/userpass/login/${VAULT_ACCOUNT}`) {
      const payload = JSON.parse(data as string) as {
        password: string;
      };

      if (payload.password !== VAULT_PASSWORD) {
        return {
          data: {
            errors: ['invalid username or password'],
          },
        };
      }

      return { data: LOGIN_RESPONSE_SAMPLE };
    }

    if (url === `${VAULT_HOST}/v1/auth/token/renew-self`) {
      return { data: LOGIN_RESPONSE_SAMPLE };
    }

    const payload = JSON.parse(data as string) as {
      data: Record<string, unknown>;
      options?: {
        cas: number;
      };
    };

    if (payload.data.WILL_FAILED_UPDATE_KEY) {
      return { data: { errors: ['FAILED'] } };
    }

    if (!payload.data.COULD_NOT_BE_REMOVED) {
      return { data: { errors: ['FAILED'] } };
    }

    URLRegex.test(url);

    const project = RegExp.$1;

    secretDataMap[project] = payload.data;
    secretVersionMap[project] += 1;

    return { data: UPDATE_RESPONSE_SAMPLE };
  });

  describe('VaultSecret (offline cached)', () => {
    it('should throw error when get value on offline mode before ready', () => {
      const manager = new VaultSecret(VAULT_PROJECT, {
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
      });

      expect(() => manager.get<string>('test')).toThrow();
    });

    it('should get value on offline mode', done => {
      const manager = new VaultSecret(VAULT_PROJECT, {
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        onReady: (): void => {
          const data = manager.get<string>('test');

          expect(data).toBe('abc');

          done();
        },
      });
    });

    it('should set value on offline mode', done => {
      const manager = new VaultSecret(VAULT_PROJECT, {
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        onReady: (): void => {
          manager.set<string>('test_offline', 'set');

          const data = manager.get<string>('test_offline');

          expect(data).toBe('set');

          done();
        },
      });
    });

    it('should throw error when set value on offline mode before ready', () => {
      const manager = new VaultSecret(VAULT_PROJECT, {
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
      });

      expect(() => manager.set<string>('test123', 'aabb')).toThrow();
    });

    it('should delete value on offline mode', done => {
      const manager = new VaultSecret(VAULT_PROJECT, {
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        onReady: (): void => {
          manager.delete('test_offline');

          const data = manager.get<string>('test_offline');

          expect(data).toBeUndefined();

          done();
        },
      });
    });

    it('should throw error when delete value on offline mode before ready', () => {
      const manager = new VaultSecret(VAULT_PROJECT, {
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
      });

      expect(() => manager.delete('test123')).toThrow();
    });

    it('should throw error when call sync on online mode', done => {
      const manager = new VaultSecret(VAULT_PROJECT, {
        host: VAULT_HOST,
        online: true,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        onReady: (): void => {
          expect(manager.sync()).rejects.toThrow();

          manager.terminate();

          done();
        },
      });
    });

    it('should sync data online', done => {
      const manager = new VaultSecret(VAULT_PROJECT, {
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        onReady: async (): Promise<void> => {
          const nowVersion = secretVersionMap[VAULT_PROJECT];

          await manager.sync();

          expect(secretVersionMap[VAULT_PROJECT]).toBe(nowVersion + 1);

          done();
        },
      });
    });

    it('should throw on cache version not match', done => {
      const manager = new VaultSecret(VAULT_PROJECT, {
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        onReady: async (): Promise<void> => {
          secretVersionMap[VAULT_PROJECT] += 1;

          expect(manager.sync()).rejects.toThrow();

          done();
        },
      });
    });

    it('should sync secret on force mode if verison not match', done => {
      const manager = new VaultSecret(VAULT_PROJECT, {
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        onReady: async (): Promise<void> => {
          secretVersionMap[VAULT_PROJECT] += 1;

          const nowVersion = secretVersionMap[VAULT_PROJECT];

          await manager.sync(true);

          expect(secretVersionMap[VAULT_PROJECT]).toBe(nowVersion + 1);

          done();
        },
      });
    });

    it('should throw error when sync failed', done => {
      const onError = jest.fn();

      const manager = new VaultSecret(VAULT_PROJECT, {
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        onError,
        onReady: (): void => {
          manager.set('WILL_FAILED_UPDATE_KEY', 'FAILED');

          expect(manager.sync())
            .rejects.toThrow()
            .then(() => {
              expect(onError).toHaveBeenCalled();

              done();
            });
        },
      });
    });
  });

  describe('Project error', () => {
    it('should return undefined when get empty secret on undefined project', done => {
      const manager = new VaultSecret(VAULT_EMPTY_PROJECT, {
        online: true,
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
      });

      manager.get('KEY').then(value => {
        expect(value).toBe(undefined);

        manager.terminate();

        done();
      });
    });

    it('should create a key when project is undefined', done => {
      const manager = new VaultSecret(VAULT_EMPTY_PROJECT, {
        online: true,
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
      });

      manager.set('COULD_NOT_BE_REMOVED', 'value', true).then(async () => {
        const value = await manager.get('COULD_NOT_BE_REMOVED');

        expect(value).toBe('value');

        manager.terminate();

        done();
      });
    });

    it('should throw on call unauthorized project', done => {
      const onError = jest.fn();

      const manager = new VaultSecret('GOD_PROJECT', {
        online: true,
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        onError,
      });

      expect(manager.get('KEY_FROM_UNAUTHORIZED'))
        .rejects.toThrow()
        .then(() => {
          expect(onError).toHaveBeenCalled();

          manager.terminate();

          done();
        });
    });
  });

  describe('Value getter/setter (Online)', () => {
    describe('Getter/Setter success case', () => {
      const manager = new VaultSecret(VAULT_PROJECT, {
        online: true,
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
      });

      it('should set value on test and get correct response', done => {
        manager.set<string>('test', '123', true).then(async () => {
          const result = await manager.get<string>('test');

          expect(result).toBe('123');

          done();
        });
      });

      it('should return undefined on key not found', done => {
        manager.set<string>('willRemove', '123', true).then(async () => {
          await manager.delete('willRemove', true);

          const result = await manager.get<undefined>('willRemove');

          expect(result).toBe(undefined);

          done();
        });
      });

      afterAll(() => {
        manager.terminate();
      });
    });

    describe('Getter/Setter failed case', () => {
      it('should throw when get value failed', done => {
        const get = jest.spyOn(axios, 'get');

        get.mockImplementationOnce(async (_url: string, _data: unknown) => {
          return {
            data: {
              errors: ['TEST1', 'test2'],
            },
          };
        });

        const onError = jest.fn();

        const errorManager = new VaultSecret(VAULT_PROJECT, {
          online: true,
          host: VAULT_HOST,
          auth: {
            account: VAULT_ACCOUNT,
            password: VAULT_PASSWORD,
          },
          onError,
        });

        expect(errorManager.get('what_a_secret'))
          .rejects.toThrow()
          .then(() => {
            expect(onError).toHaveBeenCalled();

            errorManager.terminate();

            done();
          });
      });

      it('should throw when delete undefined value', done => {
        const errorManager = new VaultSecret(VAULT_PROJECT, {
          online: true,
          host: VAULT_HOST,
          auth: {
            account: VAULT_ACCOUNT,
            password: VAULT_PASSWORD,
          },
        });

        expect(errorManager.delete('Not_Set_Key', true))
          .rejects.toThrow()
          .then(() => {
            errorManager.terminate();

            done();
          });
      });

      it('should throw when remove value failed', done => {
        const onError = jest.fn();

        const errorManager = new VaultSecret(VAULT_PROJECT, {
          online: true,
          host: VAULT_HOST,
          auth: {
            account: VAULT_ACCOUNT,
            password: VAULT_PASSWORD,
          },
          onError,
        });

        expect(errorManager.delete('COULD_NOT_BE_REMOVED', true))
          .rejects.toThrow()
          .then(() => {
            expect(onError).toHaveBeenCalled();

            errorManager.terminate();

            done();
          });
      });

      it('should throw when set value failed', done => {
        const onError = jest.fn();

        const errorManager = new VaultSecret(VAULT_PROJECT, {
          online: true,
          host: VAULT_HOST,
          auth: {
            account: VAULT_ACCOUNT,
            password: VAULT_PASSWORD,
          },
          onError,
        });

        expect(errorManager.set('WILL_FAILED_UPDATE_KEY', 'aaaa', true))
          .rejects.toThrow()
          .then(() => {
            expect(onError).toHaveBeenCalled();

            errorManager.terminate();

            done();
          });
      });
    });
  });

  describe('Vault login state management', () => {
    it('should throw error on renew token', done => {
      const post = jest.spyOn(axios, 'post');

      post.mockImplementation(async (url: string, _data: unknown) => {
        if (url.match(/renew-self$/)) {
          return {
            data: {
              errors: ['TEST1', 'test2'],
            },
          };
        }

        return { data: LOGIN_RESPONSE_SAMPLE };
      });

      const onError = jest.fn();

      const manager = new VaultSecret(VAULT_PROJECT, {
        online: true,
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        tokenTTL: 10,
        onError,
      });

      setTimeout(() => {
        expect(onError).toHaveBeenCalled();
        expect(manager.state).toBe(VaultSecretState.TERMINATED);

        post.mockClear();

        done();
      }, 200);
    });

    it('should throw error message on login failed', done => {
      const post = jest.spyOn(axios, 'post');

      let errorPass = false;

      post.mockImplementationOnce(async (_url: string, _data: unknown) => {
        return {
          data: {
            errors: ['TEST1', 'test2'],
          },
        };
      });

      new VaultSecret(VAULT_PROJECT, {
        online: true,
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        onError: (error: string): void => {
          if (errorPass) {
            expect(error).toBe('test2');

            done();
          } else {
            expect(error).toBe('TEST1');

            errorPass = true;
          }
        },
      });
    });

    it('should call renewToken throw when token expires', done => {
      const post = jest.spyOn(axios, 'post');

      post.mockImplementation(async (_url: string, _data: unknown) => {
        return {
          data: {
            ...LOGIN_RESPONSE_SAMPLE,
            auth: {
              ...LOGIN_RESPONSE_SAMPLE.auth,
              lease_duration: 0,
            },
          },
        };
      });

      const manager = new VaultSecret(VAULT_PROJECT, {
        online: true,
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        tokenTTL: 100,
      });

      setTimeout(() => {
        expect(post.mock.calls.length).toBeGreaterThanOrEqual(2);

        manager.terminate();

        post.mockClear();

        done();
      }, 150);
    });

    it('should call checkRenew every ttl', done => {
      const post = jest.spyOn(axios, 'post');

      post.mockImplementation(async (_url: string, _data: unknown) => {
        return {
          data: LOGIN_RESPONSE_SAMPLE,
        };
      });

      const manager = new VaultSecret(VAULT_PROJECT, {
        online: true,
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        tokenTTL: 100,
      });

      setTimeout(() => {
        expect(post.mock.calls.length).toBe(2);

        manager.terminate();

        post.mockClear();

        done();
      }, 200);
    });

    it('should init state got', done => {
      let initPass = false;

      const post = jest.spyOn(axios, 'post');

      post.mockImplementationOnce(async (_url: string, _data: unknown) => {
        return new Promise(resolve => {
          const interval = setInterval(() => {
            if (!initPass) return;

            clearInterval(interval);

            resolve({
              data: LOGIN_RESPONSE_SAMPLE,
            });
          }, 200);
        });
      });

      const manager = new VaultSecret(VAULT_PROJECT, {
        online: true,
        host: VAULT_HOST,
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
      });

      expect(manager.state).toBe(VaultSecretState.INIT);

      initPass = true;

      setTimeout(() => {
        expect(manager.state).toBe(VaultSecretState.READY);

        manager.terminate();

        done();
      }, 500);
    });
  });

  describe('Vault network invalid', () => {
    it('should emit error message on network failed', done => {
      new VaultSecret(VAULT_PROJECT, {
        host: 'https://not-valid.rytass.com',
        auth: {
          account: VAULT_ACCOUNT,
          password: VAULT_PASSWORD,
        },
        onError: (): void => {
          expect(true).toBeTruthy();

          done();
        },
      });
    });
  });
});
