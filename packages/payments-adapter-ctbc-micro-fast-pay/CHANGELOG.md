# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
