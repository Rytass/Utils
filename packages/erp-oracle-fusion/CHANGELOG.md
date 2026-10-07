# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.3.1](https://github.com/Rytass/Utils/compare/@rytass/erp-oracle-fusion@0.3.0...@rytass/erp-oracle-fusion@0.3.1) (2026-10-07)

### Bug Fixes

- **erp-oracle-fusion:** send ESS job definition ids as absolute paths ([4e320c3](https://github.com/Rytass/Utils/commit/4e320c3ff05bed046a66808f6c08032ffdb2a0a2))

# [0.3.0](https://github.com/Rytass/Utils/compare/@rytass/erp-oracle-fusion@0.2.0...@rytass/erp-oracle-fusion@0.3.0) (2026-10-06)

### Bug Fixes

- **erp-oracle-fusion:** bound decompressed size while reading archives ([cf68789](https://github.com/Rytass/Utils/commit/cf68789b2d1e319230978bca72e47d0e8c56f146))
- **erp-oracle-fusion:** reject values that would corrupt ESS parameters or period queries ([20b2776](https://github.com/Rytass/Utils/commit/20b27760c763f094b23196498d6246688ed5ea2d))
- **erp-oracle-fusion:** stop ESS log reads from hiding partial failures ([70d8e8e](https://github.com/Rytass/Utils/commit/70d8e8edeb677a089f985972c72259d43ee817f2))
- **erp-oracle-fusion:** stop whitespace operators slipping into period queries ([c787c85](https://github.com/Rytass/Utils/commit/c787c8549a5685707ad0460a63f874619fab946a))

### Features

- **erp-oracle-fusion:** add accounting period status lookup ([4931de8](https://github.com/Rytass/Utils/commit/4931de8cdcf1975e3301c9c475c23ad7cd82c3ae))
- **erp-oracle-fusion:** add the ESS scheduler REST channel ([fa3a9f9](https://github.com/Rytass/Utils/commit/fa3a9f980429239df56f94a6b339af703981f4a2))
- **erp-oracle-fusion:** raise a validation error when Fusion rejects a submission ([e656e1f](https://github.com/Rytass/Utils/commit/e656e1fd5e8240039daca7f9d87fc3631ed50468))
- **erp-oracle-fusion:** share one token cache across clients ([34a7450](https://github.com/Rytass/Utils/commit/34a7450c9337e59cba7dcae2b506e3abbeb9fcca))
- **erp-oracle-fusion:** unwrap MTOM SOAP responses ([8e88ec3](https://github.com/Rytass/Utils/commit/8e88ec358f9eb4a33a55b8985b9565ebfc0f0e6a))

# 0.2.0 (2026-08-17)

### Features

- **erp-oracle-fusion:** add Oracle Fusion Cloud ERP client and FBDI toolkit ([93ab2c0](https://github.com/Rytass/Utils/commit/93ab2c0a2dae7e580b9469e22edce62f345088ac))
- **erp-oracle-fusion:** add SOAP client with customer account and credit profile services ([bdcb028](https://github.com/Rytass/Utils/commit/bdcb0288285d647a5b663dec23e77311e511f788))
