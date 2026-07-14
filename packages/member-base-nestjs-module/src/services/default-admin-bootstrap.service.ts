import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Enforcer } from 'casbin';
import { BaseMemberEntity } from '../models/base-member.entity';
import { MemberBaseService } from './member-base.service';
import { PasswordValidatorService } from './password-validator.service';
import {
  CASBIN_ENFORCER,
  DEFAULT_ADMIN_ACCOUNT,
  DEFAULT_ADMIN_PASSWORD,
  RESOLVED_MEMBER_REPO,
} from '../typings/member-base.tokens';
import { DEFAULT_CASBIN_DOMAIN } from '../constants/default-casbin-domain';
import { SUPER_ADMIN_ROLE } from '../constants/super-admin-role';
import { MemberAlreadyExistedError } from '../constants/errors/base.error';

const GENERATE_PASSWORD_MAX_ATTEMPTS = 20;

// Seeds a default administrator on application startup when `defaultAdminAccount`
// is configured. Idempotent: if the account already exists it does nothing. When
// no `defaultAdminPassword` is supplied, a policy-compliant password is generated
// and logged exactly once (at creation time).
@Injectable()
export class DefaultAdminBootstrapService implements OnApplicationBootstrap {
  constructor(
    @Inject(DEFAULT_ADMIN_ACCOUNT)
    private readonly defaultAdminAccount: string | null,
    @Inject(DEFAULT_ADMIN_PASSWORD)
    private readonly defaultAdminPassword: string | null,
    @Inject(RESOLVED_MEMBER_REPO)
    private readonly baseMemberRepo: Repository<BaseMemberEntity>,
    @Inject(CASBIN_ENFORCER)
    private readonly enforcer: Enforcer | null,
    @Inject(MemberBaseService)
    private readonly memberBaseService: MemberBaseService,
    @Inject(PasswordValidatorService)
    private readonly passwordValidatorService: PasswordValidatorService,
  ) {}

  private readonly logger = new Logger(DefaultAdminBootstrapService.name);

  async onApplicationBootstrap(): Promise<void> {
    const account = this.defaultAdminAccount;

    if (!account) return;

    const existing = await this.baseMemberRepo.findOne({ where: { account } });

    if (existing) {
      this.logger.log(`Default admin account "${account}" already exists, skipping creation.`);

      return;
    }

    const generated = !this.defaultAdminPassword;
    const password = this.defaultAdminPassword ?? (await this.generateCompliantPassword());

    let member: BaseMemberEntity;

    try {
      // register() re-validates the password and throws PasswordDoesNotMeetPolicyError
      // for a non-compliant supplied password, aborting startup by design.
      member = await this.memberBaseService.register(account, password);
    } catch (ex) {
      if (ex instanceof MemberAlreadyExistedError) {
        this.logger.log(`Default admin account "${account}" already exists, skipping creation.`);

        return;
      }

      throw ex;
    }

    if (!member?.id) {
      this.logger.error(`Failed to create default admin account "${account}".`);

      return;
    }

    if (generated) {
      this.logger.warn(`Generated default admin password for "${account}": ${password}`);
    }

    if (this.enforcer) {
      await this.enforcer.addGroupingPolicy(member.id, SUPER_ADMIN_ROLE, DEFAULT_CASBIN_DOMAIN);

      this.logger.log(`Default admin account "${account}" created with super-admin permissions.`);
    } else {
      this.logger.warn(
        `Default admin account "${account}" created, but Casbin is not configured (no casbinAdapterOptions); super-admin permissions were NOT granted.`,
      );
    }
  }

  private async generateCompliantPassword(): Promise<string> {
    for (let attempt = 0; attempt < GENERATE_PASSWORD_MAX_ATTEMPTS; attempt += 1) {
      const candidate = this.passwordValidatorService.generateValidPassword();

      if (await this.passwordValidatorService.validatePassword(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      'Unable to generate a policy-compliant default admin password; please set defaultAdminPassword explicitly.',
    );
  }
}
