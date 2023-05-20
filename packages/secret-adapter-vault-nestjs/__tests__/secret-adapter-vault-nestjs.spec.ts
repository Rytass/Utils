import { ConfigModule, ConfigModuleOptions, ConfigService } from '@nestjs/config';
import axios from 'axios';
import { VaultModule } from '../src/module';
import { VaultService } from '../src/service';

const VAULT_HOST = 'https://vault.yourserver.com';
const VAULT_ACCOUNT = 'utils';
const VAULT_PASSWORD = 'utils';
const VAULT_PROJECT = 'rytass/utils';
const VAULT_EMPTY_PROJECT = 'rytass/utils_empty';

let secretDataMap = {
  [VAULT_PROJECT]: {
    test: 'abc',
    test2: '123',
    COULD_NOT_BE_REMOVED: 'aaa',
  },
  [VAULT_EMPTY_PROJECT]: undefined,
} as Record<string, Record<string, any> | undefined>;

let secretVersionMap = {
  [VAULT_PROJECT]: 3,
  [VAULT_EMPTY_PROJECT]: 0,
} as Record<string, number>;

class AxiosError extends Error {
  constructor(status: number) {
    super();

    this.response.status = status;
  }

  isAxiosError = true

  response: {
    status: number;
  } = {
    status: 200,
  }
}

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
    policies: [
      'default',
      'utils-unit-test',
    ],
    token_policies: [
      'default',
      'utils-unit-test',
    ],
    identity_policies: [
      'utils-unit-test',
    ],
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

describe('VaultSecretNestjsModule', () => {
  const get = jest.spyOn(axios, 'get');
  const post = jest.spyOn(axios, 'post');
  const URLRegex = new RegExp(`${VAULT_HOST}/v1/secret/data/(.+)$`);

  get.mockImplementation(async (url: string, data: unknown) => {
    URLRegex.test(url);

    const project = RegExp.$1;

    if (!~[VAULT_PROJECT, VAULT_EMPTY_PROJECT].indexOf(project)) {
      throw new AxiosError(403);
    }

    if (!secretDataMap[project]) {
      throw new AxiosError(404);
    }

    return new Promise((resolve) => {
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

  post.mockImplementation(async (url: string, data: unknown, config) => {
    console.log({ url, data });

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
      data: Record<string, any>,
      options?: {
        cas: number;
      },
    }

    if (payload.data.WILL_FAILED_UPDATE_KEY) {
      return { data: { errors: ['FAILED'] }};
    }

    if (!payload.data.COULD_NOT_BE_REMOVED) {
      return { data: { errors: ['FAILED'] } };
    }

    URLRegex.test(url);

    const project = RegExp.$1;

    secretDataMap[project] = payload.data;
    secretVersionMap[project] += 1;

    return { data: null };
  });

  const mockConfig = new Map<string, string>();

  mockConfig.set('VAULT_HOST', VAULT_HOST);
  mockConfig.set('VAULT_ACCOUNT', VAULT_ACCOUNT);
  mockConfig.set('VAULT_PASSWORD', VAULT_PASSWORD);
  mockConfig.set('VAULT_PATH', VAULT_PROJECT);

  it('shoult test', async () => {
    const service = new VaultService(mockConfig as unknown as ConfigService, VAULT_PROJECT);

    const testValue = await service.get('test'); // Before ready
    const test2Value = await service.get('test2'); // After ready

    expect(testValue).toBe('abc');
    expect(test2Value).toBe('123');
  });

  it('should vault forRoot use default value', async () => {
    const module = VaultModule.forRoot() as {
      providers: {
        useValue: string;
      }[];
    };

    expect(module.providers[1].useValue).toBe('/');
  });

  it('should get path on vault forRoot method', () => {
    const module = VaultModule.forRoot({ path: '/aaa' }) as {
      providers: {
        useValue: string;
      }[];
    };

    expect(module.providers[1].useValue).toBe('/aaa');
  });

  it('should use fallback env file', (done) => {
    jest.spyOn(ConfigModule, 'forRoot').mockImplementationOnce((options?: ConfigModuleOptions) => {
      expect(options?.envFilePath).toBe('cache.env');

      done();

      return ConfigModule.forRoot(options);
    });

    VaultModule.forRoot({ path: '/', fallbackFile: 'cache.env' });
  });

  it('should fallback when network failure', async () => {
    const configMap = new Map<string, string>(mockConfig);

    configMap.set('VAULT_HOST', 'http://localhost:1234');
    configMap.set('AAA', '123');
    configMap.set('BBB', '456');

    const service = new VaultService(configMap as unknown as ConfigService, '/');

    // waiting for ready
    expect(await service.get('AAA')).toBe('123');

    // realtime
    expect(await service.get('BBB')).toBe('456');
    expect(await service.get('CCC')).toBe('');
  });
});
