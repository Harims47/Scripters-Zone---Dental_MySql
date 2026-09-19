import { IOcrProvider } from './IOcrProvider';
import { GoogleCloudVisionProvider } from './GoogleCloudVisionProvider';
import { MockDeterministicOcrProvider } from './MockDeterministicOcrProvider';

let instance: IOcrProvider | null = null;

export function getOcrProvider(): IOcrProvider {
  if (instance) {
    return instance;
  }

  // If Google Cloud Vision API key is supplied, use it
  if (process.env.GOOGLE_CLOUD_VISION_API_KEY) {
    instance = new GoogleCloudVisionProvider();
  } else {
    // Default to deterministic mock provider for testing and offline environments
    instance = new MockDeterministicOcrProvider();
  }

  return instance;
}

export function setOcrProvider(customProvider: IOcrProvider): void {
  instance = customProvider;
}

export function resetOcrProvider(): void {
  instance = null;
}
