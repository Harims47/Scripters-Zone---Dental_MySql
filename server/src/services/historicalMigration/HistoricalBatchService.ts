import { prisma } from '../../db';
import { PDFDocument } from 'pdf-lib';
import { getDocumentStorageProvider } from './StorageProviderFactory';
import { getOcrProvider } from './OcrProviderFactory';
import { DeterministicParser } from './DeterministicParser';
import { DuplicateMatchingService } from './DuplicateMatchingService';

export interface UploadedFileItem {
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}

export class HistoricalBatchService {
  public static readonly MAX_BATCH_PAGES = 200;

  /**
   * Pre-inspects uploaded files to determine total page count across all files.
   * Enforces the locked maximum 200 source-page limit.
   */
  static async inspectTotalPages(files: UploadedFileItem[]): Promise<number> {
    let totalPages = 0;

    for (const file of files) {
      const isPdf = file.fileName.toLowerCase().endsWith('.pdf') || file.mimeType === 'application/pdf';
      if (isPdf) {
        try {
          const pdfDoc = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
          totalPages += pdfDoc.getPageCount();
        } catch (e: any) {
          throw new Error(`Failed to parse PDF document "${file.fileName}": ${e.message}`);
        }
      } else {
        // Individual image file = 1 page
        totalPages += 1;
      }
    }

    return totalPages;
  }

  /**
   * Creates a new historical migration batch and decomposes multi-page PDFs
   * into individual page records.
   */
  static async createBatch(
    batchName: string,
    files: UploadedFileItem[],
    createdById?: string
  ): Promise<{ batchId: string; totalPages: number }> {
    if (!files || files.length === 0) {
      throw new Error('Please select at least one file to upload.');
    }

    const totalPages = await this.inspectTotalPages(files);

    if (totalPages > this.MAX_BATCH_PAGES) {
      throw new Error(
        `Batch exceeds the maximum limit of ${this.MAX_BATCH_PAGES} source pages/records. ` +
        `Total pages submitted: ${totalPages}. Please split your documents into smaller batches.`
      );
    }

    const storage = getDocumentStorageProvider();

    // Create batch in database
    const batch = await prisma.historicalMigrationBatch.create({
      data: {
        name: batchName || `Batch #${new Date().toISOString().split('T')[0]}`,
        status: 'UPLOADED',
        totalPages,
        createdById: createdById || null
      }
    });

    const recordCreations: Array<{
      batchId: string;
      pageNumber: number;
      sourceFileKey: string;
      sourceFileName: string;
      status: 'PENDING_OCR';
    }> = [];

    // Process files and store source page buffers
    for (const file of files) {
      const isPdf = file.fileName.toLowerCase().endsWith('.pdf') || file.mimeType === 'application/pdf';

      if (isPdf) {
        const pdfDoc = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
        const pageCount = pdfDoc.getPageCount();

        for (let i = 0; i < pageCount; i++) {
          const subDoc = await PDFDocument.create();
          const [copiedPage] = await subDoc.copyPages(pdfDoc, [i]);
          subDoc.addPage(copiedPage);
          if (pdfDoc.getTitle()) subDoc.setTitle(pdfDoc.getTitle()!);
          if (pdfDoc.getSubject()) subDoc.setSubject(pdfDoc.getSubject()!);
          try {
            const author = pdfDoc.getAuthor();
            if (author && author.startsWith('[')) {
              const pageTexts = JSON.parse(author);
              if (pageTexts[i]) subDoc.setTitle(pageTexts[i]);
            }
          } catch (e) {}
          const pagePdfBytes = await subDoc.save();
          const pageBuffer = Buffer.from(pagePdfBytes);

          const key = `batches/${batch.id}/page_${file.fileName}_${i + 1}.pdf`;
          await storage.saveDocument(pageBuffer, key, 'application/pdf');

          recordCreations.push({
            batchId: batch.id,
            pageNumber: i + 1,
            sourceFileKey: key,
            sourceFileName: `${file.fileName} (Page ${i + 1})`,
            status: 'PENDING_OCR'
          });
        }
      } else {
        const key = `batches/${batch.id}/${file.fileName}`;
        await storage.saveDocument(file.buffer, key, file.mimeType);

        recordCreations.push({
          batchId: batch.id,
          pageNumber: 1,
          sourceFileKey: key,
          sourceFileName: file.fileName,
          status: 'PENDING_OCR'
        });
      }
    }

    // Bulk insert records
    await prisma.historicalMigrationRecord.createMany({
      data: recordCreations
    });

    // Update batch to OCR_PROCESSING
    await prisma.historicalMigrationBatch.update({
      where: { id: batch.id },
      data: { status: 'OCR_PROCESSING' }
    });

    // Kick off OCR processing asynchronously in-process
    this.processBatchOcr(batch.id).catch(err => {
      console.error(`[HistoricalBatchService] OCR processing error on batch ${batch.id}:`, err);
    });

    return {
      batchId: batch.id,
      totalPages
    };
  }

