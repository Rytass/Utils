# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.1.21](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.20...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.21) (2026-01-14)

**Note:** Version bump only for package @rytass/payments-adapter-ctbc-micro-fast-pay

## [0.1.20](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.19...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.20) (2025-12-05)

**Note:** Version bump only for package @rytass/payments-adapter-ctbc-micro-fast-pay

## [0.1.19](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.18...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.19) (2025-12-04)

### Bug Fixes

- **api:** fix ctbc payment page merchant name in big 5 ([ec76c2d](https://github.com/Rytass/Utils/commit/ec76c2dfda742e206ee1dd39f416e99936566f9e))
- **api:** refactor ctbc payment page merchant name in big 5 ([18f2ea4](https://github.com/Rytass/Utils/commit/18f2ea48fa3200dffb7f4aef88258c53a19e02bc))

## [0.1.18](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.17...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.18) (2025-11-26)

### Features

- **payments-adapter-ctbc-micro-fast-pay:** create ctbc payments with merchantName ([44aa40a](https://github.com/Rytass/Utils/commit/44aa40a2278f855dcd0ecf8001c4c2c633129e3b))

## [0.1.17](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.16...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.17) (2025-11-10)

### Features

- **payments-adapter-ctbc-micro-fast-pay:** fix test case ([de349aa](https://github.com/Rytass/Utils/commit/de349aa3f4385a0bd6f5a73fcee1de7203031734))
- **payments-adapter-ctbc-micro-fast-pay:** refactor error message and update pos api query check response success logic ([6ef23d3](https://github.com/Rytass/Utils/commit/6ef23d3325d62deec66b2ed497f7fdbeebb4924e))

## [0.1.16](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.15...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.16) (2025-10-31)

### Features

- **payments-adapter-ctbc-micro-fast-pay:** add some logs for tracing ([eaebda6](https://github.com/Rytass/Utils/commit/eaebda63413f6c364569024bf1de2d1b25e89556))
- **payments-adapter-ctbc-micro-fast-pay:** add test case for return error when ctbc cancel or refund in some situations ([b8ad3e9](https://github.com/Rytass/Utils/commit/b8ad3e9cefe5b24e8dc037ec11eaec9fe429fb56))
- **payments-adapter-ctbc-micro-fast-pay:** refactor ctbc amex api utils ([6ab505d](https://github.com/Rytass/Utils/commit/6ab505d2d2b3b25f028712d9d5e5a8d0e3795c50))
- **payments-adapter-ctbc-micro-fast-pay:** return error when ctbc cancel or refund in some situations ([94fd39e](https://github.com/Rytass/Utils/commit/94fd39e6e960050ccba0b09aab2f1908c0faa5aa))

## [0.1.15](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.14...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.15) (2025-10-20)

### Features

- **api:** fix ctbc order tigger commit event, refactor ctbc order constructor ([c60e8bf](https://github.com/Rytass/Utils/commit/c60e8bff5797a40538a8e1dda6889e333d2ba06c))
- **api:** refactor ctbc order constructor, add committedAt and refundedAt in constructor of CTBCOrder ([8f744bb](https://github.com/Rytass/Utils/commit/8f744bb4a64a9d0dcd2b06cec24b45bf2fcf8d58))
- **payments-adapter-ctbc-micro-fast-pay:** fix cicd test failed ([7bb8980](https://github.com/Rytass/Utils/commit/7bb898057796186f865021647c8e47982304961d))

## [0.1.14](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.13...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.14) (2025-10-17)

### Features

- **payments-adapter-ctbc-micro-fast-pay:** change ctbc-payments.query function generic type ([bca4dc4](https://github.com/Rytass/Utils/commit/bca4dc47c49495ca455a39adb56da71f6f60efea))
- **payments-adapter-ctbc-micro-fast-pay:** change ctbc-payments.query function generic type and remove useless code ([8f680eb](https://github.com/Rytass/Utils/commit/8f680eb19b46964e99ba021cceb5e187132d8f21))
- **payments-adapter-ctbc-micro-fast-pay:** fix after pr reviewed ([ed43cf5](https://github.com/Rytass/Utils/commit/ed43cf5074dca2817c580f047e083bfc811f906e))
- **payments-adapter-ctbc-micro-fast-pay:** fix ctbc-payment prepare function fail with orderDesc not big 5 ([9bbf8c4](https://github.com/Rytass/Utils/commit/9bbf8c413ba019055234366a2b6faabd133d4b8e))
- **payments-adapter-ctbc-micro-fast-pay:** fix ctbc-payment prepare function fail with orderDesc not big 5, then remove orderDesc directly ([6ba9c52](https://github.com/Rytass/Utils/commit/6ba9c529a6886aea2e988c491e6764ba2a1398d8))

## [0.1.13](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.12...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.13) (2025-09-23)

### Features

- **payments-adapter-ctbc-micro-fast-pay:** fix prepare payments orderDesc length ([feed2fa](https://github.com/Rytass/Utils/commit/feed2fadf1958327a81449415d52f31e09d1d777))

## [0.1.12](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.11...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.12) (2025-09-22)

### Features

- **payments-adapter-ctbc-micro-fast-pay:** fix testing failed ([b93cc3b](https://github.com/Rytass/Utils/commit/b93cc3b5e55886c8988cf766e0dbf3babdd36bc5))
- **payments-adapter-ctbc-micro-fast-pay:** implementation of payments-adapter-ctbc-micro-fast-pay inquiry, refund, cancelRefund for both pos and amex api ([823473c](https://github.com/Rytass/Utils/commit/823473c8a78a4d9758832f83a2e6eb9f3c48964e))
- **payments-adapter-ctbc-micro-fast-pay:** improve code coverages ([de6e5c1](https://github.com/Rytass/Utils/commit/de6e5c126a33884dfc5da2980bff67acb8a0f0b6))

## [0.1.11](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.10...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.11) (2025-09-15)

### Bug Fixes

- resolve all security vulnerabilities detected by GitHub audit ([0fcdf72](https://github.com/Rytass/Utils/commit/0fcdf72a8a4b1708c09ab0124dfc44e0ea781f2f))

## [0.1.10](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.9...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.10) (2025-09-11)

### Features

- migrate to Nx project-based configuration ([c2d9ca4](https://github.com/Rytass/Utils/commit/c2d9ca46c00ace42bcbf69300dcc43a7346cb9aa))

### Tests

- migrate to standardized test structure ([b7dc99e](https://github.com/Rytass/Utils/commit/b7dc99ef85f5951480dfdae6198cefa252c15423))

### BREAKING CHANGES

- Test directory structure changed from **test** to **tests**

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.1.9](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.8...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.9) (2025-09-09)

### Bug Fixes

- **invoice-adapter-amego:** love code issue ([e4be5e3](https://github.com/Rytass/Utils/commit/e4be5e33facd00062f7956a4e82854dc9411fc7e))
- **payments-ctbc:** resolve @typescript-eslint/no-explicit-any errors in CTBC payment adapter ([b4515dc](https://github.com/Rytass/Utils/commit/b4515dc0226f9c3539ba3fad58078a5c0983d03f))
- **wms-map-react-components:** resolve TypeScript compilation errors ([5d7ba43](https://github.com/Rytass/Utils/commit/5d7ba43e430a507ed2b443287c97fb886cf83bd3))

### Features

- add test:coverage script to all packages ([f73bce5](https://github.com/Rytass/Utils/commit/f73bce52024d453755824fa6af784f13da50061f))
- **payments-adapter-ctbc-micro-fast-pay:** add ctbc payments failed error with orderId ([52f42d2](https://github.com/Rytass/Utils/commit/52f42d20efcf9c92b9f41b2dbdcdeb319399a792))
- upgrade file-type from v16.5.4 to v21.0.0 ([eb8217b](https://github.com/Rytass/Utils/commit/eb8217b76c4a0d74061f782c082fd4183961bb12))

### BREAKING CHANGES

- file-type v21 is ESM-only, requires Node.js 18+

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.1.8](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.7...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.8) (2025-08-28)

### Features

- **payments-adapter-ctbc-micro-fast-pay:** finish pos api query order, refund, cancelRefund, waiting for implementation of amex ([04717d3](https://github.com/Rytass/Utils/commit/04717d31a4199f7380af3a12e51fb0b3b9dcf35c))
- **payments-adapter-ctbc-micro-fast-pay:** remove nest js library used and refactor testing codes ([742c4b9](https://github.com/Rytass/Utils/commit/742c4b9da185b5d818cdb6699a2574c1bd4e01f3))

## [0.1.7](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.6...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.7) (2025-08-19)

**Note:** Version bump only for package @rytass/payments-adapter-ctbc-micro-fast-pay

## [0.1.6](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.5...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.6) (2025-08-04)

**Note:** Version bump only for package @rytass/payments-adapter-ctbc-micro-fast-pay

## [0.1.5](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.4...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.5) (2025-07-30)

### Features

- **payments-adapter-ctbc-micro-fast-pay:** handld ctbc order.commit CardNumber not exist when amex ([af9e98f](https://github.com/Rytass/Utils/commit/af9e98fcd8eef26928c2063474b45a2ffd7c43d7))

## [0.1.4](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.3...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.4) (2025-07-30)

### Bug Fixes

- **payments-adapter-ctbc-micro-fast-pay:** add amex callbackPath check Amex credit card success ([029084b](https://github.com/Rytass/Utils/commit/029084b4ded62e6ee13f76c4229afb598f9af899))
- **payments-adapter-ctbc-micro-fast-pay:** ctbc order add cardType ([5129658](https://github.com/Rytass/Utils/commit/512965856822c7a9e2d0ee23759d3d535ed65b4e))

## [0.1.3](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.2...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.3) (2025-07-29)

### Features

- **payments-adapter-ctbc-micro-fast-pay:** export handleCallbackTextBodyByURLPath ([bb64d00](https://github.com/Rytass/Utils/commit/bb64d00b4290d1f24175fb4a69167c95e52ba0e0))

## [0.1.2](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.1...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.2) (2025-07-29)

### Bug Fixes

- **payments-adapter-ctbc-micro-fast-pay:** Order Desc cannot include space char ([73e6ba6](https://github.com/Rytass/Utils/commit/73e6ba6b953a4cbc2be568e8e0a333df7c7d051e))

## [0.1.1](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.0...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.1) (2025-07-28)

### Features

- **payments-adapter-ctbc-micro-fast-pay:** support one time checkout ([04088a0](https://github.com/Rytass/Utils/commit/04088a0d119b617ee19918539ad05c31565bd427))

# [0.1.0](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.0.8...@rytass/payments-adapter-ctbc-micro-fast-pay@0.1.0) (2025-07-28)

### Bug Fixes

- **payments-adapter-ctbc-micro-fast-pay:** package.json dependencies on ngrok ([4aa3606](https://github.com/Rytass/Utils/commit/4aa3606e63244daadfc9a669afa7d1654c693437))

## [0.0.8](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.0.7...@rytass/payments-adapter-ctbc-micro-fast-pay@0.0.8) (2025-07-24)

### Bug Fixes

- **payments-adapter-ctbc-micro-fast-pay:** align success status code and error handling with CTBC spec ([e8c4c7a](https://github.com/Rytass/Utils/commit/e8c4c7adb65471af83250b7e378912d92a535a57))
- **payments-adapter-ctbc-micro-fast-pay:** update success status code check in bind card callback ([b663c39](https://github.com/Rytass/Utils/commit/b663c39294edd9a5072f0360e5bcaf3c2bec934b))

## [0.0.7](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.0.6...@rytass/payments-adapter-ctbc-micro-fast-pay@0.0.7) (2025-07-11)

**Note:** Version bump only for package @rytass/payments-adapter-ctbc-micro-fast-pay

## [0.0.6](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.0.5...@rytass/payments-adapter-ctbc-micro-fast-pay@0.0.6) (2025-07-10)

### Bug Fixes

- **payments-adapter-ctbc-micro-fast-pay:** guard against missing CardNoMask in payloads ([a48d212](https://github.com/Rytass/Utils/commit/a48d21228271b7c16ccf336dc9d5acfc5ede50c2))

### Features

- **payments-adapter-ctbc-micro-fast-pay:** support non-strict bind card callback with mismatch warning ([5d3f54e](https://github.com/Rytass/Utils/commit/5d3f54ec9bb7e2c1eac47ae3028eb7cad2d3d3d9))

## [0.0.5](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.0.4...@rytass/payments-adapter-ctbc-micro-fast-pay@0.0.5) (2025-07-08)

### Bug Fixes

- **payments-adapter-ctbc-micro-fast-pay:** ensure TXN_DATA sorting uses strict ASCII order ([02d2699](https://github.com/Rytass/Utils/commit/02d2699c6bf58d616d85b11f5e7bd24778b9002c))
- **payments-adapter-ctbc-micro-fast-pay:** remove redundant double decodeURIComponent for response payload ([00fe516](https://github.com/Rytass/Utils/commit/00fe5166f1f199547da9fbb06541270268e0a262))

### Features

- **payments-adapter-ctbc-micro-fast-pay:** cache bind card request instances by RequestNo ([a7bf7f9](https://github.com/Rytass/Utils/commit/a7bf7f9845db1a9584ae92ac4693817e51cc7445))

## [0.0.4](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.0.3...@rytass/payments-adapter-ctbc-micro-fast-pay@0.0.4) (2025-07-01)

### Bug Fixes

- **payments-adapter-ctbc-micro-fast-pay:** correct double-encoded payload decoding in decodeResponsePayload ([841a1d1](https://github.com/Rytass/Utils/commit/841a1d1f8c9ad603799791f7918ae2421181bb15))

## [0.0.3](https://github.com/Rytass/Utils/compare/@rytass/payments-adapter-ctbc-micro-fast-pay@0.0.2...@rytass/payments-adapter-ctbc-micro-fast-pay@0.0.3) (2025-07-01)

### Bug Fixes

- **payments-adapter-ctbc-micro-fast-pay:** align formHTML with CTBC bind card auto-submit format ([40a6a38](https://github.com/Rytass/Utils/commit/40a6a38d0927a128b92d660535c7e66511aec53b))

### Features

- **payments-adapter-ctbc-micro-fast-pay:** distinguish between MerchantID and MerID in constructor ([7a54638](https://github.com/Rytass/Utils/commit/7a54638762c38abfb9f72b59502bcce47f0b1011))

## 0.0.2 (2025-06-28)

### Features

- **payments-adapter-ctbc-micro-fast-pay:** add optional MAC validation to decodeResponsePayload for safety by default ([05bb6c1](https://github.com/Rytass/Utils/commit/05bb6c1a7346354692c7530e8a909d654119038f))
- **payments-adapter-ctbc-micro-fast-pay:** implement bind card request flow with encrypted form and callback handler ([5ebafc4](https://github.com/Rytass/Utils/commit/5ebafc454f9b4bbab5680a2820276785e12ba63e))
- **payments-adapter-ctbc-micro-fast-pay:** implement PayJSON commit flow for CTBC adapter ([77387f1](https://github.com/Rytass/Utils/commit/77387f1aa3e674c14b157898c864fbd4484be567))
- **payments-adapter-ctbc-micro-fast-pay:** make 3DES IV overrideable via setIV() ([16b829a](https://github.com/Rytass/Utils/commit/16b829a5693c9daf6722d4c83004b692095b3da4))
