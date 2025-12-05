# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.2.5](https://github.com/Rytass/Utils/compare/@rytass/storages@0.2.4...@rytass/storages@0.2.5) (2025-12-05)

**Note:** Version bump only for package @rytass/storages

## [0.2.4](https://github.com/Rytass/Utils/compare/@rytass/storages@0.2.3...@rytass/storages@0.2.4) (2025-09-11)

### Features

- migrate to Nx project-based configuration ([c2d9ca4](https://github.com/Rytass/Utils/commit/c2d9ca46c00ace42bcbf69300dcc43a7346cb9aa))

### Tests

- migrate to standardized test structure ([b7dc99e](https://github.com/Rytass/Utils/commit/b7dc99ef85f5951480dfdae6198cefa252c15423))

### BREAKING CHANGES

- Test directory structure changed from **test** to **tests**

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.2.3](https://github.com/Rytass/Utils/compare/@rytass/storages@0.2.2...@rytass/storages@0.2.3) (2025-09-09)

### Bug Fixes

- downgrade file-type to v16.5.4 for compatibility ([ff99d49](https://github.com/Rytass/Utils/commit/ff99d491f581cbba91fb692d0846f1dd4cbe1958))
- resolve workspace-level yarn test/build errors ([5977670](https://github.com/Rytass/Utils/commit/597767019b79691cb373d34df089369b585e64fb))

### Features

- add test:coverage script to all packages ([f73bce5](https://github.com/Rytass/Utils/commit/f73bce52024d453755824fa6af784f13da50061f))
- upgrade file-type from v16.5.4 to v21.0.0 ([eb8217b](https://github.com/Rytass/Utils/commit/eb8217b76c4a0d74061f782c082fd4183961bb12))

### BREAKING CHANGES

- file-type v21 is ESM-only, requires Node.js 18+

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.2.2](https://github.com/Rytass/Utils/compare/@rytass/storages@0.2.1...@rytass/storages@0.2.2) (2025-08-19)

**Note:** Version bump only for package @rytass/storages

## [0.2.1](https://github.com/Rytass/Utils/compare/@rytass/storages@0.2.0...@rytass/storages@0.2.1) (2024-11-29)

**Note:** Version bump only for package @rytass/storages

# [0.2.0](https://github.com/Rytass/Utils/compare/@rytass/storages@0.1.4...@rytass/storages@0.2.0) (2023-02-27)

### Features

- **storages:** auto detect mime for content type ([4c8a951](https://github.com/Rytass/Utils/commit/4c8a9515a1852d8431a6e9e1345d79b3e652de0c))

## [0.1.4](https://github.com/Rytass/Utils/compare/@rytass/storages@0.1.3...@rytass/storages@0.1.4) (2023-02-26)

### Bug Fixes

- **storages:** stream filename resolve issue ([ed1c832](https://github.com/Rytass/Utils/commit/ed1c8328b1aa8662f124254cb89af8e95078f1db))

## [0.1.3](https://github.com/Rytass/Utils/compare/@rytass/storages@0.1.2...@rytass/storages@0.1.3) (2022-10-19)

### Features

- **storages:** add isExists method for all adapters ([08bb05e](https://github.com/Rytass/Utils/commit/08bb05e669004dcc3a4f3e219a0c363ce9e9ef1a))

## [0.1.2](https://github.com/Rytass/Utils/compare/@rytass/storages@0.1.1...@rytass/storages@0.1.2) (2022-10-17)

### Bug Fixes

- **storages:** add promise reject tracing code ([0b81415](https://github.com/Rytass/Utils/commit/0b81415a4828819e66877f6e7a36c327aabb45d4))

## [0.1.1](https://github.com/Rytass/Utils/compare/@rytass/storages@0.1.0...@rytass/storages@0.1.1) (2022-10-07)

### Bug Fixes

- **storages:** stream filename getter issue ([51e6e8e](https://github.com/Rytass/Utils/commit/51e6e8e006c5e81dace796f1c8cd7598a0dfc567))

# [0.1.0](https://github.com/Rytass/Utils/compare/@rytass/storages@0.0.12...@rytass/storages@0.1.0) (2022-10-06)

### Features

- **storages:** add content type setter on storage api ([2561ffc](https://github.com/Rytass/Utils/commit/2561ffc5a4b66f208190ef2230c46276f9945df8))

## [0.0.12](https://github.com/Rytass/Utils/compare/@rytass/storages@0.0.11...@rytass/storages@0.0.12) (2022-08-10)

### Features

- **file-converter-adapter-image-resizer:** add new adapter for image resize ([d110c65](https://github.com/Rytass/Utils/commit/d110c65e21117d6052dc158fae7036d3bca6a2ea))
- **storages:** add getExtension method, allow custom filename on all storage packages ([f297081](https://github.com/Rytass/Utils/commit/f297081a069f697294cc70d0957f62c2f7b05d79))

## [0.0.11](https://github.com/Rytass/Utils/compare/@rytass/storages@0.0.10...@rytass/storages@0.0.11) (2022-08-04)

**Note:** Version bump only for package @rytass/storages

## [0.0.10](https://github.com/Rytass/Utils/compare/@rytass/storages@0.0.9...@rytass/storages@0.0.10) (2022-08-01)

### Bug Fixes

- **packages:** prevent circular dependencies ([8a231bb](https://github.com/Rytass/Utils/commit/8a231bbca6460f6a39b2d02dac043448db4fbde4))

## 0.0.9 (2022-08-01)

### Features

- **storages:** add converter typings ([15935a2](https://github.com/Rytass/Utils/commit/15935a2d616e7d928b5288e7cbb1006659b5222e))
- **storages:** add remove method and mkdir option ([9e06b12](https://github.com/Rytass/Utils/commit/9e06b127d45726da3fd7c67f04fb309b0b63f5fc))
- **storages:** add typings of @rytass/storages ([9377a21](https://github.com/Rytass/Utils/commit/9377a21ade9f1414e35857e409df1fb41f21080e))
- **storages:** extend basic converter typings and add @rytass/storages-images-converter ([bb18d67](https://github.com/Rytass/Utils/commit/bb18d6743135242301112b65d5d83028a90df2c9))
- **storages:** extends file type methods ([17de86f](https://github.com/Rytass/Utils/commit/17de86fc4c264f9ac11a26379674a6550088c99e))
- **storages:** rename type ([ce988af](https://github.com/Rytass/Utils/commit/ce988afa85fa3ae7de683d66ae82e18ac1e5c17c))
- **storages:** support custom converter options in convert function ([c77913b](https://github.com/Rytass/Utils/commit/c77913bf252701691e114434f7e126cd3bc05987))
