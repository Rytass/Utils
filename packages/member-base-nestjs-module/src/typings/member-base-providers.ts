export const MEMBER_BASE_MODULE_OPTIONS = Symbol('MEMBER_BASE_MODULE_OPTIONS');
export const LOGIN_FAILED_BAN_THRESHOLD = Symbol('LOGIN_FAILED_BAN_THRESHOLD');
export const RESET_PASSWORD_TOKEN_EXPIRATION = Symbol(
  'RESET_PASSWORD_TOKEN_EXPIRATION',
);
export const RESET_PASSWORD_TOKEN_SECRET = Symbol(
  'RESET_PASSWORD_TOKEN_SECRET',
);
export const CASBIN_ENFORCER = Symbol('CASBIN_ENFORCER');
export const CASBIN_PERMISSION_DECORATOR = Symbol(
  'CASBIN_PERMISSION_DECORATOR',
);
export const CASBIN_PERMISSION_CHECKER = Symbol('CASBIN_PERMISSION_CHECKER');
export const ACCESS_TOKEN_SECRET = Symbol('ACCESS_TOKEN_SECRET');
export const ACCESS_TOKEN_EXPIRATION = Symbol('ACCESS_TOKEN_EXPIRATION');
export const REFRESH_TOKEN_SECRET = Symbol('REFRESH_TOKEN_SECRET');
export const REFRESH_TOKEN_EXPIRATION = Symbol('REFRESH_TOKEN_EXPIRATION');
export const ENABLE_GLOBAL_GUARD = Symbol('ENABLE_GLOBAL_GUARD');
export const ONLY_RESET_REFRESH_TOKEN_EXPIRATION_BY_PASSWORD = Symbol(
  'ONLY_RESET_REFRESH_TOKEN_EXPIRATION_BY_PASSWORD',
);

// Options Entity Providers
export const PROVIDE_MEMBER_ENTITY = Symbol('PROVIDE_MEMBER_ENTITY');

// Resolved Entity Repository Providers
export const RESOLVED_MEMBER_REPO = Symbol('RESOLVED_MEMBER_REPO');

// Password Policy Providers
export const PASSWORD_SHOULD_INCLUDE_UPPERCASE = Symbol(
  'PASSWORD_SHOULD_INCLUDE_UPPERCASE',
);
export const PASSWORD_SHOULD_INCLUDE_LOWERCASE = Symbol(
  'PASSWORD_SHOULD_INCLUDE_LOWERCASE',
);
export const PASSWORD_SHOULD_INCLUDE_DIGIT = Symbol(
  'PASSWORD_SHOULD_INCLUDE_DIGIT',
);
export const PASSWORD_SHOULD_INCLUDE_SPECIAL_CHARACTER = Symbol(
  'PASSWORD_SHOULD_INCLUDE_SPECIAL_CHARACTER',
);
export const PASSWORD_MIN_LENGTH = Symbol('PASSWORD_MIN_LENGTH');
export const PASSWORD_POLICY_REGEXP = Symbol('PASSWORD_POLICY_REGEXP');
export const PASSWORD_HISTORY_LIMIT = Symbol('PASSWORD_HISTORY_LIMIT');
export const PASSWORD_AGE_LIMIT_IN_DAYS = Symbol('PASSWORD_AGE_LIMIT_IN_DAYS');
export const FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED = Symbol(
  'FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED',
);
