# Rytass Utils - File Storages (Local)

## About

File storage utility, covering basic I/O and metadata guessing, and with plugged-in extension, file buffer could be transformed accordingly.

## Features

- [x] File I/O
- [x] Detect MIME
- [x] Detect Extension
- [x] File conversion
- - [x] Image
- - [ ] Stream
- - [ ] Text

## Storages APIs

---

> ### **_constructor(options)_**

#### **Description**

--

#### **Arguments**

| Parameter        | Type        | Required | Description                                                                              |
| ---------------- | ----------- | -------- | ---------------------------------------------------------------------------------------- |
| defaultDirectory | string      | false    | default directory will be used when no additional directory is provided when storage I/O |
| cache            | object      | false    | init cache for read by configuring `maxSize: number` and `ttl: number`                   |
| converters       | converter[] | false    | inject extensions for file conversion and respective manipulation                        |

#### **Snippet**

```typescript
import { StorageLocalService } from "@rytass/storage-adapter-local";
import { resolve } from 'path';

const storage = new StorageLocalService({
    defaultDirectory: resolve(__dirname, 'storage'),
    cache: {
        ttl: 10000,
        maxSize: 10000,
    }
    converters: [ImagesConverter],
});
```

---

> ### **_StorageLocalService.write(input: string | Buffer, options): Promise\<void>_**

#### **Description**

write file with string or buffer input

#### **Arguments**

| Parameter | Type               | Required | Description                                                                                                                                                                                      |
| --------- | ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| maxSize   | number             | false    | size limit of writing input                                                                                                                                                                      |
| fileName  | string \| function | false    | name of the file, could also be a callback function with metadata as arguement and string as return, if fileName field is not provided, will use input buffer to generate `sha1` hash by default |
| directory | string             | false    | directory of the file                                                                                                                                                                            |
| autoMkdir | boolean            | false    | auto create directory if the given directory is not existed                                                                                                                                      |
| callback  | function           | false    | callback function for either error occured or metadata of writing file                                                                                                                           |

#### **Snippet**

```typescript
import { StorageLocalService } from "@rytass/storage-adapter-local";
import { resolve } from 'path';

// text input
const fileName = 'testFile.txt'
await storage.write('test context', {
    fileName: fileName,
    directory: resolve(__dirname, 'storage'),
    autoMkdir: true
    callback: (error, data) => {
        if (error) console.log(error)
        console.log(data)
    }
})
```

---

> ### **_StorageLocalService.read(fileName: string, options):Promise\<StorageLocalFile>_**

#### **Description**

read file from directory

#### **Arguments**

| Parameter | Type   | Required | Description                                                                 |
| --------- | ------ | -------- | --------------------------------------------------------------------------- |
| directory | string | false    | directory of the file, one of this or defaultDirectory is required at least |

#### **Snippet**

```typescript
import { StorageLocalService } from "@rytass/storage-adapter-local";
import { resolve } from "path";

const fileName = "test.png";
const file = await storage.read(fileName, {
  directory: resolve(__dirname, "statics"),
});
console.log(file.metadata);

// {
//     buffer: <Buffer 89 50 4e ... 16976 more bytes>,
//     size: 17026,
//     mime: 'image/png',
//     extension: 'png'
// }
```
---
> ### **_StorageLocalService.readRaw(input: string | Buffer):Promise\<StorageLocalFile>_**

#### **Description**

read file from string or buffer input

#### **Arguments**

--

#### **Snippet**

```typescript
const buffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02,
]);

const file = await storage.readRaw(buffer);
console.log(file)

// StorageLocalFile {
//       extension: 'png',
//       mime: 'image/png',
//       buffer: <Buffer 89 50 4e 47 0d 0a 1a 0a 00 ... 00 02>,
//       size: 23,
//       defaultDirectory: undefined,
//       write: [Function: write],
//       to: [AsyncFunction: to]
//     }
```
---
> ### **_StorageLocalService.search(input: string):Promise\<StorageLocalFile>_**

#### **Description**

search files within given directory

#### **Arguments**
--
```typescript
const files = await storage.search(__dirname);
```
---
> ### **_StorageLocalService.remove(input: string):Promise\<StorageLocalFile>_**

#### **Description**

remove file or files in directory recursively.

#### **Arguments**
--
```typescript
const fileName = 'test.png'
await storage.remove(resolve(__dirname, fileName))
```
---

## Storages Converter APIs
> ### **_StorageLocalFile.to(extension: string, options):Promise\<Buffer>_**
#### **Description**
convert file and advanced manipulation provided by converter

#### **Arguments**

#### `[ImagesConverter]`

| Parameter | Type   | Required | Description                                                                 |
| --------- | ------ | -------- | --------------------------------------------------------------------------- |
| resize | object | false    | resize image with `width: number` and `height: number` |
| quality | number | false | value of converted image quality |

#### **Snippet**
```typescript
import { StorageLocalService } from "@rytass/storage-adapter-local";
import { ImagesConverter } from '@rytass/storages-images-converter';

const storage = new StorageLocalService({ converters: [ImagesConverter] });

const file = await storage.read('test.png', {
      directory: __dirname,
});
const buf = await file.to('jpeg', {resize: { width: 50 }})
if (buf) {
    const convertedFile = await storage.readRaw(buf);
    convertedFile.write({ directory: __dirname });
}
```
---
> ### **_StorageLocalFile.write(options):Promise\<void>_**
#### **Description**

write file from StorageLocalFileType

#### **Arguments**

| Parameter | Type               | Required | Description                                                                                                                                                                                      |
| --------- | ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| maxSize   | number             | false    | size limit of writing input                                                                                                                                                                      |
| fileName  | string \| function | false    | name of the file, could also be a callback function with metadata as arguement and string as return, if fileName field is not provided, will use input buffer to generate `sha1` hash by default |
| directory | string             | false    | directory of the file                                                                                                                                                                            |
| autoMkdir | boolean            | false    | auto create directory if the given directory is not existed                                                                                                                                      |
| callback  | function           | false    | callback function for either error occured or metadata of writing file |

```typescript
const file = await storage.read('test.png', {
      directory: __dirname
});
file.write({
    directory: workingDirectory,
    fileName: 'test_copy.jpeg',
})
```