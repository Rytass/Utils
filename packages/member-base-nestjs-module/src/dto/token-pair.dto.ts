export class TokenPairDto {
  accessToken: string;
  refreshToken: string;
  shouldUpdatePassword?: boolean;
  passwordChangedAt?: string; // ISO8601
}
