/**
 * @jest-environment node
 */

import { StorageLocalService } from '../src'
import fs from 'fs'
import { join } from 'path'

describe('StorageLocalService', () => {
  const storage = new StorageLocalService()

  it('should create storage file', async () => {
    const storageFile = await storage.createFile(fs.readFileSync(join(__dirname, 'test.jpeg')))

    expect(storageFile.mime).toBe('image/jpeg')
    expect(storageFile.extension).toBe('jpeg')
  })
})