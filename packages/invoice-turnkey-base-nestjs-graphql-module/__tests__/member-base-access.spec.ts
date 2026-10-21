import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { AllowActions } from '@rytass/member-base-nestjs-module';
import { memberBaseAccess, TURNKEY_MEMBER_BASE_ACTIONS } from '../src/member-base';
import { TurnkeyBaseGraphQLModule } from '../src/turnkey-base-graphql.module';
import { TurnkeyApiAction } from '../src/turnkey-graphql.options';
import { createTurnkeyMutationResolver } from '../src/mutations/turnkey.mutations';
import { createTurnkeyQueryResolver } from '../src/queries/turnkey.queries';

type Resolver = new (...args: never[]) => unknown;

/** 每個 GraphQL 端點對應的 Casbin action；private helper（replyReceived）不在表內 */
const QUERY_ACTIONS: Readonly<Record<string, string>> = {
  turnkeyInvoice: 'read',
  turnkeyAllowance: 'read',
  turnkeySubmissions: 'read',
  turnkeyEvents: 'read',
  turnkeyAllowancesByInvoice: 'read',
  turnkeyReceivedInvoices: 'read',
  turnkeyReceivedAllowances: 'read',
};

const MUTATION_ACTIONS: Readonly<Record<string, string>> = {
  issueTurnkeyInvoice: 'issue',
  printTurnkeyInvoiceProof: 'print',
  printTurnkeyAllowanceProof: 'print',
  voidTurnkeyInvoice: 'void',
  annulTurnkeyInvoice: 'annul',
  acknowledgeTurnkeyInvoiceRejection: 'exchange',
  issueTurnkeyAllowance: 'allowance',
  voidTurnkeyAllowance: 'allowance',
  registerTurnkeyInvoiceTrack: 'track',
  reportTurnkeyBlankNumbers: 'track',
  abandonTurnkeyInvoiceNumber: 'track',
  retryTurnkeySubmission: 'retry',
  confirmTurnkeyReceivedInvoice: 'exchange',
  rejectTurnkeyReceivedInvoice: 'exchange',
  confirmTurnkeyReceivedInvoiceVoid: 'exchange',
  confirmTurnkeyReceivedAllowance: 'exchange',
  confirmTurnkeyReceivedAllowanceVoid: 'exchange',
};

const publicMethods = (resolver: Resolver): string[] =>
  Object.getOwnPropertyNames(resolver.prototype).filter(name => name !== 'constructor' && name !== 'replyReceived');

const actionsOf = (resolver: Resolver, name: string): ReadonlyArray<readonly [string, string]> | undefined =>
  new Reflector().get(AllowActions, (resolver.prototype as Record<string, unknown>)[name] as () => void);

describe('memberBaseAccess', () => {
  it('maps every GraphQL-visible API action to a Casbin action', () => {
    expect(Object.keys(TURNKEY_MEMBER_BASE_ACTIONS).sort()).toEqual(Object.values(TurnkeyApiAction).sort());
  });

  it('decorates every query with AllowActions([[resource, action]])', () => {
    const resolver = createTurnkeyQueryResolver(
      memberBaseAccess({ resource: 'einvoice', actions: { [TurnkeyApiAction.READ_INVOICE]: 'read-special' } }),
    ) as Resolver;

    expect(publicMethods(resolver).sort()).toEqual(Object.keys(QUERY_ACTIONS).sort());

    Object.entries(QUERY_ACTIONS).forEach(([name, action]) => {
      const expected = name === 'turnkeyInvoice' ? 'read-special' : action;

      expect(actionsOf(resolver, name)).toEqual([['einvoice', expected]]);
    });
  });

  it('decorates every mutation with AllowActions([[resource, action]]), annul separate from void', () => {
    const resolver = createTurnkeyMutationResolver(
      memberBaseAccess({ resource: 'einvoice', actions: { [TurnkeyApiAction.ANNUL_INVOICE]: 'annul-special' } }),
    ) as Resolver;

    expect(publicMethods(resolver).sort()).toEqual(Object.keys(MUTATION_ACTIONS).sort());

    Object.entries(MUTATION_ACTIONS).forEach(([name, action]) => {
      const expected = name === 'annulTurnkeyInvoice' ? 'annul-special' : action;

      expect(actionsOf(resolver, name)).toEqual([['einvoice', expected]]);
    });

    expect(actionsOf(resolver, 'annulTurnkeyInvoice')?.[0][1]).not.toBe(
      actionsOf(resolver, 'voidTurnkeyInvoice')?.[0][1],
    );
  });

  it('denies every company unless told otherwise', () => {
    expect(memberBaseAccess().canAccessCompany).toBeUndefined();
    expect(memberBaseAccess().allowAllCompanies).toBeUndefined();
  });
});

describe('TurnkeyBaseGraphQLModule.forRootAsync', () => {
  it('keeps access at the top level so resolver decorators apply at definition time', () => {
    const module = TurnkeyBaseGraphQLModule.forRootAsync({
      access: memberBaseAccess({ allowAllCompanies: true }),
      useFactory: () => ({
        dataPath: '/data',
        turnkeyDataSource: 'turnkey',
        environment: 'TEST',
        secretEncryptionKey: 'k',
      }),
    });

    const resolvers = (module.providers ?? []) as Resolver[];
    const mutation = resolvers.find(provider => publicMethods(provider).includes('issueTurnkeyInvoice'));

    expect(module.imports).toHaveLength(1);
    expect(mutation).toBeDefined();
    expect(actionsOf(mutation as Resolver, 'issueTurnkeyInvoice')).toEqual([['turnkey', 'issue']]);
  });
});
