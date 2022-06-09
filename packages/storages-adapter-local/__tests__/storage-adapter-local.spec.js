/**
 * @jest-environment node
 */

import { StorageLocalService } from '../src'
import fs from 'fs'

describe('StorageLocalService', () => {
  const storage = new StorageLocalService()

  it('should create storage file', () => {
    const storageFile = storage.createFile(fs.readFileSync('./test.jpeg'))

    console.log(storageFile)
    expect(storageFile).toBe('image/jpg')
  })
})