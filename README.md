# Rytass Utils

This is a tool set maintained by [Rytass](https://rytass.com), welcome to PR if any feature you will added or bug fixed. This project's packages are licensed under the MIT license, allowing free usage for commercial purposes.

We provide a unified interface that allows developers to quickly switch between different service providers without the need for rewriting code, thereby reducing the effort required to understand the API differences of various providers.

## Available Tools

### File Converter

This is an interface for uploading file middleware, used with storages adapters. It's pipe-able api on readable/writable stream.

- [Resize](https://www.npmjs.com/package/@rytass/file-converter-adapter-image-resizer) - Resize images
- [Transcode](https://www.npmjs.com/package/@rytass/file-converter-adapter-image-transcoder) - Transcode image formats, implemented by [sharp](https://sharp.pixelplumbing.com/api-output)
- [Watermark](https://www.npmjs.com/package/@rytass/file-converter-adapter-image-watermark) - Add watermark on image input

### Invoice

Invoice issuer based on Taiwan providers. We have put in a lot of effort to unify and standardize the development interfaces of various invoice service providers.

- [ECPay](https://www.npmjs.com/package/@rytass/payments-adapter-ecpay) - ECPay (綠界) invoice issuer
- [EZPay](https://www.npmjs.com/package/@rytass/invoice-adapter-ezpay) - EZPay (簡單付) invoice issuer

### Logistics

The logistic services timeline information.

- [TCat](https://www.npmjs.com/package/@rytass/logistics-adapter-tcat) - TCat (黑貓宅急便) logistic status gathered from crawler

### Order Builder

This is an order creator for e-commerce platform, it can calculate discount policies, coupon conditions based on input commodities and policies.

- [Order Builder](https://www.npmjs.com/package/@rytass/order-builder)

### Payments

We offer an unified API interface for major payment platforms in Taiwan, allowing developers to switch between different platforms using a single API without the need to thoroughly read the documentation of each platform themselves.

- [ECPay](https://www.npmjs.com/package/@rytass/payments-adapter-ecpay) - ECPay (綠界) payment adapter
- [HuaNan](https://www.npmjs.com/package/@rytass/payments-adapter-hwanan) - HwaNan (華南銀行) payment adapter
- [NewebPay](https://www.npmjs.com/package/@rytass/payments-adapter-newebpay) - NewebPay (藍新金流) payment adapter

### Quadrats

Because [Rytass](https://rytass.com) provides the [Quadrats](https://demo.quadrats.io) content management platform service, we have developed a NestJS API wrapper specifically for it. This allows developers to directly incorporate its API into NestJS applications using dependency injection (DI).

- [Quadrats](https://www.npmjs.com/package/@rytass/quadrats-nestjs) - Quadrats for nestjs module

### Secret

Secrets and environment variables are essential tools for developers to configured their applications. By utilizing different sets of environment variables, we can easily switch between development, staging, and production environments. To meet this requirement, we provide a series of tools for integrating with secret management services.

- [Vault](https://www.npmjs.com/package/@rytass/secret-adapter-vault) - [HashiCorp Vault](https://www.vaultproject.io) service adapter
- [Vault NestJS Module](https://www.npmjs.com/package/@rytass/secret-adapter-vault-nestjs) - Nestjs module wrapper for vault service

### SMS

Implementation of a unified API interface for SMS service providers.

- [Every8d](https://www.npmjs.com/package/@rytass/sms-adapter-every8d) - Every8d SMS API

### Storages

Currently, there are numerous network infrastructure providers offering file hosting and server services. We provide a unified interface that allows developers to quickly switch between different service providers without the need to modify the way they are used.

- [Azure Blob](https://www.npmjs.com/package/@rytass/storages-adapter-azure-blob)
- [GCS](https://www.npmjs.com/package/@rytass/storages-adapter-gcs) - Google Cloud Storage
- [R2](https://www.npmjs.com/package/@rytass/storages-adapter-r2) - Cloudflare R2
- [S3](https://www.npmjs.com/package/@rytass/storages-adapter-s3) - AWS Simple Storage Service
- [Local](https://www.npmjs.com/package/@rytass/storages-adapter-local) - Local file system


