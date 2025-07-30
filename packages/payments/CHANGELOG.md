# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.2.2](https://github.com/Rytass/Utils/compare/@rytass/payments@0.2.1...@rytass/payments@0.2.2) (2025-07-30)

### Bug Fixes

- **payments-adapter-ctbc-micro-fast-pay:** ctbc order add cardType ([5129658](https://github.com/Rytass/Utils/commit/512965856822c7a9e2d0ee23759d3d535ed65b4e))

## [0.2.1](https://github.com/Rytass/Utils/compare/@rytass/payments@0.2.0...@rytass/payments@0.2.1) (2025-07-28)

### Features

- **payments-adapter-ctbc-micro-fast-pay:** support one time checkout ([04088a0](https://github.com/Rytass/Utils/commit/04088a0d119b617ee19918539ad05c31565bd427))

# [0.2.0](https://github.com/Rytass/Utils/compare/@rytass/payments@0.1.6...@rytass/payments@0.2.0) (2025-07-28)

**Note:** Version bump only for package @rytass/payments

## [0.1.6](https://github.com/Rytass/Utils/compare/@rytass/payments@0.1.5...@rytass/payments@0.1.6) (2025-06-28)

**Note:** Version bump only for package @rytass/payments

## [0.1.5](https://github.com/Rytass/Utils/compare/@rytass/payments@0.1.4...@rytass/payments@0.1.5) (2025-06-25)

### Features

- **payments-nestjs-module:** initial package ([44fa096](https://github.com/Rytass/Utils/commit/44fa09616c6336d521f3752d27e47cff70b0fc89))

## [0.1.4](https://github.com/Rytass/Utils/compare/@rytass/payments@0.1.3...@rytass/payments@0.1.4) (2024-11-09)

### Features

- **payments-adapter-icash-pay:** split commit phase ([d50460a](https://github.com/Rytass/Utils/commit/d50460a9d8fc5072ff643b24c832f9c1efa0562f))

## [0.1.3](https://github.com/Rytass/Utils/compare/@rytass/payments@0.1.2...@rytass/payments@0.1.3) (2024-10-07)

### Features

- **payments-adapter-happy-card:** new payment adapter happy card ([db76873](https://github.com/Rytass/Utils/commit/db76873e47a9ad44dbea02d19a0d1126fb2570c5))

## [0.1.2](https://github.com/Rytass/Utils/compare/@rytass/payments@0.1.1...@rytass/payments@0.1.2) (2023-11-25)

### Features

- **payments-adapter-ecpay:** add bind card api ([1d94305](https://github.com/Rytass/Utils/commit/1d943059ea5a92167b0c46a91a871506749d5404))

## [0.1.1](https://github.com/Rytass/Utils/compare/@rytass/payments@0.1.0...@rytass/payments@0.1.1) (2023-10-12)

**Note:** Version bump only for package @rytass/payments

# [0.1.0](https://github.com/Rytass/Utils/compare/@rytass/payments@0.0.16...@rytass/payments@0.1.0) (2023-08-12)

### Features

- **payments:** change order cache mode to async, thus prepare method be Promise ([da86d7c](https://github.com/Rytass/Utils/commit/da86d7cf414e11945144c9f104ad59660840c3f5))

## [0.0.16](https://github.com/Rytass/Utils/compare/@rytass/payments@0.0.15...@rytass/payments@0.0.16) (2023-03-21)

### Features

- **payments-adapter-hwanan:** add basic payment gateway without implements ([439a77a](https://github.com/Rytass/Utils/commit/439a77a2c639ff31f71918b59c3a1f05c8f4e058))

## [0.0.15](https://github.com/Rytass/Utils/compare/@rytass/payments@0.0.14...@rytass/payments@0.0.15) (2023-02-02)

### Features

- **payments-adapter-newebpay:** add newebpay adapter for CREDIT/VACC/WEBATM ([b6cf908](https://github.com/Rytass/Utils/commit/b6cf9086990b662253907fcb93601c3c7116a077))
- **payments-adapter-newebpay:** query order in CREDIT ([655aaac](https://github.com/Rytass/Utils/commit/655aaac8d52beb8ec3edd79c576f3b9a75017172))

## [0.0.14](https://github.com/Rytass/Utils/compare/@rytass/payments@0.0.13...@rytass/payments@0.0.14) (2023-01-27)

### Features

- **payments-adapter-ecpay:** refund with emulator ([e40449e](https://github.com/Rytass/Utils/commit/e40449e82b1acb8178f2cf2478d14ccc9a2598db))
- **payments-adapter-ecpay:** resolve queried order item and use custom fields to store unit price ([e37055b](https://github.com/Rytass/Utils/commit/e37055b00ae0ab7aff747e070382fab8188dc463))

## [0.0.13](https://github.com/Rytass/Utils/compare/@rytass/payments@0.0.12...@rytass/payments@0.0.13) (2022-07-04)

**Note:** Version bump only for package @rytass/payments

## [0.0.12](https://github.com/Rytass/Utils/compare/@rytass/payments@0.0.11...@rytass/payments@0.0.12) (2022-07-01)

### Features

- **payments-adapter-ecpay:** add channel on additionalInfo and asyncInformations for type infer ([e6ff2ac](https://github.com/Rytass/Utils/commit/e6ff2ac0200dfc201e03d01d3ea2e37717d31bd4))

## [0.0.11](https://github.com/Rytass/Utils/compare/@rytass/payments@0.0.10...@rytass/payments@0.0.11) (2022-06-30)

### Features

- **payments-adapter-ecpay:** add onInfoRetrieved listener for payment gateway ([0277dc7](https://github.com/Rytass/Utils/commit/0277dc72f1c14bc7112f8040ff3fb79708e2eaac))

## 0.0.10 (2022-06-17)

### Features

- **payment-adapter-ecpay:** add apple pay channel ([981d129](https://github.com/Rytass/Utils/commit/981d129afb6a55b40f4d24deb2c3969993415571))
- **payments-adapter-ecpay:** add async informations endpoint and async payment results update ([5d8f365](https://github.com/Rytass/Utils/commit/5d8f3652e7dc1a7f02853a4fc59f307f4e0c7925))
- **payments-adapter-ecpay:** add barcode channel ([b05cd9c](https://github.com/Rytass/Utils/commit/b05cd9c3fa1e74ecab32d11e2287a0002a9ef822))
- **payments-adapter-ecpay:** add CVS checkout channel ([485ed86](https://github.com/Rytass/Utils/commit/485ed8680253405cf0c103d65ed4e0cc6c4fca9a))

## 0.0.9 (2022-06-07)

## 0.0.8 (2022-05-22)

## 0.0.7 (2022-05-02)

## 0.0.6 (2022-04-21)

## 0.0.5 (2022-04-21)

### Features

- **payments:** callback handler for ECPayPayment virtual account order ([e14a039](https://github.com/Rytass/Utils/commit/e14a03960d6177f25db485fee2e693365bf3b524))

## 0.0.4 (2022-04-20)

### Features

- **payments:** add ECPayPayment query method implements ([64b0346](https://github.com/Rytass/Utils/commit/64b03465c814b9f996e28dfe4611d297bcbd7d99))
- **payments:** add installments, period features on ECPayPayment ([a765657](https://github.com/Rytass/Utils/commit/a76565723b46687cff65ebe49efc2eb57d3dee77))
- **payments:** add onServerListen options, optimize test case for async tasks ([893b5b6](https://github.com/Rytass/Utils/commit/893b5b6e8319aadcfedf2c16c78e09636ece173c))

## 0.0.3 (2022-04-18)

## 0.0.2 (2022-04-18)

## 0.0.1 (2022-04-18)

### Features

- **payments:** add ecpay payment credit commit flow ([9e7c684](https://github.com/Rytass/Utils/commit/9e7c684db25166c3a404f180e24e72d03b4515ac))

## [0.0.9](https://github.com/Rytass/Utils/compare/v0.0.8...v0.0.9) (2022-06-07)

**Note:** Version bump only for package @rytass/payments

## [0.0.8](https://github.com/Rytass/Utils/compare/v0.0.7...v0.0.8) (2022-05-22)

**Note:** Version bump only for package @rytass/payments

## [0.0.7](https://github.com/Rytass/Utils/compare/v0.0.6...v0.0.7) (2022-05-02)

**Note:** Version bump only for package @rytass/payments

## [0.0.6](https://github.com/Rytass/Utils/compare/v0.0.5...v0.0.6) (2022-04-21)

**Note:** Version bump only for package @rytass/payments

## [0.0.5](https://github.com/Rytass/Utils/compare/v0.0.4...v0.0.5) (2022-04-21)

### Features

- **payments:** callback handler for ECPayPayment virtual account order ([e14a039](https://github.com/Rytass/Utils/commit/e14a03960d6177f25db485fee2e693365bf3b524))

## [0.0.4](https://github.com/Rytass/Utils/compare/v0.0.3...v0.0.4) (2022-04-20)

### Features

- **payments:** add ECPayPayment query method implements ([64b0346](https://github.com/Rytass/Utils/commit/64b03465c814b9f996e28dfe4611d297bcbd7d99))
- **payments:** add installments, period features on ECPayPayment ([a765657](https://github.com/Rytass/Utils/commit/a76565723b46687cff65ebe49efc2eb57d3dee77))
- **payments:** add onServerListen options, optimize test case for async tasks ([893b5b6](https://github.com/Rytass/Utils/commit/893b5b6e8319aadcfedf2c16c78e09636ece173c))

## [0.0.3](https://github.com/Rytass/Utils/compare/v0.0.2...v0.0.3) (2022-04-18)

**Note:** Version bump only for package @rytass/payments

## [0.0.2](https://github.com/Rytass/Utils/compare/v0.0.1...v0.0.2) (2022-04-18)

**Note:** Version bump only for package @rytass/payments

## 0.0.1 (2022-04-18)

### Features

- **payments:** add ecpay payment credit commit flow ([9e7c684](https://github.com/Rytass/Utils/commit/9e7c684db25166c3a404f180e24e72d03b4515ac))
