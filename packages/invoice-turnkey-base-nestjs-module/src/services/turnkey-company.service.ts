import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BaseTurnkeyCompanyEntity, BaseTurnkeyCompanyRepo } from '../models/turnkey-company.entity';
import type { TurnkeyBaseModuleOptions } from '../typings/turnkey-base-module-options';
import { TURNKEY_BASE_MODULE_OPTIONS } from '../typings/turnkey-base-providers';
import { openSecret, sealSecret } from '../utils/secret-box';
import { isTaxIdValid } from '../utils/tax-id';
import { TurnkeyValidationCode, TurnkeyValidationError } from '../validation/turnkey-validation-error';

export interface TurnkeyCompanyRegisterInput {
  readonly taxId: string;
  readonly name: string;
  readonly address?: string;
  readonly routingId: string;
  readonly exchangeEnabled?: boolean;
  readonly certificateExpiresAt?: Date;
}

@Injectable()
export class TurnkeyCompanyService {
  constructor(
    @Inject(BaseTurnkeyCompanyRepo)
    private readonly companyRepo: Repository<BaseTurnkeyCompanyEntity>,
    @Inject(TURNKEY_BASE_MODULE_OPTIONS)
    private readonly options: TurnkeyBaseModuleOptions,
  ) {}

  /**
   * 設定證明聯 QR Code 的 AES 金鑰（平台「密碼及種子管理（QRCode）」設定種子後，以財政部 QRCode 工具產生的 32 碼 HEX）。
   * 以 secretEncryptionKey 加密存放，不經 API 回傳。
   */
  async setQrAesKey(taxId: string, aesKeyHex: string): Promise<void> {
    if (!/^[0-9A-Fa-f]{32}$/.test(aesKeyHex)) {
      throw new TurnkeyValidationError([
        { code: TurnkeyValidationCode.INVALID_STATE, message: 'QR Code AES 金鑰需為 32 碼 HEX', field: 'aesKey' },
      ]);
    }

    const result = await this.companyRepo.update(
      { taxId },
      { encryptedQrAesKey: sealSecret(aesKeyHex.toUpperCase(), this.options.secretEncryptionKey) },
    );

    if (!result.affected) {
      throw new TurnkeyValidationError([
        { code: TurnkeyValidationCode.COMPANY_NOT_REGISTERED, message: '營業人尚未登錄', field: 'taxId' },
      ]);
    }
  }

  /** 取出解密後的 QR Code AES 金鑰；未設定回傳 null */
  async getQrAesKey(taxId: string): Promise<string | null> {
    const row = await this.companyRepo
      .createQueryBuilder('company')
      .select('company.encryptedQrAesKey', 'encryptedQrAesKey')
      .where('company.taxId = :taxId', { taxId })
      .getRawOne<{ encryptedQrAesKey: string | null }>();

    return row?.encryptedQrAesKey ? openSecret(row.encryptedQrAesKey, this.options.secretEncryptionKey) : null;
  }

  /** 新增或更新營業人（以統編為鍵）；Turnkey 端的設定由設定代理另外套用 */
  async register(input: TurnkeyCompanyRegisterInput): Promise<BaseTurnkeyCompanyEntity> {
    if (!isTaxIdValid(input.taxId)) {
      throw new TurnkeyValidationError([
        { code: TurnkeyValidationCode.INVALID_TAX_ID, message: '統編檢查碼錯誤', field: 'taxId' },
      ]);
    }

    const existing = await this.companyRepo.findOne({ where: { taxId: input.taxId } });

    return this.companyRepo.save(
      this.companyRepo.create({
        ...(existing ?? {}),
        taxId: input.taxId,
        name: input.name,
        address: input.address ?? null,
        routingId: input.routingId,
        exchangeEnabled: input.exchangeEnabled ?? existing?.exchangeEnabled ?? false,
        certificateExpiresAt: input.certificateExpiresAt ?? existing?.certificateExpiresAt ?? null,
      }),
    );
  }

  findByTaxId(taxId: string): Promise<BaseTurnkeyCompanyEntity | null> {
    return this.companyRepo.findOne({ where: { taxId } });
  }
}
