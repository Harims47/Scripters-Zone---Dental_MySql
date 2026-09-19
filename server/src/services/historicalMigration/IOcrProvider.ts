export interface OcrTextLine {
  text: string;
  confidence: number;
}

export interface OcrResult {
  rawText: string;
  confidence: number;
  lines: OcrTextLine[];
}

export interface IOcrProvider {
  /**
   * Extracts raw text from an image buffer using single OCR provider.
   */
  extractText(imageBuffer: Buffer, mimeType?: string): Promise<OcrResult>;
}
