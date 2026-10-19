# Rytass Utils - File Storages (Local)

## About

File storage utility, covering basic I/O and metadata guessing, and with plugged-in extension, file buffer could be transformed accordingly.

## Features

- [x] Read File
- [x] Write File
- [x] Delete File

## Storages APIs

---

> ### **_constructor(options)_**

#### **Description**

--

#### **Arguments**

| Parameter  | Type            | Required | Description                                                       |
| ---------- | --------------- | -------- | ----------------------------------------------------------------- |
| directory  | string          | true     | directory will be used                                            |
| autoMkdir  | boolean         | false    | should create folder if directory is not exists                   |
| converters | FileConverter[] | false    | inject extensions for file conversion and respective manipulation |

#### **Snippet**

```typescript
import { LocalStorage } from '@rytass/storages-adapter-local';
import { resolve } from 'path';

const storage = new StorageLocalService({
  directory: resolve(__dirname, 'storage'),
});
```

---

> ### **_StorageLocalService.read(key: string, options: ReadBufferFileOptions | ReadStreamFileOptions):Promise\<Readable> | Promise\<Buffer>_**

#### **Description**

read file from disk

#### **Arguments**

| Parameter      | Type   | Required | Description        |
| -------------- | ------ | -------- | ------------------ |
| key            | string | true     | file name for read |
| options.format | string | false    | buffer/stream      |

#### **Snippet**

```typescript
const fileStream = await storage.read('targetFile.png');
const fileBuffer = await storage.read('targetFile.png', { format: 'buffer' });
```

---

> ### **_StorageLocalService.remove(key: string):Promise\<void>_**

#### **Description**

remove file

#### **Arguments**

--

```typescript
await storage.remove('willRemove.png');
```

---

> ### **_StorageLocalFile.write(file: InputFile): Promise\<StorageFile>_**

#### **Description**

write file to disk

#### **Arguments**

| Parameter | Type      | Required | Description               |
| --------- | --------- | -------- | ------------------------- |
| file      | InputFile | true     | Buffer or Readable stream |

## Error Handling

Stream writes reject with the original error when the source stream or the file write fails (no more hanging or uncaught errors). Streams are always written to a temporary file and renamed into place, so a failed write never leaves a partial file at the target path or truncates an existing one; the temporary file is removed on a best-effort basis.
