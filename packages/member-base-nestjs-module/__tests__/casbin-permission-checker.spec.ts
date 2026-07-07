import type { FactoryProvider } from '@nestjs/common';
import type { Enforcer } from 'casbin';
import { OptionProviders } from '../src/constants/option-providers';
import { CASBIN_PERMISSION_CHECKER } from '../src/typings/member-base.tokens';
import { DEFAULT_CASBIN_DOMAIN } from '../src/constants/default-casbin-domain';
import type { MemberBaseModuleOptionsDTO } from '../src/typings/member-base-module-options.dto';
import type {
  CasbinAuthorizationDecision,
  CasbinPermissionChecker,
  CasbinPermissionCheckerParams,
} from '../src/typings/casbin-permission';

const checkerProvider = OptionProviders.find(
  provider => (provider as FactoryProvider).provide === CASBIN_PERMISSION_CHECKER,
) as FactoryProvider<CasbinPermissionChecker>;

const buildChecker = (options?: MemberBaseModuleOptionsDTO): Promise<CasbinPermissionChecker> =>
  (checkerProvider.useFactory as (options?: MemberBaseModuleOptionsDTO) => Promise<CasbinPermissionChecker>)(options);

const buildEnforcer = (enforce: jest.Mock): Enforcer => ({ enforce }) as unknown as Enforcer;

