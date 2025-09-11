# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.2.7](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.2.6...@rytass/storages-adapter-local@0.2.7) (2025-09-11)

### Features

- migrate to Nx project-based configuration ([c2d9ca4](https://github.com/Rytass/Utils/commit/c2d9ca46c00ace42bcbf69300dcc43a7346cb9aa))
- **storages-adapter-local:** improve test stability with mock file system ([bae664b](https://github.com/Rytass/Utils/commit/bae664b3dc04a7a9c033ade6bc99d991adc8b82a))

### Tests

- migrate to standardized test structure ([b7dc99e](https://github.com/Rytass/Utils/commit/b7dc99ef85f5951480dfdae6198cefa252c15423))

### BREAKING CHANGES

- Test directory structure changed from **test** to **tests**

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.2.6](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.2.5...@rytass/storages-adapter-local@0.2.6) (2025-09-09)

### Bug Fixes

- **storages-adapter-local:** fix stream write timeout issue ([1686da6](https://github.com/Rytass/Utils/commit/1686da680dfb4f3a7ca3d0c50d44b1bf6c9dc891))
- **storages-adapter-local:** resolve race conditions in file operations ([b13b672](https://github.com/Rytass/Utils/commit/b13b672a67509ee4d56402ab61f28c04f6956b33))

### Features

- add test:coverage script to all packages ([f73bce5](https://github.com/Rytass/Utils/commit/f73bce52024d453755824fa6af784f13da50061f))
- upgrade file-type from v16.5.4 to v21.0.0 ([eb8217b](https://github.com/Rytass/Utils/commit/eb8217b76c4a0d74061f782c082fd4183961bb12))

### BREAKING CHANGES

- file-type v21 is ESM-only, requires Node.js 18+

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.2.5](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.2.4...@rytass/storages-adapter-local@0.2.5) (2025-08-19)

**Note:** Version bump only for package @rytass/storages-adapter-local

## [0.2.4](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.2.3...@rytass/storages-adapter-local@0.2.4) (2024-11-29)

**Note:** Version bump only for package @rytass/storages-adapter-local

## [0.2.3](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.2.2...@rytass/storages-adapter-local@0.2.3) (2024-07-23)

**Note:** Version bump only for package @rytass/storages-adapter-local

## [0.2.2](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.2.1...@rytass/storages-adapter-local@0.2.2) (2023-06-05)

**Note:** Version bump only for package @rytass/storages-adapter-local

## [0.2.1](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.2.0...@rytass/storages-adapter-local@0.2.1) (2023-05-30)

### Bug Fixes

- correct unit to 1M blocks ([ff81490](https://github.com/Rytass/Utils/commit/ff81490f52be89dc5061ee7deeb495b2940565d1))
- eslint ([54cb6e3](https://github.com/Rytass/Utils/commit/54cb6e30a4c07a8e7038154ca3c2310620bce3a4))
- eslint ([1076222](https://github.com/Rytass/Utils/commit/10762222cc673a22e852d01332c29acb85c1ee82))
- removing extra imports ([f68d49f](https://github.com/Rytass/Utils/commit/f68d49fa3e6aa0d03763481cd033c36c6a3f5287))
- updating storage-local tests to chain getUsageInfo ([02c8f2d](https://github.com/Rytass/Utils/commit/02c8f2d4f6bcb45b7959c4c358bb6fbdbc5b40da))
- using exec instead of spawn for child_process ([59edc98](https://github.com/Rytass/Utils/commit/59edc980e84899baedf5c62094aa51d668b73ba5))

### Features

- adding dependencies and chain operation with RX ([a8b86c8](https://github.com/Rytass/Utils/commit/a8b86c84ecc390ceeab1093c3c04ec057e207b91))
- getFsUsage dependencies ([b48fa24](https://github.com/Rytass/Utils/commit/b48fa2417a8d9b9f87807188876e577120eeef8b))
- getFsUsage private function added to storage local ([0a0436a](https://github.com/Rytass/Utils/commit/0a0436acb2a84091ecf779b15d15aed871a14545))
- public getUsageInfo for storage-local ([467e093](https://github.com/Rytass/Utils/commit/467e0930798e9efbb388da22795db0a701ba6ebe))
- storage helper commands for \*nix systems ([ca46aa5](https://github.com/Rytass/Utils/commit/ca46aa50a4bd2b2cc0911419ce5839a0f23eb380))
- storage helper commands into a template ([e6b18a2](https://github.com/Rytass/Utils/commit/e6b18a21f6a2dd8d91523a3dd3ccccffa54d5e1e))
- storage helper commands: total ([400573d](https://github.com/Rytass/Utils/commit/400573d26ef2f10f16d012591276755af89f35f0))
- struct StorageLocalUsageInfo in MB ([d36472a](https://github.com/Rytass/Utils/commit/d36472aa202de86ce4651e265d124fac0fb5b268))
- switched back to Promise based logic ([add3b0c](https://github.com/Rytass/Utils/commit/add3b0cf4a6c3bb987e1fe9e7ce76f96a78bb4f9))
- total added to helper function ([7f50ba7](https://github.com/Rytass/Utils/commit/7f50ba7ab8d92ebf6eed86eb629adf0870bbd691))
- unit test on getUsageInfo ([f0674e8](https://github.com/Rytass/Utils/commit/f0674e8a83ec32067a2d2c5bdf521ba9d0f2ab2c))
- wrapping the exec child_process import ([c69b07e](https://github.com/Rytass/Utils/commit/c69b07e55df292a12b64d8f9d83a88f9072b963a))

# [0.2.0](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.1.4...@rytass/storages-adapter-local@0.2.0) (2023-02-27)

### Features

- **storages:** auto detect mime for content type ([4c8a951](https://github.com/Rytass/Utils/commit/4c8a9515a1852d8431a6e9e1345d79b3e652de0c))

## [0.1.4](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.1.3...@rytass/storages-adapter-local@0.1.4) (2023-02-26)

**Note:** Version bump only for package @rytass/storages-adapter-local

## [0.1.3](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.1.2...@rytass/storages-adapter-local@0.1.3) (2022-10-19)

### Features

- **storages:** add isExists method for all adapters ([08bb05e](https://github.com/Rytass/Utils/commit/08bb05e669004dcc3a4f3e219a0c363ce9e9ef1a))

## [0.1.2](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.1.1...@rytass/storages-adapter-local@0.1.2) (2022-10-17)

**Note:** Version bump only for package @rytass/storages-adapter-local

## [0.1.1](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.1.0...@rytass/storages-adapter-local@0.1.1) (2022-10-07)

**Note:** Version bump only for package @rytass/storages-adapter-local

# [0.1.0](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.0.13...@rytass/storages-adapter-local@0.1.0) (2022-10-06)

### Features

- **storages:** add content type setter on storage api ([2561ffc](https://github.com/Rytass/Utils/commit/2561ffc5a4b66f208190ef2230c46276f9945df8))

## [0.0.13](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.0.12...@rytass/storages-adapter-local@0.0.13) (2022-08-10)

**Note:** Version bump only for package @rytass/storages-adapter-local

## [0.0.12](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.0.11...@rytass/storages-adapter-local@0.0.12) (2022-08-10)

### Features

- **storages:** add getExtension method, allow custom filename on all storage packages ([f297081](https://github.com/Rytass/Utils/commit/f297081a069f697294cc70d0957f62c2f7b05d79))

## [0.0.11](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.0.10...@rytass/storages-adapter-local@0.0.11) (2022-08-04)

**Note:** Version bump only for package @rytass/storages-adapter-local

## [0.0.10](https://github.com/Rytass/Utils/compare/@rytass/storages-adapter-local@0.0.9...@rytass/storages-adapter-local@0.0.10) (2022-08-01)

**Note:** Version bump only for package @rytass/storages-adapter-local

## 0.0.9 (2022-08-01)

### Bug Fixes

- **storages:** recursive lookup fix ([78ad3d1](https://github.com/Rytass/Utils/commit/78ad3d155b176090b0bebd1e1139ac2621a24596))
- **storages:** sync deps version and add missing [@types](https://github.com/types), correct import source ([649db9c](https://github.com/Rytass/Utils/commit/649db9cf04975689b00492afbe676edb0d495c0b))

### Features

- **storages:** add @rytass/storages-adapter-local test ([255280e](https://github.com/Rytass/Utils/commit/255280ef1f4ae8cb717acb4c1f442823c6e360ce))
- **storages:** add converter typings ([15935a2](https://github.com/Rytass/Utils/commit/15935a2d616e7d928b5288e7cbb1006659b5222e))
- **storages:** add read file cache ([32a9382](https://github.com/Rytass/Utils/commit/32a938234c08393cf24481d58d93b094021fc29b))
- **storages:** add remove method and mkdir option ([9e06b12](https://github.com/Rytass/Utils/commit/9e06b127d45726da3fd7c67f04fb309b0b63f5fc))
- **storages:** extend basic converter typings and add @rytass/storages-images-converter ([bb18d67](https://github.com/Rytass/Utils/commit/bb18d6743135242301112b65d5d83028a90df2c9))
- **storages:** extends file type methods ([17de86f](https://github.com/Rytass/Utils/commit/17de86fc4c264f9ac11a26379674a6550088c99e))
- **storages:** function hint ([bf04444](https://github.com/Rytass/Utils/commit/bf04444c60df0c99bd5d233377ea54f617f40538))
- **storages:** rename type ([ce988af](https://github.com/Rytass/Utils/commit/ce988afa85fa3ae7de683d66ae82e18ac1e5c17c))
- **storages:** support custom converter options in convert function ([c77913b](https://github.com/Rytass/Utils/commit/c77913bf252701691e114434f7e126cd3bc05987))
- **storage:** use different detect lib for mime and extension ([2b69011](https://github.com/Rytass/Utils/commit/2b69011fabb8ad2187f58251337d12763e88c8fe))
