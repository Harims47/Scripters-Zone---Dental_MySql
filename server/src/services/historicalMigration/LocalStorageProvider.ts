import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { IDocumentStorageProvider } from './IDocumentStorageProvider';

/**
 * LocalStorageProvider
 * 
 * DESIGNED EXCLUSIVELY FOR:
 * 1. Local development
 * 2. Automated test execution
 * 
 * STRICT PROHIBITION:
 * Do NOT use this provider for Render production deployments.
 * Render ephemeral filesystems are destroyed upon redeployment/restarts.
 */
export class LocalStorageProvider implements IDocumentStorageProvider {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.resolve(process.cwd(), 'storage', 'historical_migration');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolvePath(key: string): string {
    // Sanitize key to prevent path traversal
    const safeKey = key.replace(/(\.\.[/\\])+/g, '');
    const fullPath = path.resolve(this.baseDir, safeKey);
    const parent = path.dirname(fullPath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    return fullPath;
  }

  async saveDocument(buffer: Buffer, key: string, contentType: string): Promise<string> {
    const targetPath = this.resolvePath(key);
    await fs.promises.writeFile(targetPath, buffer);
    return key;
  }

  async getDocumentStream(key: string): Promise<Readable> {
    const targetPath = this.resolvePath(key);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Document not found for key: ${key}`);
    }
    return fs.createReadStream(targetPath);
  }

  async getDocumentBuffer(key: string): Promise<Buffer> {
    const targetPath = this.resolvePath(key);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Document not found for key: ${key}`);
    }
    return fs.promises.readFile(targetPath);
  }

  async deleteDocument(key: string): Promise<void> {
    const targetPath = this.resolvePath(key);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
  }
}
