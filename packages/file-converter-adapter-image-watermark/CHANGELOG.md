# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.3.0](https://github.com/Rytass/Utils/compare/@rytass/file-converter-adapter-image-watermark@0.2.0...@rytass/file-converter-adapter-image-watermark@0.3.0) (2026-08-30)

Upgrades `sharp` from 0.34 to 0.35 for [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) — sharp below 0.35.0 bundles a libvips carrying CVE-2026-33327, CVE-2026-33328, CVE-2026-35590 and CVE-2026-35591, and decoding untrusted images is exactly what this package is for. 0.35.4 brings libvips 8.18.6.

Three consequences of that upgrade, none of them visible in this package's own API:

- **Node 20.9.0 is now the minimum**, declared as `engines.node`. sharp 0.35 dropped Node 18, and this package previously declared no engines at all — so the requirement would otherwise have surfaced as a runtime failure rather than at install time.
- **Lossy AVIF output changed.** sharp 0.35 tunes it with SSIMULACRA2-based metrics, so the same `quality` setting produces a different file. Re-check any size or fidelity budget calibrated against 0.34.
- **`limitInputChannels` now defaults to 5.** An image with more channels is rejected where it previously was not.

**Note:** Version bump only for package @rytass/file-converter-adapter-image-watermark

# [0.2.0](https://github.com/Rytass/Utils/compare/@rytass/file-converter-adapter-image-watermark@0.1.13...@rytass/file-converter-adapter-image-watermark@0.2.0) (2026-08-02)

### Bug Fixes

- **file-converter-adapter-image-watermark:** import gravity off sharp's default ([4cab060](https://github.com/Rytass/Utils/commit/4cab0605afb346fa56291b0ce6f556bb3471bfc8))
- widen internal [@rytass](https://github.com/rytass) dependency ranges to survive minor bumps ([fe1dd64](https://github.com/Rytass/Utils/commit/fe1dd6425f69a5098903f51bd62eefb29f2f5bd1))

## [0.1.13](https://github.com/Rytass/Utils/compare/@rytass/file-converter-adapter-image-watermark@0.1.12...@rytass/file-converter-adapter-image-watermark@0.1.13) (2025-12-04)

**Note:** Version bump only for package @rytass/file-converter-adapter-image-watermark

## [0.1.12](https://github.com/Rytass/Utils/compare/@rytass/file-converter-adapter-image-watermark@0.1.11...@rytass/file-converter-adapter-image-watermark@0.1.12) (2025-09-15)

### Bug Fixes

- resolve all security vulnerabilities detected by GitHub audit ([0fcdf72](https://github.com/Rytass/Utils/commit/0fcdf72a8a4b1708c09ab0124dfc44e0ea781f2f))

## [0.1.11](https://github.com/Rytass/Utils/compare/@rytass/file-converter-adapter-image-watermark@0.1.10...@rytass/file-converter-adapter-image-watermark@0.1.11) (2025-09-11)

### Features

- migrate to Nx project-based configuration ([c2d9ca4](https://github.com/Rytass/Utils/commit/c2d9ca46c00ace42bcbf69300dcc43a7346cb9aa))

### Tests

- migrate to standardized test structure ([b7dc99e](https://github.com/Rytass/Utils/commit/b7dc99ef85f5951480dfdae6198cefa252c15423))

### BREAKING CHANGES

- Test directory structure changed from **test** to **tests**

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.1.10](https://github.com/Rytass/Utils/compare/@rytass/file-converter-adapter-image-watermark@0.1.9...@rytass/file-converter-adapter-image-watermark@0.1.10) (2025-09-09)

### Features

- add test:coverage script to all packages ([f73bce5](https://github.com/Rytass/Utils/commit/f73bce52024d453755824fa6af784f13da50061f))
- upgrade file-type from v16.5.4 to v21.0.0 ([eb8217b](https://github.com/Rytass/Utils/commit/eb8217b76c4a0d74061f782c082fd4183961bb12))

### BREAKING CHANGES

- file-type v21 is ESM-only, requires Node.js 18+

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.1.9](https://github.com/Rytass/Utils/compare/@rytass/file-converter-adapter-image-watermark@0.1.8...@rytass/file-converter-adapter-image-watermark@0.1.9) (2025-08-19)

### Bug Fixes

- add sqlite3 for unit test, remove console.log ([8e9a857](https://github.com/Rytass/Utils/commit/8e9a8574e8d6ed37b5806ccbf0239488c1875373))

## [0.1.8](https://github.com/Rytass/Utils/compare/@rytass/file-converter-adapter-image-watermark@0.1.7...@rytass/file-converter-adapter-image-watermark@0.1.8) (2025-06-06)

### Features

- **file-converter-adapter-image-watermark:** add sharp concurrency config ([1827db5](https://github.com/Rytass/Utils/commit/1827db5fe858126138ad2c62ad009cfd56cdaf4e))

## [0.1.7](https://github.com/Rytass/Utils/compare/@rytass/file-converter-adapter-image-watermark@0.1.6...@rytass/file-converter-adapter-image-watermark@0.1.7) (2024-11-29)

**Note:** Version bump only for package @rytass/file-converter-adapter-image-watermark

## [0.1.6](https://github.com/Rytass/Utils/compare/@rytass/file-converter-adapter-image-watermark@0.1.5...@rytass/file-converter-adapter-image-watermark@0.1.6) (2024-07-23)

**Note:** Version bump only for package @rytass/file-converter-adapter-image-watermark

## [0.1.5](https://github.com/Rytass/Utils/compare/@rytass/file-converter-adapter-image-watermark@0.1.4...@rytass/file-converter-adapter-image-watermark@0.1.5) (2023-06-05)

**Note:** Version bump only for package @rytass/file-converter-adapter-image-watermark

## [0.1.4](https://github.com/Rytass/Utils/compare/@rytass/file-converter-adapter-image-watermark@0.1.2...@rytass/file-converter-adapter-image-watermark@0.1.4) (2022-12-21)

### Features

- **deps:** upgrade sharp version ([98f7028](https://github.com/Rytass/Utils/commit/98f7028cc8783683a435118e1e7312b407cdc191))

## [0.1.3](https://github.com/Rytass/Utils/compare/@rytass/file-converter-adapter-image-watermark@0.1.2...@rytass/file-converter-adapter-image-watermark@0.1.3) (2022-12-21)

### Features

- **deps:** upgrade sharp version ([98f7028](https://github.com/Rytass/Utils/commit/98f7028cc8783683a435118e1e7312b407cdc191))

## 0.1.2 (2022-08-10)

### Features

- **file-converter-adapter-image-watermark:** add watermark converter ([bf2def3](https://github.com/Rytass/Utils/commit/bf2def359e4271ff54c4cdaebe760dba00dd6e09))

## 0.1.1 (2022-08-10)

### Features

- **file-converter-adapter-image-resizer:** add new adapter for image resize ([d110c65](https://github.com/Rytass/Utils/commit/d110c65e21117d6052dc158fae7036d3bca6a2ea))
