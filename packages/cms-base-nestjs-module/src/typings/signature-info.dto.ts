import { BaseSignatureLevelEntity } from '../models/base-signature-level.entity';

export interface SignatureInfoDto<SignatureLevelEntity extends BaseSignatureLevelEntity = BaseSignatureLevelEntity> {
  signerId?: string | null;
  signatureLevel?: string | SignatureLevelEntity | null;
}
