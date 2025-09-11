# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.2.6](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.2.5...@rytass/cms-base-nestjs-module@0.2.6) (2025-09-11)

### Features

- migrate to Nx project-based configuration ([c2d9ca4](https://github.com/Rytass/Utils/commit/c2d9ca46c00ace42bcbf69300dcc43a7346cb9aa))

### Tests

- migrate to standardized test structure ([b7dc99e](https://github.com/Rytass/Utils/commit/b7dc99ef85f5951480dfdae6198cefa252c15423))

### BREAKING CHANGES

- Test directory structure changed from **test** to **tests**

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.2.5](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.2.4...@rytass/cms-base-nestjs-module@0.2.5) (2025-09-09)

### Bug Fixes

- add file-type ESM compatibility and test fixes ([42de851](https://github.com/Rytass/Utils/commit/42de8515f7a111588206d9b2ffb7c20b382bb90d))
- **cms-base-nestjs-module:** improve Jieba mocking and error handling ([8c12489](https://github.com/Rytass/Utils/commit/8c124891a142741254cb33dd7e68cd627952b859))
- **cms-base-nestjs-module:** resolve ESLint explicit-function-return-type errors ([92fafa9](https://github.com/Rytass/Utils/commit/92fafa97b4058991038850be0f8309f99eb367e9))
- **cms-base:** resolve @typescript-eslint/no-explicit-any errors across CMS modules ([3f64a47](https://github.com/Rytass/Utils/commit/3f64a470dff434558ba208709fd24de2d8d3ec6b))
- **wms-map-react-components:** resolve TypeScript compilation errors ([5d7ba43](https://github.com/Rytass/Utils/commit/5d7ba43e430a507ed2b443287c97fb886cf83bd3))

### Features

- add test:coverage script to all packages ([f73bce5](https://github.com/Rytass/Utils/commit/f73bce52024d453755824fa6af784f13da50061f))
- **cms-base:** add mock repository interface typings ([8219bcc](https://github.com/Rytass/Utils/commit/8219bccdbea8a22639cda8c5cdf51dcc01f3bfc2))
- upgrade file-type from v16.5.4 to v21.0.0 ([eb8217b](https://github.com/Rytass/Utils/commit/eb8217b76c4a0d74061f782c082fd4183961bb12))

### BREAKING CHANGES

- file-type v21 is ESM-only, requires Node.js 18+

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.2.4](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.2.3...@rytass/cms-base-nestjs-module@0.2.4) (2025-08-24)

### Features

- **cms-base-nestjs-module:** add default tags empty array ([c0c07e6](https://github.com/Rytass/Utils/commit/c0c07e6fb8fdd499a9775da7d2c836a7d2850715))

## [0.2.3](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.2.2...@rytass/cms-base-nestjs-module@0.2.3) (2025-08-19)

**Note:** Version bump only for package @rytass/cms-base-nestjs-module

## [0.2.2](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.2.1...@rytass/cms-base-nestjs-module@0.2.2) (2025-08-04)

### Bug Fixes

- **cms-base-nestjs-module:** typing ([be3b275](https://github.com/Rytass/Utils/commit/be3b2753c85c42bf7a242b88a57efcb21e06ac3e))

## [0.2.1](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.2.0...@rytass/cms-base-nestjs-module@0.2.1) (2025-08-04)

### Bug Fixes

- **cms-base-nestjs-module:** category types ([42c3e45](https://github.com/Rytass/Utils/commit/42c3e45ab3aa72ef9ec287d7dfcab690f2952d9d))

# [0.2.0](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.95...@rytass/cms-base-nestjs-module@0.2.0) (2025-07-28)

**Note:** Version bump only for package @rytass/cms-base-nestjs-module

## [0.1.95](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.94...@rytass/cms-base-nestjs-module@0.1.95) (2025-07-14)

### Features

- **cms-base-nestjs-module:** add default sorting by article ID in query builder ([99800d6](https://github.com/Rytass/Utils/commit/99800d63fe3da67e53857a93639c22633474fa76))
- **cms-base-nestjs-module:** add new sorting options for articles by release and submission dates ([bff22ce](https://github.com/Rytass/Utils/commit/bff22ce99eae186629fffad10e6a814230c7a445))
- **cms-base-nestjs-module:** add ordering by signature date in ArticleSignatureDataLoader ([6548634](https://github.com/Rytass/Utils/commit/65486349d661c1cfc23081f9923c0acb81c9d539))

## [0.1.94](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.93...@rytass/cms-base-nestjs-module@0.1.94) (2025-06-30)

### Bug Fixes

- **cms-base-nestjs-module:** use tableName replace with entity target to supporting resolved child entity ([6075d42](https://github.com/Rytass/Utils/commit/6075d42f20e28fa09e26e6cc236a97ab86b7c84b))

## [0.1.93](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.92...@rytass/cms-base-nestjs-module@0.1.93) (2025-06-29)

### Bug Fixes

- **cms-base-nestjs-module:** handle rejected article versions in draft mode set submittedAt null ([55ecbfb](https://github.com/Rytass/Utils/commit/55ecbfb43049f8d254e60ef166a75325d30911be))
- **cms-base-nestjs-module:** enhance version check before deleting article version ([80f1093](https://github.com/Rytass/Utils/commit/80f10933204a0f0c67ab2662a8492055d739075e))
- **cms-base-nestjs-module:** missing stage cache update on signature article ([8ccb7d7](https://github.com/Rytass/Utils/commit/8ccb7d7fc72859ec5fa259eb58c0eb420f67344a))
- **cms-base-nestjs-module:** remove redundant debug logging for released articles ([e3611d9](https://github.com/Rytass/Utils/commit/e3611d95222091102f6a038f2471ebd0e2562179))
- **cms-base-nestjs-module:** update findById method to include version and validate article stage in withdraw method ([6410d73](https://github.com/Rytass/Utils/commit/6410d73e0b656ee6acaa003704732cb2c7ee2ca4))

## [0.1.92](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.91...@rytass/cms-base-nestjs-module@0.1.92) (2025-06-26)

### Bug Fixes

- **cms-base-nestjs-module:** update rejectVersion method to check article stage before rejection ([516f4a2](https://github.com/Rytass/Utils/commit/516f4a27cd9c7e73f28eaeab66d9f4468f40a903))

### Features

- **cms-base-nestjs-graphql-module:** add putBack method to revert article submission to draft state ([7eb5b2d](https://github.com/Rytass/Utils/commit/7eb5b2daefd2868ed541920f88a244f87ecb5d65))

## [0.1.91](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.90...@rytass/cms-base-nestjs-module@0.1.91) (2025-06-23)

### Features

- **cms-base-nestjs-module:** add article stage versions loader ([72a754b](https://github.com/Rytass/Utils/commit/72a754bf995b7f1258473cf102ef66086a1b0b03))

## [0.1.90](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.89...@rytass/cms-base-nestjs-module@0.1.90) (2025-06-23)

### Features

- **cms-base-nestjs-module:** add article stage loader ([8c6df78](https://github.com/Rytass/Utils/commit/8c6df78462cb069ac09b0253ea93d74598d6a074))

## [0.1.89](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.88...@rytass/cms-base-nestjs-module@0.1.89) (2025-06-23)

### Features

- **cms-base-nestjs-module:** add versions, categories data loader ([4b66d54](https://github.com/Rytass/Utils/commit/4b66d547f1ba8feae7fe36edce79278ac6a770d6))

## [0.1.88](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.87...@rytass/cms-base-nestjs-module@0.1.88) (2025-06-23)

### Features

- **cms-base-nestjs-module:** add deletedAt, updatedBy column on response type ([2417f06](https://github.com/Rytass/Utils/commit/2417f063d809edb8679a9b181622712403b6ecad))

## [0.1.87](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.86...@rytass/cms-base-nestjs-module@0.1.87) (2025-06-23)

### Bug Fixes

- **cms-base-nestjs-module:** add runner on signature respnose findById ([52e892b](https://github.com/Rytass/Utils/commit/52e892b91f2a81c5bd2b9762bee23b0a212faff6))

## [0.1.86](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.85...@rytass/cms-base-nestjs-module@0.1.86) (2025-06-23)

### Features

- **cms-base-nestjs-module:** add updatedAt on find response ([0575df7](https://github.com/Rytass/Utils/commit/0575df7d02b77bfed27d336a1c7c47f82d980d6d))

## [0.1.85](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.84...@rytass/cms-base-nestjs-module@0.1.85) (2025-06-23)

### Bug Fixes

- **cms-base-nestjs-module:** add missing article field: id and createdAt ([11f3448](https://github.com/Rytass/Utils/commit/11f344844f1968fe90fd1f24b85415b8f57ba0dc))

## [0.1.84](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.83...@rytass/cms-base-nestjs-module@0.1.84) (2025-06-23)

### Features

- **cms-base-nestjs-module:** export config symbol ([08c6a57](https://github.com/Rytass/Utils/commit/08c6a574a1d6b057d89277c873e11e8aa6bf17b6))

## [0.1.83](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.82...@rytass/cms-base-nestjs-module@0.1.83) (2025-06-23)

**Note:** Version bump only for package @rytass/cms-base-nestjs-module

## [0.1.82](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.81...@rytass/cms-base-nestjs-module@0.1.82) (2025-06-23)

### Bug Fixes

- **cms-base-nestjs-module:** type definition ([c341014](https://github.com/Rytass/Utils/commit/c341014a4338b95ea86f6dd58a8518cd07c85d5e))

## [0.1.81](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.80...@rytass/cms-base-nestjs-module@0.1.81) (2025-06-23)

### Bug Fixes

- **cms-base-nestjs-module:** create and addVersion return types ([5eab751](https://github.com/Rytass/Utils/commit/5eab751eab131f3f8b45be6cb4d00ba94353494b))

## [0.1.80](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.79...@rytass/cms-base-nestjs-module@0.1.80) (2025-06-23)

**Note:** Version bump only for package @rytass/cms-base-nestjs-module

## [0.1.79](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.78...@rytass/cms-base-nestjs-module@0.1.79) (2025-06-23)

**Note:** Version bump only for package @rytass/cms-base-nestjs-module

## [0.1.78](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.77...@rytass/cms-base-nestjs-module@0.1.78) (2025-06-21)

### Features

- **cms-base-nestjs-module:** add userId option to release method and update releasedBy field ([36d5e83](https://github.com/Rytass/Utils/commit/36d5e83ea8be761630ef9d1c4f3c91df0d80ea37))

## [0.1.77](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.76...@rytass/cms-base-nestjs-module@0.1.77) (2025-06-20)

### Features

- **cms-base-nestjs-module:** add createdBy field to BaseArticleVersionEntity and update service to set it ([91c3ded](https://github.com/Rytass/Utils/commit/91c3ded593531f979153df58de9a72c4c3738b33))

## [0.1.76](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.75...@rytass/cms-base-nestjs-module@0.1.76) (2025-06-20)

### Features

- **cms-base-nestjs-module:** normalize response type dto ([249571d](https://github.com/Rytass/Utils/commit/249571d08ecbd9fa93d5fbbe1331594675e9cac0))

## [0.1.75](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.74...@rytass/cms-base-nestjs-module@0.1.75) (2025-06-11)

### Bug Fixes

- **cms-base-nestjs-module:** remove unused options from create article and add version ([265639d](https://github.com/Rytass/Utils/commit/265639d51aff396dd9e65e73c64fa8a9d4ae2a1a))

## [0.1.74](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.73...@rytass/cms-base-nestjs-module@0.1.74) (2025-06-10)

### Bug Fixes

- **cms-base-nestjs-module:** stage filter ([dc80f5d](https://github.com/Rytass/Utils/commit/dc80f5d34e5cd3ec2fffc3e927862c746b645eb7))

## [0.1.73](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.72...@rytass/cms-base-nestjs-module@0.1.73) (2025-06-10)

**Note:** Version bump only for package @rytass/cms-base-nestjs-module

## [0.1.72](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.71...@rytass/cms-base-nestjs-module@0.1.72) (2025-06-10)

### Bug Fixes

- **cms-base-nestjs-module:** version is zero ([325d74a](https://github.com/Rytass/Utils/commit/325d74ab38211f2848bee8be02c6cf95d474cb68))

### Features

- **cms-base-nestjs-module:** update article stage auto replace flow ([1ac32e0](https://github.com/Rytass/Utils/commit/1ac32e030506021f1eb114f6adbf2460deb13a1f))

## [0.1.71](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.70...@rytass/cms-base-nestjs-module@0.1.71) (2025-06-10)

### Bug Fixes

- **cms-base-nestjs-module:** change article dto will be spread of article and article version entity ([dbab297](https://github.com/Rytass/Utils/commit/dbab29762b947393a868abd67bc92e53eef4bf8d))

### Features

- **cms-base-nestjs-module:** utils for article entity column normailize ([3ec70c9](https://github.com/Rytass/Utils/commit/3ec70c90cf8b2f77a4153e073f779f409785d93e))

## [0.1.70](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.69...@rytass/cms-base-nestjs-module@0.1.70) (2025-06-10)

### Bug Fixes

- **cms-base-nestjs-module:** prevent findById error crash action method ([ece5d10](https://github.com/Rytass/Utils/commit/ece5d1022f4276cd39d06dc7a380dbca84bdc84f))

## [0.1.69](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.68...@rytass/cms-base-nestjs-module@0.1.69) (2025-06-10)

### Bug Fixes

- fix linting problems ([09de780](https://github.com/Rytass/Utils/commit/09de780af16cb3b99aa75e9bf7432c4f628be904))

## [0.1.68](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.67...@rytass/cms-base-nestjs-module@0.1.68) (2025-04-30)

### Bug Fixes

- remove typeorm default date column type for sync issue ([babba5f](https://github.com/Rytass/Utils/commit/babba5fb36d53bf102b1b249923f3c3ffa03efd8))

## [0.1.67](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.66...@rytass/cms-base-nestjs-module@0.1.67) (2025-04-30)

### Features

- correct DateColumn type ([f8ddb57](https://github.com/Rytass/Utils/commit/f8ddb572c51664b1c33e84fe2d0c89325a3f8841))

## [0.1.66](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.65...@rytass/cms-base-nestjs-module@0.1.66) (2025-04-22)

### Features

- **cms-base-nestjs-module:** add autoReleaseWhenLatestSignatureApproved to support auto release on signature mode ([77c4fb2](https://github.com/Rytass/Utils/commit/77c4fb25e8cebe61e60cfeda1e95e28aa601b075))

## [0.1.65](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.64...@rytass/cms-base-nestjs-module@0.1.65) (2025-04-22)

### Features

- **cms-base-nestjs-module:** add draft mode ([e9b61ce](https://github.com/Rytass/Utils/commit/e9b61ce01f90d2940144e82b7c1c5f4f2bb64462))
- **cms-base-nestjs-module:** add index on foreign keys ([04eaaeb](https://github.com/Rytass/Utils/commit/04eaaeb6c6c11ff93519d577ba6d7b8d91a69a94))
- **cms-base-nestjs-module:** add signaureLevel filter on findAll ([67ae81f](https://github.com/Rytass/Utils/commit/67ae81f1fa21ba5616b55ae46456a55df61c9de4))
- **cms-base-nestjs-module:** change all timestamp column to timestamptz in default ([0f1affb](https://github.com/Rytass/Utils/commit/0f1affb572710c47c8606757231387bc805cb1c3))

## [0.1.64](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.63...@rytass/cms-base-nestjs-module@0.1.64) (2025-04-01)

### Bug Fixes

- **cms-base-nestjs-module:** add missing version column in findById response ([0eabe52](https://github.com/Rytass/Utils/commit/0eabe520787e44fd35e1461d8b7ce146eb5f6443))
- **cms-base-nestjs-module:** category update on non-multi-language mode ([954bbe6](https://github.com/Rytass/Utils/commit/954bbe65224d0457930e389ff5cb027fa9728a0b))

## [0.1.63](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.62...@rytass/cms-base-nestjs-module@0.1.63) (2025-03-22)

### Bug Fixes

- **cms-base-nestjs-module:** correct getCollection response type ([e76ecec](https://github.com/Rytass/Utils/commit/e76ecec4093af123a4b3c478ba3f24af7814ec4a))
- **cms-base-nestjs-module:** default tags value if not provided by user ([bf990d4](https://github.com/Rytass/Utils/commit/bf990d49f9c4efe97c3d65d1cc1eccb17228e3ea))

## [0.1.62](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.61...@rytass/cms-base-nestjs-module@0.1.62) (2025-03-22)

### Features

- **cms-base-nestjs-module:** export dto types ([a21a7cf](https://github.com/Rytass/Utils/commit/a21a7cfbdd5f3be6a2a67ac952886d8e84f8c009))

## [0.1.61](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.60...@rytass/cms-base-nestjs-module@0.1.61) (2025-02-02)

### Features

- **cms-base-nestjs-module:** seperate categoryIds and requiredCategoryIds on find all articles filter ([c331f86](https://github.com/Rytass/Utils/commit/c331f86d728c3113e84f024a3524adcfc09a9486))

## [0.1.60](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.59...@rytass/cms-base-nestjs-module@0.1.60) (2025-01-29)

### Bug Fixes

- **cms-base-nestjs-module:** entityName bug on exists where ([b373254](https://github.com/Rytass/Utils/commit/b373254f76ff19031de06c9a54f0faecdb3c1641))

## [0.1.59](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.58...@rytass/cms-base-nestjs-module@0.1.59) (2025-01-29)

### Features

- **cms-base-nestjs-module:** update search term sql statement ([37160f0](https://github.com/Rytass/Utils/commit/37160f08901a6fa5558c15e630796b3ed29a5320))

## [0.1.58](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.57...@rytass/cms-base-nestjs-module@0.1.58) (2025-01-29)

### Features

- **cms-base-nestjs-module:** add categories parent id filter support ([5336c43](https://github.com/Rytass/Utils/commit/5336c43f91da2fc1f42e453d725941a629812fd4))

## [0.1.57](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.56...@rytass/cms-base-nestjs-module@0.1.57) (2025-01-29)

### Features

- **cms-base-nestjs-module:** add find collection support pagination request on article service ([44da9ae](https://github.com/Rytass/Utils/commit/44da9ae3877944aafe2ebad8ae1dfed7efbae76f))

## [0.1.56](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.55...@rytass/cms-base-nestjs-module@0.1.56) (2024-11-29)

**Note:** Version bump only for package @rytass/cms-base-nestjs-module

## [0.1.55](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.54...@rytass/cms-base-nestjs-module@0.1.55) (2024-08-26)

### Bug Fixes

- **cms-base-nestjs-module:** correct parameter name ([b31ae4c](https://github.com/Rytass/Utils/commit/b31ae4cb24fc8af6ce97dde705bf9df3db358723))

## [0.1.54](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.53...@rytass/cms-base-nestjs-module@0.1.54) (2024-08-26)

### Features

- **cms-base-nestjs-module:** export ArticleSignatureDataLoader ([ab9bc8e](https://github.com/Rytass/Utils/commit/ab9bc8ecf3b359d271164f8cd4a9fbd83ff602db))

## [0.1.53](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.52...@rytass/cms-base-nestjs-module@0.1.53) (2024-08-26)

### Bug Fixes

- **cms-base-nestjs-module:** use difference parameter name to avoiding overwrite ([ebf4b94](https://github.com/Rytass/Utils/commit/ebf4b94c6a74c9ec545fad35f4d2f6903e30e839))

## [0.1.52](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.51...@rytass/cms-base-nestjs-module@0.1.52) (2024-08-26)

### Features

- **cms-base-nestjs-module:** support TITLE_AND_TAG in searchMode ([24a11f9](https://github.com/Rytass/Utils/commit/24a11f942e332f0c17ec458e7a6f9021e6f58d8f))

## [0.1.51](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.50...@rytass/cms-base-nestjs-module@0.1.51) (2024-08-26)

### Features

- **cms-base-nestjs-module:** clear levels if not provide ([e5d9971](https://github.com/Rytass/Utils/commit/e5d9971f5c4a8df1b044354f3ce337933cc0b23e))

## [0.1.50](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.49...@rytass/cms-base-nestjs-module@0.1.50) (2024-08-26)

### Bug Fixes

- **cms-base-nestjs-module:** missing symbol export ([3698a18](https://github.com/Rytass/Utils/commit/3698a18fd5f01090571113ce0146ac81d27ed31f))

## [0.1.49](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.48...@rytass/cms-base-nestjs-module@0.1.49) (2024-08-26)

### Bug Fixes

- **cms-base-nestjs-module:** remove rejected record when approve overwrite request ([be6bae8](https://github.com/Rytass/Utils/commit/be6bae8f3433259094466a3a9f4b84b02fc8103a))

### Features

- **cms-base-nestjs-module:** article signature dataloader ([17f73c0](https://github.com/Rytass/Utils/commit/17f73c0c388d8aea8963cbca77802a3eacd53cc9))

## [0.1.48](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.47...@rytass/cms-base-nestjs-module@0.1.48) (2024-08-26)

### Bug Fixes

- **cms-base-nestjs-module:** add missing commit ([49b700e](https://github.com/Rytass/Utils/commit/49b700eeb527a6b48317cf393b5cafe713ebf5a8))

## [0.1.47](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.46...@rytass/cms-base-nestjs-module@0.1.47) (2024-08-26)

### Bug Fixes

- **cms-base-nestjs-module:** soft delete criteria ([42dbd92](https://github.com/Rytass/Utils/commit/42dbd92d7fc0cb1c10ff59992ebfbcb4fd58ad00))

## [0.1.46](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.45...@rytass/cms-base-nestjs-module@0.1.46) (2024-08-26)

### Bug Fixes

- **cms-base-nestjs-module:** unique duplicate issue on initialize ([a8d87c2](https://github.com/Rytass/Utils/commit/a8d87c2b20110501e78ecfd2af4da30f8858044e))

## [0.1.45](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.44...@rytass/cms-base-nestjs-module@0.1.45) (2024-08-26)

### Bug Fixes

- **cms-base-nestjs-module:** validate signature level on levels provided ([3354f4b](https://github.com/Rytass/Utils/commit/3354f4bc36e5a34e1fd4865aaa61d4b5e2eac339))

## [0.1.44](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.43...@rytass/cms-base-nestjs-module@0.1.44) (2024-08-26)

### Features

- **cms-base-nestjs-module:** signature reject method ([3f8326c](https://github.com/Rytass/Utils/commit/3f8326c91dd7b40b5e89c5f3715e7ffbdb837ea2))

## [0.1.43](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.42...@rytass/cms-base-nestjs-module@0.1.43) (2024-08-26)

### Features

- **cms-base-nestjs-module:** signature approve basement ([f0d853f](https://github.com/Rytass/Utils/commit/f0d853f2ad2b4a1e4a0c0d78fc38435e4ed2b6c9))

## [0.1.42](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.41...@rytass/cms-base-nestjs-module@0.1.42) (2024-08-26)

### Features

- **cms-base-nestjs-module:** export quadrats empty element item ([55a5f14](https://github.com/Rytass/Utils/commit/55a5f14539294e54becf61d040c6baa44d1ca6df))

## [0.1.41](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.40...@rytass/cms-base-nestjs-module@0.1.41) (2024-08-26)

### Bug Fixes

- **cms-base-nestjs-module:** SQL typo ([f39b432](https://github.com/Rytass/Utils/commit/f39b4324e01296848a00b7fd9957642b4f5949c3))

### Features

- **cms-base-nestjs-module:** change tags column type to jsonb ([7ed92aa](https://github.com/Rytass/Utils/commit/7ed92aae69b0e3e8b03d22e7751403c1811637e5))

## [0.1.40](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.39...@rytass/cms-base-nestjs-module@0.1.40) (2024-08-26)

### Bug Fixes

- **cms-base-nestjs-module:** findAll and findById only return latest version article ([22791dd](https://github.com/Rytass/Utils/commit/22791dd2424e925f652eb976fdbd47dbd5564752))

## [0.1.39](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.38...@rytass/cms-base-nestjs-module@0.1.39) (2024-08-26)

### Bug Fixes

- **cms-base-nestjs-module:** use overload method on create and addVersion method ([395aa4d](https://github.com/Rytass/Utils/commit/395aa4d6283412a740c7cb1290352e38e139f655))

## [0.1.38](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.37...@rytass/cms-base-nestjs-module@0.1.38) (2024-08-26)

### Bug Fixes

- **cms-base-nestjs-module:** typing DeepPartial -> Partial ([448550f](https://github.com/Rytass/Utils/commit/448550f7fffba0b9c1666fa767e9f598c8d6efcc))

## [0.1.37](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.36...@rytass/cms-base-nestjs-module@0.1.37) (2024-08-26)

### Bug Fixes

- **cms-base-nestjs-module:** typing definition in create dto ([d55ae44](https://github.com/Rytass/Utils/commit/d55ae4447cfcdd5efe6b973da66caf641c8b8aec))

## [0.1.36](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.35...@rytass/cms-base-nestjs-module@0.1.36) (2024-08-23)

**Note:** Version bump only for package @rytass/cms-base-nestjs-module

## [0.1.35](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.34...@rytass/cms-base-nestjs-module@0.1.35) (2024-08-23)

### Bug Fixes

- **cms-base-nestjs-module:** update save entity type ([8fc5ee3](https://github.com/Rytass/Utils/commit/8fc5ee352b5207bdcf510c11a6063eea15df3fe9))

### Features

- **cms-base-nestjs-module:** add full text search ([99e7649](https://github.com/Rytass/Utils/commit/99e764979224bf1767f409b752da3286581c5073))

## [0.1.34](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.33...@rytass/cms-base-nestjs-module@0.1.34) (2024-08-20)

### Features

- **cms-base-nestjs-module:** allow deep partial in article, category create and update ([f982aa7](https://github.com/Rytass/Utils/commit/f982aa76c9aa3483c68aba3dacb5d3c8fde21a70))

## [0.1.33](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.32...@rytass/cms-base-nestjs-module@0.1.33) (2024-08-19)

### Features

- **cms-base-nestjs-module:** typing infer ([13832df](https://github.com/Rytass/Utils/commit/13832dfc1e49ba584ffc74c2c4133bd056f8bfbe))

## [0.1.32](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.31...@rytass/cms-base-nestjs-module@0.1.32) (2024-08-19)

### Features

- **cms-base-nestjs-module:** export RESOLVED\_\* repositories symbol ([4c7662a](https://github.com/Rytass/Utils/commit/4c7662a6c8e9a9a848af4fc921e4f45caaa67c9e))

## [0.1.31](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.30...@rytass/cms-base-nestjs-module@0.1.31) (2024-08-19)

### Features

- **cms-base-nestjs-module:** export errors as a constant collection ([19d8e88](https://github.com/Rytass/Utils/commit/19d8e88971ee5b13210a89456db0d565a1b5373a))

## [0.1.30](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.29...@rytass/cms-base-nestjs-module@0.1.30) (2024-08-07)

### Bug Fixes

- **cms-base-nestjs-module:** correct forRoot method providers ([fb66e22](https://github.com/Rytass/Utils/commit/fb66e22b6f72cfbd8ff3660169edb6bff3bca629))

## [0.1.29](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.28...@rytass/cms-base-nestjs-module@0.1.29) (2024-08-07)

**Note:** Version bump only for package @rytass/cms-base-nestjs-module

## [0.1.28](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.27...@rytass/cms-base-nestjs-module@0.1.28) (2024-07-31)

### Bug Fixes

- **member-base-nestjs-module:** correct package.json ([c5c11e0](https://github.com/Rytass/Utils/commit/c5c11e0b077ad20249aba4273ed8449d6e23d704))

## [0.1.27](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.26...@rytass/cms-base-nestjs-module@0.1.27) (2024-07-31)

### Features

- **member-base-nestjs-module:** add casbin ([dfc58de](https://github.com/Rytass/Utils/commit/dfc58de22b26930271e5af0692ffaf7b0eb1af22))

## [0.1.26](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.25...@rytass/cms-base-nestjs-module@0.1.26) (2024-07-31)

### Features

- **cms-base-nestjs-module:** export repository symbol and dataloader ([7ead0be](https://github.com/Rytass/Utils/commit/7ead0becbebfc087a11d046910b1da2c26a6be7c))

## [0.1.25](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.24...@rytass/cms-base-nestjs-module@0.1.25) (2024-07-30)

### Features

- **cms-base-nestjs-module:** add sorter and pagination on category find all ([39e342c](https://github.com/Rytass/Utils/commit/39e342c6ccd6f31baf769e024a52114fe757c892))

## [0.1.24](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.23...@rytass/cms-base-nestjs-module@0.1.24) (2024-07-30)

### Features

- **cms-base-nestjs-module:** add fromTop filter on category find all ([29d2f18](https://github.com/Rytass/Utils/commit/29d2f187d10bf0ee7ffcd3d1b0addf83bf456f9b))

## [0.1.23](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.22...@rytass/cms-base-nestjs-module@0.1.23) (2024-07-30)

### Bug Fixes

- **cms-base-nestjs-module:** circular check logic ([8f1a8d1](https://github.com/Rytass/Utils/commit/8f1a8d1efe542e78d1e6c31820d4aac7c15f94ec))

## [0.1.22](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.21...@rytass/cms-base-nestjs-module@0.1.22) (2024-07-30)

### Bug Fixes

- **cms-base-nestjs-module:** join table alias duplicate issue ([99903dc](https://github.com/Rytass/Utils/commit/99903dce5d28fd83404a21378d352aa325503667))

## [0.1.21](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.20...@rytass/cms-base-nestjs-module@0.1.21) (2024-07-30)

### Bug Fixes

- **cms-base-nestjs-module:** injectable not working issue ([5c43e2f](https://github.com/Rytass/Utils/commit/5c43e2fae7982f779807fb9e831ff12d9a21d6d8))

## [0.1.20](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.19...@rytass/cms-base-nestjs-module@0.1.20) (2024-07-30)

**Note:** Version bump only for package @rytass/cms-base-nestjs-module

## [0.1.19](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.18...@rytass/cms-base-nestjs-module@0.1.19) (2024-07-30)

### Bug Fixes

- **cms-base-nestjs-module:** update cascade policy ([2d9a587](https://github.com/Rytass/Utils/commit/2d9a5875fab67e003f88b7ac345e6f669d95e2b9))

## [0.1.18](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.17...@rytass/cms-base-nestjs-module@0.1.18) (2024-07-30)

### Bug Fixes

- **cms-base-nestjs-module:** correct cascade sides ([7fb0202](https://github.com/Rytass/Utils/commit/7fb02029397f8f3587ea8a71422314bcfc58d1e8))

## [0.1.17](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.16...@rytass/cms-base-nestjs-module@0.1.17) (2024-07-30)

### Bug Fixes

- **cms-base-nestjs-module:** add cascade at each sides ([f59fe8d](https://github.com/Rytass/Utils/commit/f59fe8da3a1cd1d7dc87cafc409a6330dbf49a8d))

## [0.1.16](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.15...@rytass/cms-base-nestjs-module@0.1.16) (2024-07-30)

### Bug Fixes

- **cms-base-nestjs-module:** correct many to many directions ([05136d2](https://github.com/Rytass/Utils/commit/05136d23e5d7e3685c44997160a18f59ab01c773))

## [0.1.15](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.14...@rytass/cms-base-nestjs-module@0.1.15) (2024-07-30)

### Features

- **cms-base-nestjs-module:** support parentId option on multiple mode, throw error when user provide parentIds in single mode ([8c78315](https://github.com/Rytass/Utils/commit/8c78315b2968a142c8b7c2bd6011201a712a2614))

## [0.1.14](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.13...@rytass/cms-base-nestjs-module@0.1.14) (2024-07-30)

### Features

- **cms-base-nestjs-module:** add multiple parent config and disable circular option ([36ab79b](https://github.com/Rytass/Utils/commit/36ab79b36b1e3587a7eb4c81b8e866ebfab3b915))

## [0.1.13](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.12...@rytass/cms-base-nestjs-module@0.1.13) (2024-07-30)

### Features

- **cms-base-nestjs-module:** add custom child entity providers ([d8b93d0](https://github.com/Rytass/Utils/commit/d8b93d0fb34372bd1d03715c1cc1c7b4f3701381))

## [0.1.12](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.11...@rytass/cms-base-nestjs-module@0.1.12) (2024-07-30)

### Features

- **member-base-nestjs-module:** add async providers ([2f11bd0](https://github.com/Rytass/Utils/commit/2f11bd021a31cd3457389d78dbf56f93961c8765))

## [0.1.11](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.10...@rytass/cms-base-nestjs-module@0.1.11) (2024-07-30)

### Bug Fixes

- **cms-base-nestjs-module:** circular children issue ([498c088](https://github.com/Rytass/Utils/commit/498c08853152bdabbfd37492faf143b7757e0531))

### Features

- **cms-base-nestjs-module:** add async factory ([7d1f8eb](https://github.com/Rytass/Utils/commit/7d1f8eb5ab520e8b9ad232e0f5c3f1f18400a0fb))

## [0.1.10](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.9...@rytass/cms-base-nestjs-module@0.1.10) (2024-07-30)

### Bug Fixes

- **cms-base-nestjs-module:** child category names join ([6a392bb](https://github.com/Rytass/Utils/commit/6a392bb45351dcd6612a55a545ba4f244a0f4111))

## [0.1.9](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.8...@rytass/cms-base-nestjs-module@0.1.9) (2024-07-30)

### Bug Fixes

- **cms-base-nestjs-module:** overloading declaration ([d3855cf](https://github.com/Rytass/Utils/commit/d3855cf4d79e21cda5a348dff417a9a995d06a58))

## [0.1.8](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.7...@rytass/cms-base-nestjs-module@0.1.8) (2024-07-30)

### Features

- **cms-base-nestjs-module:** category language based dto ([d4cc509](https://github.com/Rytass/Utils/commit/d4cc509b51190adfbd8d75053623388079b71a54))

## [0.1.7](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.6...@rytass/cms-base-nestjs-module@0.1.7) (2024-07-30)

### Features

- **cms-base-nestjs-module:** relation cascade ([976fd4e](https://github.com/Rytass/Utils/commit/976fd4ea2864bc242f34ae9305b8f53866f24fd2))

## [0.1.6](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.5...@rytass/cms-base-nestjs-module@0.1.6) (2024-07-30)

**Note:** Version bump only for package @rytass/cms-base-nestjs-module

## [0.1.5](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.4...@rytass/cms-base-nestjs-module@0.1.5) (2024-07-30)

### Bug Fixes

- **cms-base-nestjs-module:** category bindable default is true ([e50d2cf](https://github.com/Rytass/Utils/commit/e50d2cff06a39c2b41699bc022854d4fc61d21d7))
- **cms-base-nestjs-module:** create category params optional ([14b3030](https://github.com/Rytass/Utils/commit/14b3030eb3ba80f945b4dc8c21894c161c679531))

## [0.1.4](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.3...@rytass/cms-base-nestjs-module@0.1.4) (2024-07-30)

### Bug Fixes

- **cms-base-nestjs-module:** typo ([e885b8a](https://github.com/Rytass/Utils/commit/e885b8af9b4672d7c4fd0b064acfce128ecfc4d1))

## [0.1.3](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.2...@rytass/cms-base-nestjs-module@0.1.3) (2024-07-30)

### Features

- **cms-base-nestjs-module:** export category service ([7076b52](https://github.com/Rytass/Utils/commit/7076b528ac9eaea097e22f25c214c3da6acb20b2))

## [0.1.2](https://github.com/Rytass/Utils/compare/@rytass/cms-base-nestjs-module@0.1.1...@rytass/cms-base-nestjs-module@0.1.2) (2024-07-30)

### Features

- **cms-base-nestjs-module:** article category binding ([0f8df7a](https://github.com/Rytass/Utils/commit/0f8df7af249344a85dd98c7b28f54020e1da0e1f))

## 0.1.1 (2024-07-29)

### Features

- **cms-base-nestjs-module:** initial module ([41deec7](https://github.com/Rytass/Utils/commit/41deec71387da26cf8c1afdff8fa768b966904eb))
