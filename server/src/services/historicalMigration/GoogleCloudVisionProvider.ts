import { IOcrProvider, OcrResult } from './IOcrProvider';

/**
 * GoogleCloudVisionProvider
 * 
 * Production OCR adapter using Google Cloud Vision REST API
 * (DOCUMENT_TEXT_DETECTION feature) for handwriting and complex document layouts.
 */
export class GoogleCloudVisionProvider implements IOcrProvider {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_CLOUD_VISION_API_KEY;
  }

  async extractText(imageBuffer: Buffer, mimeType: string = 'image/jpeg'): Promise<OcrResult> {
    if (!this.apiKey) {
      throw new Error(
        '[GoogleCloudVisionProvider] GOOGLE_CLOUD_VISION_API_KEY is not configured in environment.'
      );
    }

    const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`;
    const base64Content = imageBuffer.toString('base64');

    const requestBody = {
      requests: [
        {
          image: { content: base64Content },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
        }
      ]
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Cloud Vision API failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const annotation = data.responses?.[0]?.fullTextAnnotation;

    if (!annotation || !annotation.text) {
      return {
        rawText: '',
        confidence: 0,
        lines: []
      };
    }

    const rawText = annotation.text as string;
    const lines = rawText.split('\n').map(text => ({ text, confidence: 0.9 }));

    return {
      rawText,
      confidence: 0.9,
      lines
    };
  }
}
