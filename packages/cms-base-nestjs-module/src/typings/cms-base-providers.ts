export const CMS_BASE_MODULE_OPTIONS = Symbol('CMS_BASE_MODULE_OPTIONS');
export const MULTIPLE_LANGUAGE_MODE = Symbol('MULTIPLE_LANGUAGE_MODE');
export const MULTIPLE_CATEGORY_PARENT_MODE = Symbol(
  'MULTIPLE_CATEGORY_PARENT_MODE',
);
export const CIRCULAR_CATEGORY_MODE = Symbol('CIRCULAR_CATEGORY_MODE');
export const FULL_TEXT_SEARCH_MODE = Symbol('FULL_TEXT_SEARCH_MODE');
export const ENABLE_SIGNATURE_MODE = Symbol('ENABLE_SIGNATURE_MODE');
export const SIGNATURE_LEVELS = Symbol('SIGNATURE_LEVELS');

// Options Entity Providers
export const PROVIDE_ARTICLE_ENTITY = Symbol('PROVIDE_ARTICLE_ENTITY');
export const PROVIDE_ARTICLE_VERSION_ENTITY = Symbol(
  'PROVIDE_ARTICLE_VERSION_ENTITY',
);
export const PROVIDE_ARTICLE_VERSION_CONTENT_ENTITY = Symbol(
  'PROVIDE_ARTICLE_VERSION_CONTENT_ENTITY',
);
export const PROVIDE_CATEGORY_ENTITY = Symbol('PROVIDE_CATEGORY_ENTITY');
export const PROVIDE_CATEGORY_MULTI_LANGUAGE_NAME_ENTITY = Symbol(
  'PROVIDE_CATEGORY_MULTI_LANGUAGE_NAME_ENTITY',
);
export const PROVIDE_SIGNATURE_LEVEL_ENTITY = Symbol(
  'PROVIDE_SIGNATURE_LEVEL_ENTITY',
);

// Resolved Entity Repository Providers
export const RESOLVED_ARTICLE_REPO = Symbol('RESOLVED_ARTICLE_REPO');
export const RESOLVED_ARTICLE_VERSION_REPO = Symbol(
  'RESOLVED_ARTICLE_VERSION_REPO',
);
export const RESOLVED_ARTICLE_VERSION_CONTENT_REPO = Symbol(
  'RESOLVED_ARTICLE_VERSION_CONTENT_REPO',
);
export const RESOLVED_CATEGORY_REPO = Symbol('RESOLVED_CATEGORY_REPO');
export const RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO = Symbol(
  'RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO',
);
export const RESOLVED_SIGNATURE_LEVEL_REPO = Symbol(
  'RESOLVED_SIGNATURE_LEVEL_REPO',
);

// Internal Use Injection Token
export const CATEGORY_DATA_LOADER = Symbol('CATEGORY_DATA_LOADER');
export const ARTICLE_SIGNATURE_SERVICE = Symbol('ARTICLE_SIGNATURE_SERVICE');