  /**
   * Processes OCR extraction and 6-field deterministic parsing for all records in a batch.
   */
  static async processBatchOcr(batchId: string): Promise<void> {
    const storage = getDocumentStorageProvider();
    const ocrProvider = getOcrProvider();

    const records = await prisma.historicalMigrationRecord.findMany({
      where: { batchId, status: 'PENDING_OCR' },
      orderBy: { pageNumber: 'asc' }
    });

    let processedCount = 0;

    for (const record of records) {
      try {
        const buffer = await storage.getDocumentBuffer(record.sourceFileKey);
        const ocrResult = await ocrProvider.extractText(buffer);

        const extracted = DeterministicParser.parse(ocrResult.rawText);

        // Evaluate candidate for duplicates against live patient catalog
        const duplicateEvaluation = await DuplicateMatchingService.evaluateCandidate(
          extracted.patientName,
          extracted.phoneNumber,
          extracted.age,
          extracted.gender
        );

        await prisma.historicalMigrationRecord.update({
          where: { id: record.id },
          data: {
            status: 'NEEDS_REVIEW', // Human review is always mandatory
            rawOcrText: ocrResult.rawText,
            ocrConfidence: ocrResult.confidence,
            proposedName: extracted.patientName,
            proposedPhone: extracted.phoneNumber,
            proposedAge: extracted.age,
            proposedGender: extracted.gender,
            proposedVisitDate: extracted.visitDate,
            proposedReason: extracted.reasonForVisit,
            reviewedName: extracted.patientName,
            reviewedPhone: extracted.phoneNumber,
            reviewedAge: extracted.age,
            reviewedGender: extracted.gender,
            reviewedVisitDate: extracted.visitDate,
            reviewedReason: extracted.reasonForVisit,
            duplicateStatus: duplicateEvaluation.duplicateStatus,
            duplicateResolution: duplicateEvaluation.suggestedResolution,
            matchedPatientId: duplicateEvaluation.matchedPatientId
          }
        });

        processedCount++;

        // Update batch progress
        await prisma.historicalMigrationBatch.update({
          where: { id: batchId },
          data: { processedRecords: processedCount }
        });
      } catch (recError: any) {
        console.error(`[HistoricalBatchService] Failed to process record ${record.id}:`, recError);
        await prisma.historicalMigrationRecord.update({
          where: { id: record.id },
          data: {
            status: 'FAILED',
            errorMessage: recError.message || 'OCR processing failed'
          }
        });
      }
    }

    // Set batch status to AWAITING_REVIEW
    await prisma.historicalMigrationBatch.update({
      where: { id: batchId },
      data: {
        status: 'AWAITING_REVIEW',
        processedRecords: processedCount
      }
    });
  }

  /**
   * Resets any jobs that were interrupted mid-process (e.g. server restart)
   */
  static async recoverStaleMigrationJobs(): Promise<void> {
    try {
      const staleBatches = await prisma.historicalMigrationBatch.findMany({
        where: {
          status: { in: ['OCR_PROCESSING', 'IMPORTING'] }
        }
      });

      for (const batch of staleBatches) {
        console.warn(`[HistoricalBatchService] Recovering stale batch ${batch.id} (${batch.status})...`);
        if (batch.status === 'OCR_PROCESSING') {
          // Re-trigger OCR on remaining pending records
          this.processBatchOcr(batch.id).catch(err => {
            console.error(`[HistoricalBatchService] Recovery error for batch ${batch.id}:`, err);
          });
        } else if (batch.status === 'IMPORTING') {
          // Reset batch to AWAITING_REVIEW so doctor can resume review and retry import
          await prisma.historicalMigrationBatch.update({
            where: { id: batch.id },
            data: { status: 'AWAITING_REVIEW' }
          });
        }
      }
    } catch (e: any) {
      console.error('[HistoricalBatchService] Failed to run stale job recovery:', e.message);
    }
  }
}
