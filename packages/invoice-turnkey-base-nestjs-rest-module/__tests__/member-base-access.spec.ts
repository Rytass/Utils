import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { AllowActions } from '@rytass/member-base-nestjs-module';
import { memberBaseAccess, TURNKEY_MEMBER_BASE_ACTIONS } from '../src/member-base';
import { TurnkeyBaseRestModule } from '../src/turnkey-base-rest.module';
import { createTurnkeyController } from '../src/turnkey.controller';
import { TurnkeyApiAction } from '../src/turnkey-rest.options';

const handlers = (controller: new (...args: never[]) => unknown): readonly ((...args: never[]) => unknown)[] =>
  Object.getOwnPropertyNames(controller.prototype)
    .filter(name => name !== 'constructor')
    .map(name => (controller.prototype as Record<string, (...args: never[]) => unknown>)[name])
    .filter(handler => typeof handler === 'function' && Reflect.getMetadata('path', handler) !== undefined);

describe('memberBaseAccess', () => {
  it('maps every API action to a Casbin action', () => {
    expect(Object.keys(TURNKEY_MEMBER_BASE_ACTIONS).sort()).toEqual(Object.values(TurnkeyApiAction).sort());
  });

  it('decorates every route handler with AllowActions([[resource, action]])', () => {
    const controller = createTurnkeyController(
      'einvoice',
      memberBaseAccess({ resource: 'einvoice', actions: { [TurnkeyApiAction.ANNUL_INVOICE]: 'annul-special' } }),
    ) as new (...args: never[]) => unknown;

    const reflector = new Reflector();
    const routes = handlers(controller);
    const allowed = routes.map(handler => reflector.get(AllowActions, handler));

    expect(routes.length).toBeGreaterThan(20);
    expect(
      allowed.every(actions => Array.isArray(actions) && actions.length === 1 && actions[0][0] === 'einvoice'),
    ).toBe(true);

    const byName = Object.fromEntries(routes.map((handler, index) => [handler.name, allowed[index]?.[0][1]]));

    expect(byName.issueInvoice).toBe('issue');
    expect(byName.voidInvoice).toBe('void');
    expect(byName.annulInvoice).toBe('annul-special');
    expect(byName.findInvoice).toBe('read');
    expect(byName.invoiceProof).toBe('print');
  });

  it('denies every company unless told otherwise', () => {
    expect(memberBaseAccess().canAccessCompany).toBeUndefined();
    expect(memberBaseAccess().allowAllCompanies).toBeUndefined();
  });
});

describe('TurnkeyBaseRestModule.forRootAsync', () => {
  it('keeps routePrefix and access at the top level', () => {
    const module = TurnkeyBaseRestModule.forRootAsync({
      routePrefix: 'einvoice',
      access: memberBaseAccess({ allowAllCompanies: true }),
      useFactory: () => ({
        dataPath: '/data',
        turnkeyDataSource: 'turnkey',
        environment: 'TEST',
        secretEncryptionKey: 'k',
      }),
    });

    const [controller] = module.controllers ?? [];

    expect(Reflect.getMetadata('path', controller)).toBe('einvoice/companies/:companyTaxId');
    expect(module.imports).toHaveLength(1);
  });
});
