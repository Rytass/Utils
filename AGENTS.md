# AGENTS.md

> Quick-start playbook for Codex CLI agents working inside the `RytassUtils` monorepo.

## Repository At A Glance
- Monorepo powered by Yarn 4.9 (node-modules linker), Nx 21, and Lerna (independent versions) on Node.js 22 (`.nvmrc`).
- All first-party code lives under `packages/*`; each package ships TypeScript source in `src/` and generated bundles in `lib/` (ESM + CJS) via `scripts/build.cjs`.
- Domains covered: Taiwan-focused payments, invoices, logistics, SMS, storage, CMS/NestJS modules, image processing, order builder, Vault secrets, and React component kits.
- Documentation (`docs/`) uses Docusaurus 3; component demos use Storybook 9; coverage artifacts live in `coverage/`.
- AI-specific guidance already exists in `CLAUDE.md` and `llms.txt`; keep this file focused on Codex CLI workflows.

## Environment Setup
- Use Node.js 22 (`nvm use 22` or `corepack enable && corepack prepare yarn@4.9.1`).
- Install dependencies with `yarn install`; avoid `npm install` to keep Yarn’s Berry metadata intact.
- Yarn runs in node-modules mode (`.yarnrc.yml`), so commands execute under a familiar `node_modules/` layout.
- Husky hooks (`.husky/`) run lint-staged and commitlint; if they trigger during local commits, ensure staged files satisfy lint/test checks before retrying.

## Everyday Commands (workspace root)
- Install: `yarn install`
- Format (repo wide): `yarn nx format:write`
- Lint: `yarn lint` (delegates to Nx `run-many` -> ESLint with `eslint.config.js`)
- Build: `yarn build` (topological Nx build invoking `scripts/build.cjs` per package)
- Clean builds: `yarn clean` (runs `scripts/clean-build.cjs` inside each project)
- Test (all): `yarn test`
- Test with coverage: `yarn test:coverage`
- Watch tests: `yarn test:watch`
- Storybook dev: `yarn storybook`
- Storybook static build: `yarn storybook:build`
- Docs dev server: `yarn docs` (runs `npm start` in `docs/`)
- Docs static build: `yarn docs:build` (uses `scripts/build-docs.cjs`, which temporarily toggles `package.json` type)
- Publish flow: `yarn release` (lerna version patch → Nx build → lerna publish from `lib/`)

### Per-package targets (Nx)
- `yarn nx build payments-adapter-ecpay`
- `yarn nx test payments`
- `yarn nx lint storages-adapter-s3`
- `yarn nx graph` or `yarn nx show projects` to explore dependency graph

Nx target defaults are defined in `nx.json`; every package has a `project.json` pointing build/test/lint/clean to the shared runner definitions.

## Build System Highlights
- `scripts/build.cjs` orchestrates Rollup + SWC + PostCSS for each package, generates both module formats, copies README/LICENSE, and syncs binaries into the root `lib/` and workspace `node_modules/`.
- `scripts/clean-build.cjs` removes `lib/`, `prebuilts/`, and `.tsbuildinfo`, plus the matching entry under `node_modules/@rytass/*` when available.
- Do not hand-edit anything under any `lib/` directory; treat it as generated output.
- React-oriented packages extend `tsconfig.base.web.json` (bundler resolution, DOM libs); Node/NestJS packages extend `tsconfig.base.node.json` (Node resolution, decorators enabled).
- Path aliases for local development are declared in `tsconfig.json` (`@rytass/...` → `packages/.../src`).

## Testing & Fixtures
- Jest configuration lives at `jest.config.js` using `ts-jest` in ESM mode with `tsconfig.spec.json`.
- Global setup (`jest.setup.ts`) polyfills `TextEncoder/Decoder`; mocks are under `jest.mocks/` (e.g., `file-type.js`).
- Tests typically sit in `__tests__/**.spec.ts`, with helpers under `__utils__` or `__fixtures__`.
- Coverage collection writes to `coverage/`; clean with `yarn test:clean` if needed.
- Use package aliases in tests (`import { ... } from '@rytass/payments'`) to match production builds.

