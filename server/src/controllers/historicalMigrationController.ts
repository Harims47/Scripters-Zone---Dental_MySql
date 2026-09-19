import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { HistoricalBatchService, UploadedFileItem } from '../services/historicalMigration/HistoricalBatchService';
import { HistoricalImportService } from '../services/historicalMigration/HistoricalImportService';
import { getDocumentStorageProvider } from '../services/historicalMigration/StorageProviderFactory';
import { DuplicateMatchingService } from '../services/historicalMigration/DuplicateMatchingService';

export const createBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one file to upload.' });
    }

    const fileItems: UploadedFileItem[] = files.map((f: any) => {
      const buffer = Buffer.from(f.base64, 'base64');
      return {
        fileName: f.name || 'scan.jpg',
        buffer,
        mimeType: f.mimeType || (f.name?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
      };
    });

    const user = (req as any).user;
    const result = await HistoricalBatchService.createBatch(name, fileItems, user?.id);

    return res.status(201).json({
      message: 'Batch created and scheduled for OCR processing.',
      batchId: result.batchId,
      totalPages: result.totalPages
    });
  } catch (error: any) {
    next(error);
  }
};

export const getBatches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batches = await prisma.historicalMigrationBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { records: true }
        }
      }
    });

    return res.json(batches);
  } catch (error) {
    next(error);
  }
};

export const getBatchById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batchId = req.params.batchId as string;
    const batch = await prisma.historicalMigrationBatch.findUnique({
      where: { id: batchId },
      include: {
        records: {
          orderBy: { pageNumber: 'asc' },
          include: {
            matchedPatient: {
              select: { id: true, name: true, phone: true, age: true, gender: true }
            }
          }
        }
      }
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found.' });
    }

    return res.json(batch);
  } catch (error) {
    next(error);
  }
};

export const getBatchRecords = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batchId = req.params.batchId as string;
    const { status } = req.query;

    const where: any = { batchId };
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    const records = await prisma.historicalMigrationRecord.findMany({
      where,
      orderBy: { pageNumber: 'asc' },
      include: {
        matchedPatient: {
          select: { id: true, name: true, phone: true, age: true, gender: true }
        }
      }
    });

    return res.json(records);
  } catch (error) {
    next(error);
  }
};

export const previewRecordDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recordId = req.params.recordId as string;
    const record = await prisma.historicalMigrationRecord.findUnique({
      where: { id: recordId }
    });

    if (!record) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    const storage = getDocumentStorageProvider();
    const isPdf = record.sourceFileKey.toLowerCase().endsWith('.pdf');
    const contentType = isPdf ? 'application/pdf' : 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${record.sourceFileName}"`);

    const stream = await storage.getDocumentStream(record.sourceFileKey);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const updateRecordReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recordId = req.params.recordId as string;
    const {
      reviewedName,
      reviewedPhone,
      reviewedAge,
      reviewedGender,
      reviewedVisitDate,
      reviewedReason,
      status,
      duplicateResolution,
      matchedPatientId
    } = req.body;

    const existingRecord = await prisma.historicalMigrationRecord.findUnique({
      where: { id: recordId }
    });

    if (!existingRecord) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    // If name or phone changed, re-evaluate duplicates
    let duplicateStatus = existingRecord.duplicateStatus;
    let resolvedMatchedId = matchedPatientId !== undefined ? matchedPatientId : existingRecord.matchedPatientId;

    if (
      reviewedName !== undefined && reviewedName !== existingRecord.reviewedName ||
      reviewedPhone !== undefined && reviewedPhone !== existingRecord.reviewedPhone
    ) {
      const reEval = await DuplicateMatchingService.evaluateCandidate(
        reviewedName !== undefined ? reviewedName : existingRecord.reviewedName,
        reviewedPhone !== undefined ? reviewedPhone : existingRecord.reviewedPhone,
        reviewedAge !== undefined ? reviewedAge : existingRecord.reviewedAge,
        reviewedGender !== undefined ? reviewedGender : existingRecord.reviewedGender
      );
      duplicateStatus = reEval.duplicateStatus;
      if (!matchedPatientId) {
        resolvedMatchedId = reEval.matchedPatientId;
      }
    }

    const updated = await prisma.historicalMigrationRecord.update({
      where: { id: recordId },
      data: {
        reviewedName: reviewedName !== undefined ? (reviewedName ? String(reviewedName).trim() : null) : undefined,
        reviewedPhone: reviewedPhone !== undefined ? (reviewedPhone ? String(reviewedPhone).trim() : null) : undefined,
        reviewedAge: reviewedAge !== undefined ? (reviewedAge !== null && reviewedAge !== '' ? parseInt(reviewedAge, 10) : null) : undefined,
        reviewedGender: reviewedGender !== undefined ? (reviewedGender ? String(reviewedGender) : null) : undefined,
        reviewedVisitDate: reviewedVisitDate !== undefined ? (reviewedVisitDate ? new Date(reviewedVisitDate) : null) : undefined,
        reviewedReason: reviewedReason !== undefined ? (reviewedReason ? String(reviewedReason).trim() : null) : undefined,
        status: status !== undefined ? status : undefined,
        duplicateResolution: duplicateResolution !== undefined ? duplicateResolution : undefined,
        duplicateStatus: duplicateStatus !== undefined ? duplicateStatus : undefined,
        matchedPatientId: resolvedMatchedId
      },
      include: {
        matchedPatient: true
      }
    });

    // Update batch counter if status transitioned to APPROVED
    if (status === 'APPROVED' || status === 'SKIPPED') {
      const allBatchRecords = await prisma.historicalMigrationRecord.findMany({
        where: { batchId: existingRecord.batchId },
        select: { status: true }
      });
      const approvedCount = allBatchRecords.filter(r => r.status === 'APPROVED').length;
      const skippedCount = allBatchRecords.filter(r => r.status === 'SKIPPED').length;
      await prisma.historicalMigrationBatch.update({
        where: { id: existingRecord.batchId },
        data: {
          approvedRecords: approvedCount,
          skippedRecords: skippedCount
        }
      });
    }

    return res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const resolveDuplicate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recordId = req.params.recordId as string;
    const { duplicateResolution, matchedPatientId } = req.body;

    if (!duplicateResolution || !['CREATE_NEW', 'USE_EXISTING', 'SKIP'].includes(duplicateResolution)) {
      return res.status(400).json({ error: 'Valid duplicateResolution (CREATE_NEW | USE_EXISTING | SKIP) is required.' });
    }

    if (duplicateResolution === 'USE_EXISTING' && !matchedPatientId) {
      return res.status(400).json({ error: 'matchedPatientId is required when duplicateResolution is USE_EXISTING.' });
    }

    const updated = await prisma.historicalMigrationRecord.update({
      where: { id: recordId },
      data: {
        duplicateResolution,
        matchedPatientId: duplicateResolution === 'USE_EXISTING' ? matchedPatientId : null
      }
    });

    return res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const importApprovedBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batchId = req.params.batchId as string;
    const summary = await HistoricalImportService.importBatch(batchId);
    return res.json(summary);
  } catch (error) {
    next(error);
  }
};
