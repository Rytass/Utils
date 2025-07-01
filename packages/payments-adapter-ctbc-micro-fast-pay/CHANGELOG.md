# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
