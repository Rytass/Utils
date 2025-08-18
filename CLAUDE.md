# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Build all packages
npm run build

# Run clean build (removes previous builds)
npm run build:clean

# Lint TypeScript files
npm run lint

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Release packages (version bump and publish)
npm run release

# Start documentation site
npm run docs

# Build documentation
npm run docs:build
```

## Project Architecture

This is a **monorepo** using **Lerna** and **Yarn Workspaces** containing **utility packages** for Taiwan-specific services and common functionality. All packages are published to npm under the `@rytass` scope.

### Key Architecture Patterns

- **Monorepo Structure**: Uses Lerna for independent versioning and Yarn workspaces for dependency management
- **Adapter Pattern**: Most services follow an adapter pattern to provide unified interfaces across different Taiwan service providers
- **TypeScript First**: All packages are written in TypeScript with strict type checking
- **NestJS Integration**: Several packages provide NestJS modules for dependency injection integration

### Package Categories

1. **Payment Adapters** (`payments-adapter-*`): Unified payment interfaces for Taiwan payment providers (ECPay, NewebPay, HwaNan, etc.)
2. **Invoice Adapters** (`invoice-adapter-*`): Invoice generation services for Taiwan providers (ECPay, EZPay, etc.)
3. **Storage Adapters** (`storages-adapter-*`): Unified file storage interfaces (S3, GCS, Azure Blob, R2, Local)
4. **CMS Modules** (`cms-*`): Content management system modules for NestJS
5. **File Converters** (`file-converter-*`): Image processing utilities (resize, transcode, watermark)
6. **Secret Management** (`secret-*`): HashiCorp Vault integration
7. **Logistics** (`logistics-*`): Taiwan logistics providers integration
8. **SMS** (`sms-*`): SMS service providers integration

### Build System

- **Custom Rollup Build**: Uses custom build script at `scripts/build.js`
- **Nx Integration**: Uses Nx for task orchestration and caching
- **TypeScript Compilation**: Generates both ESM and CommonJS outputs
- **Independent Publishing**: Each package can be versioned and published independently

### Testing

- **Jest**: Test runner with coverage collection
- **Module Path Mapping**: Uses Jest module mapping to reference packages via `@rytass/package-name`
- **Isolated Testing**: Each package can be tested independently

## Package Development

When adding new functionality to existing packages:
1. All packages follow the `src/index.ts` export pattern
2. Use TypeScript strict mode with proper return types
3. Follow the existing adapter pattern where applicable
4. Add tests in `__tests__` or `__test__` directories
5. Update package's README.md with usage examples

When creating new packages:
1. Use the established folder structure: `src/`, `__tests__/`, `tsconfig.build.json`
2. Follow naming convention: `@rytass/category-adapter-provider` or `@rytass/category`
3. Add appropriate peer dependencies for framework integrations
4. Include proper TypeScript configuration extending from `tsconfig.base.json`

## TypeScript Configuration

- Base config: `tsconfig.base.json` with strict settings
- Build configs: Each package has `tsconfig.build.json` for compilation
- Module resolution: Uses Node.js module resolution with decorator support
- Target: ESNext with declaration generation enabled