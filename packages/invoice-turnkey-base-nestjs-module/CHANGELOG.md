# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.1.3](https://github.com/Rytass/Utils/compare/@rytass/invoice-turnkey-base-nestjs-module@0.1.2...@rytass/invoice-turnkey-base-nestjs-module@0.1.3) (2026-10-22)

### Bug Fixes

- **invoice-turnkey-base-nestjs-module:** require a seller address for storage invoices and allowances too ([baea6e9](https://github.com/Rytass/Utils/commit/baea6e990b6977f25d5387c8c5f868d70a39d5eb))
- **invoice-turnkey-base-nestjs-module:** scope latest submissions by message type and index the lookup ([b8c3cc7](https://github.com/Rytass/Utils/commit/b8c3cc769784bfe3daa9f97a659092ffb50a8cf6))

### Features

- **invoice-turnkey-base-nestjs-module:** add list methods for tracks, invoices and allowances ([b65aeb3](https://github.com/Rytass/Utils/commit/b65aeb3aec4874eeba6f86e9850d6bce0b3a3970))

## [0.1.2](https://github.com/Rytass/Utils/compare/@rytass/invoice-turnkey-base-nestjs-module@0.1.1...@rytass/invoice-turnkey-base-nestjs-module@0.1.2) (2026-10-22)

### Bug Fixes

- **invoice-turnkey-base-nestjs-module:** store a received A0302 as rejection acknowledged ([185dae3](https://github.com/Rytass/Utils/commit/185dae3d7700a050cf670889841d235842aa4266))

### Features

- **invoice-turnkey-base-nestjs-module:** raise NUMBER_OUT_OF_TRACK when abandoning an unknown number ([502e169](https://github.com/Rytass/Utils/commit/502e169d65fc3b6f3e78d6587d06163a25326d7c))
- **invoice-turnkey-base-nestjs-module:** require a seller address for exchange invoices and allowances ([e675c34](https://github.com/Rytass/Utils/commit/e675c348931b5683ed63a4ffbad33d3e338e9601))

## 0.1.1 (2026-10-21)

### Bug Fixes

- **invoice-turnkey-base-nestjs-module:** add discardPrint to undo a print log after a failed render ([82611d0](https://github.com/Rytass/Utils/commit/82611d0ade83addc7172bb36d05295ea932b39d9))
- **invoice-turnkey-base-nestjs-module:** bind inbound replies to the counterparty tax id ([a8b9484](https://github.com/Rytass/Utils/commit/a8b948469c44c5815f3e9e167a220ce3288ad1bd))
- **invoice-turnkey-base-nestjs-module:** cap cumulative allowance quantity per invoice item ([fd9466c](https://github.com/Rytass/Utils/commit/fd9466c1205a4cd4c39946c5cefa34fe6abc14ea))
- **invoice-turnkey-base-nestjs-module:** drop characters XML 1.0 forbids from MIG documents ([fac5ee8](https://github.com/Rytass/Utils/commit/fac5ee81c25e49eb6bf667f6eed2acc9701ec99c))
- **invoice-turnkey-base-nestjs-module:** harden company, event, idempotency and received list edge cases ([6975319](https://github.com/Rytass/Utils/commit/697531964eff576c67ea51da7a259c559552e4bb))
- **invoice-turnkey-base-nestjs-module:** isolate worker steps and release lock runner on failure ([3315aac](https://github.com/Rytass/Utils/commit/3315aac736fabc951e944cc9940964580e50fc7f))
- **invoice-turnkey-base-nestjs-module:** keep inbound scan going when archiving a file fails ([574ea78](https://github.com/Rytass/Utils/commit/574ea78cb65ac882e1c818bd4181f57c04334830))
- **invoice-turnkey-base-nestjs-module:** key received documents by seller and document date ([16bbcaf](https://github.com/Rytass/Utils/commit/16bbcaf573d86544f04d218fb41c2f985f97655a))
- **invoice-turnkey-base-nestjs-module:** narrow bwip-js raw symbol to bar widths ([e74c17a](https://github.com/Rytass/Utils/commit/e74c17ae6f32dbac85d0e09ed035c292758b6ec2))
- **invoice-turnkey-base-nestjs-module:** reject truncated GCM auth tags in sealed secrets ([258616e](https://github.com/Rytass/Utils/commit/258616e78c06ecbde74528926569224a2dd4d7fc))
- **invoice-turnkey-base-nestjs-module:** reopen received document when the platform rejects a reply ([03ac527](https://github.com/Rytass/Utils/commit/03ac5273852fc52476d315a1c89f688a18209c78))
- **invoice-turnkey-base-nestjs-module:** report overlapping track ranges as INVALID_TRACK ([1cb42aa](https://github.com/Rytass/Utils/commit/1cb42aa517b6c94f4af41df626ba6200fe31d117))
- **invoice-turnkey-base-nestjs-module:** retry early buyer replies and isolate unreadable inbound files ([b3f0ce6](https://github.com/Rytass/Utils/commit/b3f0ce62f0d249d79774a53e858d138548f795d6))
- **invoice-turnkey-base-nestjs-module:** run daily reconciliation and recheck the worker lock ([506fa67](https://github.com/Rytass/Utils/commit/506fa676256803cea0068b9c6e39a7b10aed0753))
- **invoice-turnkey-base-nestjs-module:** strip control characters from ESC/POS text ([05fed2a](https://github.com/Rytass/Utils/commit/05fed2a572c0d6c036f6c8f9c14c74f9d2068e81))

### Features

- **invoice-turnkey-base-nestjs-module:** add turnkey e-invoice core module ([6b784a0](https://github.com/Rytass/Utils/commit/6b784a08f6cf221041d8d3ffa483db01e5f3365b))
- **invoice-turnkey-base-nestjs-module:** list submissions of one document ([d2198ac](https://github.com/Rytass/Utils/commit/d2198ac4240a269a3087d97c3a41fa46986920d6))
- **invoice-turnkey-base-nestjs-module:** resolve WRITTEN submissions manually ([9cf375d](https://github.com/Rytass/Utils/commit/9cf375dd6d8ddaece57292d0c33d62bb699ac9ed))
- **invoice-turnkey-base-nestjs-module:** validate company registration and add describe() ([49d0fba](https://github.com/Rytass/Utils/commit/49d0fba09b979c88ae76a9855e6a761b53d5744c))
