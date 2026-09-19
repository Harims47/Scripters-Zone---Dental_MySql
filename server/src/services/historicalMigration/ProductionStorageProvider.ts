import { Readable } from 'stream';
import { IDocumentStorageProvider } from './IDocumentStorageProvider';

/**
 * ProductionCloudStorageProvider
 * 
 * PRODUCTION OBJECT-STORAGE ABSTRACTION
 * 
 * Production Historical Migration requires persistent, durable cloud object storage
 * (e.g. AWS S3, Cloudflare R2, or Google Cloud Storage).
 * Render's ephemeral local filesystem will destroy uploaded scans on dyno restart or redeploy.
 * 
 * STATUS: PENDING DEPLOYMENT CONFIGURATION
 * The production cloud object-storage provider has not been selected yet.
 * No fake credentials, secrets, or mocks are invented here.
 */
export class ProductionCloudStorageProvider implements IDocumentStorageProvider {
  private isConfigured: boolean;
  private bucketName?: string;

  constructor() {
    this.bucketName = process.env.HISTORICAL_MIGRATION_STORAGE_BUCKET;
    // Strictly verify whether production cloud storage credentials have been injected by DevOps
    this.isConfigured = Boolean(
      this.bucketName &&
      (
        (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
        process.env.GCS_SERVICE_ACCOUNT_KEY ||
        process.env.R2_SECRET_ACCESS_KEY
      )
    );
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new Error(
        '[ProductionCloudStorageProvider] Production cloud object storage is NOT configured. ' +
        'Historical migration requires durable cloud storage (AWS S3, Cloudflare R2, or GCS) in production. ' +
        'Do not use Render ephemeral local disks. Please configure HISTORICAL_MIGRATION_STORAGE_BUCKET ' +
        'and provider credentials in environment variables before executing production migrations.'
      );
    }
  }

  async saveDocument(buffer: Buffer, key: string, contentType: string): Promise<string> {
    this.assertConfigured();
    throw new Error('Production cloud object storage client pending configuration.');
  }

  async getDocumentStream(key: string): Promise<Readable> {
    this.assertConfigured();
    throw new Error('Production cloud object storage client pending configuration.');
  }

  async getDocumentBuffer(key: string): Promise<Buffer> {
    this.assertConfigured();
    throw new Error('Production cloud object storage client pending configuration.');
  }

  async deleteDocument(key: string): Promise<void> {
    this.assertConfigured();
    throw new Error('Production cloud object storage client pending configuration.');
  }
}
