import { IDocumentStorageProvider } from './IDocumentStorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { ProductionCloudStorageProvider } from './ProductionStorageProvider';

let instance: IDocumentStorageProvider | null = null;

export function getDocumentStorageProvider(): IDocumentStorageProvider {
  if (instance) {
    return instance;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const forceLocal = process.env.USE_LOCAL_STORAGE_IN_PROD === 'true';

  if (isProduction && !forceLocal) {
    // In production, instantiate the cloud object-storage provider.
    // Throws a descriptive error if cloud storage credentials are missing,
    // explicitly preventing silent reliance on Render's ephemeral filesystem.
    instance = new ProductionCloudStorageProvider();
  } else {
    // Local development & test suite
    instance = new LocalStorageProvider();
  }

  return instance;
}

export function setDocumentStorageProvider(customProvider: IDocumentStorageProvider): void {
  instance = customProvider;
}

export function resetDocumentStorageProvider(): void {
  instance = null;
}