describe('CASBIN_PERMISSION_CHECKER option provider', () => {
  describe('backward compatibility regression (no new options)', () => {
    it('should call enforce with (id, payload.domain, subject, action) exactly as before', async () => {
      const enforce = jest.fn().mockResolvedValue(false);
      const checker = await buildChecker(undefined);

      const result = await checker({
        enforcer: buildEnforcer(enforce),
        payload: { id: 'member-1', domain: 'tenant:a' },
        actions: [
          ['article', 'read'],
          ['article', 'write'],
        ],
      });

      expect(enforce).toHaveBeenCalledTimes(2);
      expect(enforce).toHaveBeenNthCalledWith(1, 'member-1', 'tenant:a', 'article', 'read');
      expect(enforce).toHaveBeenNthCalledWith(2, 'member-1', 'tenant:a', 'article', 'write');
      expect(result).toBe(false);
    });

    it('should fall back to DEFAULT_CASBIN_DOMAIN when payload has no domain', async () => {
      const enforce = jest.fn().mockResolvedValue(true);
      const checker = await buildChecker({});

      const result = await checker({
        enforcer: buildEnforcer(enforce),
        payload: { id: 'member-1' },
        actions: [['article', 'read']],
      });

      expect(enforce).toHaveBeenCalledWith('member-1', DEFAULT_CASBIN_DOMAIN, 'article', 'read');
      expect(result).toBe(true);
    });

    it('should keep OR semantics over actions and return a plain boolean', async () => {
      const enforce = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const checker = await buildChecker({});

      const result = await checker({
        enforcer: buildEnforcer(enforce),
        payload: { id: 'member-1' },
        actions: [
          ['article', 'read'],
          ['article', 'write'],
        ],
      });

      expect(result).toBe(true);
      expect(typeof result).toBe('boolean');
    });

    it('should return the customized checker as-is (legacy signature keeps working)', async () => {
      const legacyChecker = jest.fn(
        ({
          enforcer,
          payload,
          actions,
        }: {
          enforcer: Enforcer;
          payload: { id: string };
          actions: [string, string][];
        }): Promise<boolean> => enforcer.enforce(payload.id, 'legacy', actions[0][0], actions[0][1]),
      );

      const checker = await buildChecker({
        casbinPermissionChecker: legacyChecker as unknown as MemberBaseModuleOptionsDTO['casbinPermissionChecker'],
      });

      expect(checker).toBe(legacyChecker);

      const enforce = jest.fn().mockResolvedValue(true);

      await expect(
        checker({
          enforcer: buildEnforcer(enforce),
          payload: { id: 'member-1' },
          actions: [['article', 'read']],
        }),
      ).resolves.toBe(true);

      expect(enforce).toHaveBeenCalledWith('member-1', 'legacy', 'article', 'read');
    });

    it('should accept the legacy checker signature without type assertions', () => {
      const legacy = ({
        enforcer,
        payload,
        actions,
      }: {
        enforcer: Enforcer;
        payload: { id: string; account?: string; domain?: string };
        actions: [string, string][];
      }): Promise<boolean> => enforcer.enforce(payload.id, payload.domain ?? '', actions[0][0], actions[0][1]);

      const options: MemberBaseModuleOptionsDTO = { casbinPermissionChecker: legacy };

      expect(options.casbinPermissionChecker).toBe(legacy);
    });

    it('should not let casbinDomainResolver interfere when a customized checker exists', async () => {
      const customChecker = jest.fn().mockResolvedValue(true);
      const domainResolver = jest.fn();

      const checker = await buildChecker({
        casbinPermissionChecker: customChecker as unknown as MemberBaseModuleOptionsDTO['casbinPermissionChecker'],
        casbinDomainResolver: domainResolver,
      });

      expect(checker).toBe(customChecker);
      expect(domainResolver).not.toHaveBeenCalled();
    });
  });

  describe('casbinDomainResolver mode', () => {
    it('should pass context, request, payload and actions to the resolver', async () => {
      const domainResolver = jest.fn().mockResolvedValue(['tenant:a']);
      const checker = await buildChecker({ casbinDomainResolver: domainResolver });

      const context = { getType: (): string => 'graphql' };
      const request = { headers: {} };
      const payload = { id: 'member-1' };
      const actions: [string, string][] = [['document', 'read']];

      await checker({
        enforcer: buildEnforcer(jest.fn().mockResolvedValue(true)),
        payload,
        actions,
        context: context as unknown as CasbinPermissionCheckerParams['context'],
        request,
      });

      expect(domainResolver).toHaveBeenCalledWith({ context, request, payload, actions });
    });

    it('should accept a single domain string and report matchedDomain / matchedAction', async () => {
      const checker = await buildChecker({ casbinDomainResolver: () => 'project:42' });
      const enforce = jest.fn().mockResolvedValue(true);

      const result = (await checker({
        enforcer: buildEnforcer(enforce),
        payload: { id: 'member-1' },
        actions: [['document', 'read']],
      })) as CasbinAuthorizationDecision;

      expect(enforce).toHaveBeenCalledWith('member-1', 'project:42', 'document', 'read');
      expect(result).toEqual({
        allowed: true,
        matchedDomain: 'project:42',
        matchedAction: ['document', 'read'],
      });
    });

    it('should allow when any domain x action combination passes (OR semantics)', async () => {
      const checker = await buildChecker({
        casbinDomainResolver: () => ['project:42', 'organization:7'],
      });

      const enforce = jest.fn((_subjectId: string, domain: string) => Promise.resolve(domain === 'organization:7'));

      const result = (await checker({
        enforcer: buildEnforcer(enforce as unknown as jest.Mock),
        payload: { id: 'member-1' },
        actions: [
          ['document', 'read'],
          ['document', 'write'],
        ],
      })) as CasbinAuthorizationDecision;

      expect(result.allowed).toBe(true);
      expect(result.matchedDomain).toBe('organization:7');
      expect(result.matchedAction).toEqual(['document', 'read']);
    });

    it('should deny when no domain x action combination passes', async () => {
      const checker = await buildChecker({
        casbinDomainResolver: () => ['project:42', 'organization:7'],
      });

      const result = (await checker({
        enforcer: buildEnforcer(jest.fn().mockResolvedValue(false)),
        payload: { id: 'member-1' },
        actions: [['document', 'read']],
      })) as CasbinAuthorizationDecision;

      expect(result).toEqual({ allowed: false });
    });

    it('should deny immediately when the resolver returns an empty array', async () => {
      const enforce = jest.fn();
      const checker = await buildChecker({ casbinDomainResolver: () => [] });

      const result = (await checker({
        enforcer: buildEnforcer(enforce),
        payload: { id: 'member-1' },
        actions: [['document', 'read']],
      })) as CasbinAuthorizationDecision;

      expect(result).toEqual({ allowed: false });
      expect(enforce).not.toHaveBeenCalled();
    });

    it('should ignore payload.domain when the resolver is provided', async () => {
      const checker = await buildChecker({ casbinDomainResolver: () => ['project:42'] });
      const enforce = jest.fn().mockResolvedValue(true);

      await checker({
        enforcer: buildEnforcer(enforce),
        payload: { id: 'member-1', domain: 'tenant:should-not-be-used' },
        actions: [['document', 'read']],
      });

      expect(enforce).toHaveBeenCalledWith('member-1', 'project:42', 'document', 'read');
    });
  });
});
