# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.0.24](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.23...@rytass/order-builder@0.0.24) (2025-09-11)

### Features

- migrate to Nx project-based configuration ([c2d9ca4](https://github.com/Rytass/Utils/commit/c2d9ca46c00ace42bcbf69300dcc43a7346cb9aa))

### Tests

- migrate to standardized test structure ([b7dc99e](https://github.com/Rytass/Utils/commit/b7dc99ef85f5951480dfdae6198cefa252c15423))

### BREAKING CHANGES

- Test directory structure changed from **test** to **tests**

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.0.23](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.22...@rytass/order-builder@0.0.23) (2025-09-09)

### Bug Fixes

- **order-builder:** resolve ESLint no-explicit-any violations ([757d443](https://github.com/Rytass/Utils/commit/757d4433253d5cd270ff2f738d1f3bfb3f6c6b40))
- **order-builder:** restore polymorphic type compatibility ([a60061a](https://github.com/Rytass/Utils/commit/a60061a429729af2ceb1f2ccefac9c5a395e930d))
- **wms-map-react-components:** resolve TypeScript compilation errors ([5d7ba43](https://github.com/Rytass/Utils/commit/5d7ba43e430a507ed2b443287c97fb886cf83bd3))

### Features

- add test:coverage script to all packages ([f73bce5](https://github.com/Rytass/Utils/commit/f73bce52024d453755824fa6af784f13da50061f))
- upgrade file-type from v16.5.4 to v21.0.0 ([eb8217b](https://github.com/Rytass/Utils/commit/eb8217b76c4a0d74061f782c082fd4183961bb12))

### BREAKING CHANGES

- file-type v21 is ESM-only, requires Node.js 18+

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.0.22](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.21...@rytass/order-builder@0.0.22) (2025-08-19)

**Note:** Version bump only for package @rytass/order-builder

## [0.0.21](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.20...@rytass/order-builder@0.0.21) (2023-06-05)

**Note:** Version bump only for package @rytass/order-builder

## [0.0.20](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.19...@rytass/order-builder@0.0.20) (2023-01-27)

### Features

- **order-builder:** add `StepItemGiveawayDiscount` Policy ([0116e94](https://github.com/Rytass/Utils/commit/0116e94a9652f479e6998b41927e4313b0de843a))

## [0.0.19](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.18...@rytass/order-builder@0.0.19) (2023-01-02)

### Bug Fixes

- **order-builder:** fixed `StepValueDiscount` valid maximum value ([1f5ca37](https://github.com/Rytass/Utils/commit/1f5ca3721eb3aae7ca9974562e0e0ed246232288))
- **order-builder:** fixed `ValueDiscount` valid maximum value ([25774a6](https://github.com/Rytass/Utils/commit/25774a6f7889c5c7c4019f13122ef57a41ea06b5))

## [0.0.18](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.17...@rytass/order-builder@0.0.18) (2022-10-17)

### Bug Fixes

- **order-builder:** resolved [#25](https://github.com/Rytass/Utils/issues/25) ([69ea30c](https://github.com/Rytass/Utils/commit/69ea30c50d55b556d74372f27915aaf9c2764b97))
- **order-builder:** resolved [#26](https://github.com/Rytass/Utils/issues/26) ([c859731](https://github.com/Rytass/Utils/commit/c859731b171f89b4d90d1fd88ef31e3befb7675a))

### Features

- **order-builder:** resolved [#27](https://github.com/Rytass/Utils/issues/27) ([dae89bb](https://github.com/Rytass/Utils/commit/dae89bbaf9f1adfffce445c4e19f23b0ef975538))

## [0.0.17](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.16...@rytass/order-builder@0.0.17) (2022-10-06)

### Features

- **order-builder:** add `isMatchedItem` resolver in `ItemIncluded`, `ItemExcluded` overload ([7dcdf05](https://github.com/Rytass/Utils/commit/7dcdf05cfbf482682551ac183b16a4c5c3292f4e))
- **order-builder:** export interface of `Order` ([f6235d8](https://github.com/Rytass/Utils/commit/f6235d823236edb2fcfbbdc0b5d3dc3ec9a2e26d))

## [0.0.16](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.15...@rytass/order-builder@0.0.16) (2022-10-05)

**Note:** Version bump only for package @rytass/order-builder

## [0.0.15](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.14...@rytass/order-builder@0.0.15) (2022-10-03)

### Features

- **order-builder:** add `clone` method to `OrderBuilder` ([0e23741](https://github.com/Rytass/Utils/commit/0e23741a23bbbefe22384582ed72ced961ddebf6))
- **order-builder:** add `OrderCalculateSubject` in `Order` ([4b9ae6b](https://github.com/Rytass/Utils/commit/4b9ae6be26e293668b8004235801f3399fdd5271))
- **order-builder:** make `OrderItemManager` being interface ([164ff1f](https://github.com/Rytass/Utils/commit/164ff1f2c36beae253caf0ef3bbad3412a8984c6))
- **order-builder:** resolved [#20](https://github.com/Rytass/Utils/issues/20) ([a72250b](https://github.com/Rytass/Utils/commit/a72250b79d8cd434e74f34f83976aafbdd5081a5))

## [0.0.14](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.13...@rytass/order-builder@0.0.14) (2022-09-19)

### Features

- **order-builder:** add `ItemExcluded` Condition and `Logistics` logic ([6570dab](https://github.com/Rytass/Utils/commit/6570dab15c29ae3d7195ba7b204d41d59d8abc29))

## [0.0.13](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.12...@rytass/order-builder@0.0.13) (2022-09-12)

### Bug Fixes

- **packages/order-builder:** append omitted modification ([70375f2](https://github.com/Rytass/Utils/commit/70375f24ce4676aa165407a96a79e759970afaed))

### Features

- **packages/order-builder:** fixed `stack-overflow` problem on using spread syntax ([9016f88](https://github.com/Rytass/Utils/commit/9016f885847456358aacaf5f14379cebd9b2f438))

## [0.0.12](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.11...@rytass/order-builder@0.0.12) (2022-07-04)

**Note:** Version bump only for package @rytass/order-builder

## [0.0.11](https://github.com/Rytass/Utils/compare/@rytass/order-builder@0.0.10...@rytass/order-builder@0.0.11) (2022-07-04)

**Note:** Version bump only for package @rytass/order-builder

## 0.0.10 (2022-06-17)

### Bug Fixes

- **order-builder:** fixed sub-constraint-matched-items logic ([72349ce](https://github.com/Rytass/Utils/commit/72349ce31dcf34c68b53c356f992ae4ba1ef6fa5))

## 0.0.9 (2022-06-07)

### Features

- **order-builder:** `OrderBuilder` v0.0.2 issues ([6c26b03](https://github.com/Rytass/Utils/commit/6c26b039c35eec50acff7edc522b60ef42ba36e1))

## 0.0.8 (2022-05-22)

### Features

- **order-builder:** add `OrderBuilder` package v0.0.1 ([ed40e1e](https://github.com/Rytass/Utils/commit/ed40e1e9ab431304c937c6edfe03bfd620cea89d))

## [0.0.9](https://github.com/Rytass/Utils/compare/v0.0.8...v0.0.9) (2022-06-07)

### Features

- **order-builder:** `OrderBuilder` v0.0.2 issues ([6c26b03](https://github.com/Rytass/Utils/commit/6c26b039c35eec50acff7edc522b60ef42ba36e1))

## [0.0.8](https://github.com/Rytass/Utils/compare/v0.0.7...v0.0.8) (2022-05-22)

### Features

- **order-builder:** add `OrderBuilder` package v0.0.1 ([ed40e1e](https://github.com/Rytass/Utils/commit/ed40e1e9ab431304c937c6edfe03bfd620cea89d))
