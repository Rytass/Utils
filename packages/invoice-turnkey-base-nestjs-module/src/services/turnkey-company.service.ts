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
  /** 軟體憑證到期日；未設定時不會發 certificate.expiring 通知。可傳 Date 或 ISO 字串 */
  readonly certificateExpiresAt?: Date | string;
}

/** 對外回傳的營業人資料：不含 QR Code 金鑰，只標示是否已設定 */
export interface TurnkeyCompanyView {
  readonly taxId: string;
  readonly name: string;
  readonly address: string | null;
  readonly routingId: string;
  readonly exchangeEnabled: boolean;
  readonly certificateExpiresAt: Date | null;
  readonly qrAesKeyConfigured: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const invalidInput = (code: TurnkeyValidationCode, message: string, field: string): TurnkeyValidationError =>
  new TurnkeyValidationError([{ code, message, field }]);

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

    if (typeof input.name !== 'string' || !input.name.trim()) {
      throw invalidInput(TurnkeyValidationCode.INVALID_STATE, '請填寫營業人名稱', 'name');
    }

    // 繞送代碼（Turnkey 送方設定）最長 39 碼
    if (typeof input.routingId !== 'string' || !input.routingId.trim() || input.routingId.length > 39) {
      throw invalidInput(TurnkeyValidationCode.INVALID_STATE, '繞送代碼需為 1–39 碼', 'routingId');
    }

    if (input.certificateExpiresAt !== undefined && Number.isNaN(new Date(input.certificateExpiresAt).getTime())) {
      throw invalidInput(TurnkeyValidationCode.INVALID_STATE, '憑證到期日格式錯誤', 'certificateExpiresAt');
    }

    const existing = await this.companyRepo.findOne({ where: { taxId: input.taxId } });

    return this.companyRepo.save(
      this.companyRepo.create({
        ...(existing ?? {}),
        taxId: input.taxId,
        name: input.name,
        address: input.address !== undefined ? input.address : (existing?.address ?? null),
        routingId: input.routingId,
        exchangeEnabled: input.exchangeEnabled ?? existing?.exchangeEnabled ?? false,
        certificateExpiresAt:
          input.certificateExpiresAt !== undefined
            ? new Date(input.certificateExpiresAt)
            : (existing?.certificateExpiresAt ?? null),
      }),
    );
  }

  /** 管理介面用的營業人資料；未登錄回傳 null */
  async describe(taxId: string): Promise<TurnkeyCompanyView | null> {
    const company = await this.findByTaxId(taxId);

    if (!company) return null;

    return {
      taxId: company.taxId,
      name: company.name,
      address: company.address,
      routingId: company.routingId,
      exchangeEnabled: company.exchangeEnabled,
      certificateExpiresAt: company.certificateExpiresAt,
      qrAesKeyConfigured: (await this.getQrAesKey(taxId)) !== null,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }

  findByTaxId(taxId: string): Promise<BaseTurnkeyCompanyEntity | null> {
    return this.companyRepo.findOne({ where: { taxId } });
  }
}
