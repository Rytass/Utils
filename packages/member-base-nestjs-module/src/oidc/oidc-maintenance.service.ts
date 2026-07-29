import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Repository } from 'typeorm';
import { OidcPayloadEntity, OidcPayloadRepo } from './models/oidc-payload.entity';
import { purgeExpiredOidcPayloads } from './oidc-adapter';
import { MEMBER_BASE_OIDC_OPTIONS } from './oidc.tokens';
import type { MemberBaseOidcProviderOptions } from './oidc-provider.options';

const DEFAULT_PURGE_INTERVAL_SECONDS = 3600;

/**
 * Sweeps expired artefacts out of oidc_payloads.
 *
 * oidc-provider never deletes anything: expiry is advisory and enforced on
 * read. Every authorization, token refresh and session therefore leaves a row
 * behind forever unless something removes it, and on a busy issuer that table
 * is the fastest growing one in the schema.
 */
@Injectable()
export class OidcMaintenanceService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OidcMaintenanceService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(OidcPayloadRepo)
    private readonly payloadRepo: Repository<OidcPayloadEntity>,
    @Inject(MEMBER_BASE_OIDC_OPTIONS)
    private readonly options: MemberBaseOidcProviderOptions,
  ) {}

  onApplicationBootstrap(): void {
    const intervalSeconds = this.options.purgeIntervalSeconds ?? DEFAULT_PURGE_INTERVAL_SECONDS;

    if (intervalSeconds <= 0) {
      this.logger.log('Expired payload sweep is disabled; drive purgeExpired() from your own scheduler.');

      return;
    }

    this.timer = setInterval(() => {
      void this.purgeExpired();
    }, intervalSeconds * 1000);

    // Nothing here should keep a process alive that is otherwise ready to exit.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);

    this.timer = null;
  }

  async purgeExpired(before: Date = new Date()): Promise<number> {
    try {
      const removed = await purgeExpiredOidcPayloads(this.payloadRepo, before);

      if (removed > 0) {
        this.logger.log(`Purged ${removed} expired oidc payload(s)`);
      }

      return removed;
    } catch (error) {
      // A failed sweep must never take the application down with it.
      this.logger.error(`Failed to purge expired oidc payloads: ${(error as Error).message}`);

      return 0;
    }
  }
}