## Linting, Formatting, and Commit Hygiene
- ESLint rules live in `eslint.config.js`, combining TypeScript ESLint, React, import rules, and Prettier integration. Expect strict typing (`@typescript-eslint/explicit-function-return-type`, `prefer-readonly`, no `any`).
- Prettier is configured via `.prettierrc` (120-column width, semicolons, single quotes). Run manually with `yarn nx format:write` if lint-staged fails.
- Husky `pre-commit` runs `yarn lint-staged --relative --concurrent false -v` which calls `nx affected --target=typecheck` (ensure relevant projects expose a `typecheck` target or fall back to running `yarn build` if Nx complains) and `nx affected:lint` plus formatting.
- `commitlint.config.js` enforces Conventional Commits with a 100-character header limit; use `yarn commit` with Commitizen (`.cz.json`) if desired.
- Commit scopes must match Lerna package names (e.g. `member-base-nestjs-module` rather than the shorter service name). When in doubt run `yarn nx show projects` to confirm the exact scope string before committing.

## Package Layout & Conventions
- Standard layout: `packages/<name>/{package.json, project.json, tsconfig.build.json, src/, __tests__/}`.
- Keep exports centralized in `src/index.ts`; avoid default exports unless already established.
- React packages commonly include `.module.scss`; typings are provided via `global.d.ts`.
- Maintain localized README.md and CHANGELOG.md per package when functionality changes.
- When introducing a new package, copy an existing sibling that matches the runtime (Node vs Web) to ensure Nx + Rollup targets align, then register the path alias in root `tsconfig.json`.

## Domain-specific Package Families (examples)
- **Payments**: `payments`, adapters for ECPay, NewebPay, HwaNan, CTBC Micro Fast Pay, Happy Card, iCash Pay, plus `payments-nestjs-module`.
- **Invoices**: `invoice`, adapters for ECPay, EZPay, Amego, Bank Pro.
- **Logistics**: `logistics`, adapters for TCat and CTC.
- **File Converter**: core `file-converter` plus image adapters (resize, transcode, watermark).
- **Storage**: `storages` core + adapters (S3, GCS, Azure Blob, R2, Local).
- **Secrets**: `secret` core, Vault adapter, Vault NestJS module.
- **SMS**: `sms`, `sms-adapter-every8d`.
- **CMS / Membership / WMS**: NestJS modules (`cms-base-*`, `member-base-nestjs-module`, `wms-base-nestjs-module`), React component libraries (`cms-react-components`, `wms-map-react-components`).
- **Utilities**: `order-builder`, `quadrats-nestjs`, and shared helpers embedded across packages.

Use `ls packages` or `yarn nx show projects` to confirm the exact project name before running Nx commands.

## Documentation & Storybook
- Docusaurus site resides in `docs/`. `yarn docs` starts `cd docs && npm start`; expect another dependency install scoped to that folder. `yarn docs:build` runs `scripts/build-docs.cjs`, which temporarily renames the root `package.json` `type` field—never commit that transient change.
- Storybook configuration lives under `.storybook/`; `storybook-static/` contains generated artifacts and is gitignored.

## Release & Publishing Notes
- Lerna operates in independent version mode (`lerna.json`). `yarn release` increments patch versions with Conventional Commit summaries, rebuilds via Nx, and publishes from each package’s `lib/` folder.
- Ensure `LICENSE` and package-specific README are up to date before publishing; the build script copies them into the distributed bundle automatically.
- Changelogs are maintained per package (see `packages/**/CHANGELOG.md`) and aggregated root-level `CHANGELOG.md` as needed.

## Operational Tips for Codex CLI Agents
- Prefer `rg` or `rg --files` for searching; the repo is large and already includes `node_modules/`.
- Always run commands from the repo root unless a script explicitly changes directories (e.g., docs).
- Verify whether a directory is generated (`lib/`, `coverage/`, `docs/build`, `storybook-static/`) before editing.
- When modifying build tooling, test with a targeted package to avoid long `run-many` cycles.
- Reference `CLAUDE.md` for additional architectural background, but keep Codex automation aligned with this guide.
- If you need to inspect cache artifacts, they live under `.nx/`; the directory is gitignored and safe to clear if tasks misbehave.

## Useful File Index
- Root manifest: `package.json`
- Monorepo orchestrators: `nx.json`, `lerna.json`
- Build scripts: `scripts/build.cjs`, `scripts/clean-build.cjs`
- Testing setup: `jest.config.js`, `jest.setup.ts`, `jest.mocks/`
- Linters & formatters: `eslint.config.js`, `.prettierrc`, `lint-staged.config.js`, `commitlint.config.js`
- TypeScript configs: `tsconfig.json`, `tsconfig.base.node.json`, `tsconfig.base.web.json`, `tsconfig.dev.json`, `tsconfig.spec.json`
- Docs tooling: `docs/docusaurus.config.mjs`, `scripts/build-docs.cjs`
- Storybook config: `.storybook/`

Keep this document updated whenever tooling, workflows, or package conventions change so future Codex agents can ramp up quickly.
