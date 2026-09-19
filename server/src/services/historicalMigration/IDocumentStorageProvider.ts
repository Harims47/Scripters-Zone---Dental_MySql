import { Readable } from 'stream';

export interface IDocumentStorageProvider {
  /**
   * Persists a document buffer and returns its storage key/location identifier.
   */
  saveDocument(buffer: Buffer, key: string, contentType: string): Promise<string>;

  /**
   * Retrieves a readable stream for authenticated scan previewing.
   */
  getDocumentStream(key: string): Promise<Readable>;

  /**
   * Retrieves document bytes directly as a Buffer.
   */
  getDocumentBuffer(key: string): Promise<Buffer>;

  /**
   * Removes a document when batch/record is deleted.
   */
  deleteDocument(key: string): Promise<void>;
}
