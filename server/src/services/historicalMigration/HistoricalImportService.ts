import { prisma } from '../../db';

export interface BatchImportSummary {
  batchId: string;
  totalApproved: number;
  patientsCreated: number;
  visitsImported: number;
  recordsSkipped: number;
  errors: Array<{ recordId: string; error: string }>;
}

export class HistoricalImportService {
  public static readonly CHUNK_SIZE = 25;

  /**
   * Executes transactional import of all APPROVED records in a batch.
   * Processes in chunks of 25 records to maintain transactional safety and bounded latency.
   * 
   * Strict Invariant:
   * Only Patient (for CREATE_NEW) and Visit records are created.
   * Delta for Appointment, Consultation, Prescription, Payment, TreatmentPlan, and Notification is strictly 0.
   */
  static async importBatch(batchId: string): Promise<BatchImportSummary> {
    const batch = await prisma.historicalMigrationBatch.findUnique({
      where: { id: batchId }
    });

    if (!batch) {
      throw new Error(`Migration batch not found: ${batchId}`);
    }

    // Update batch status to IMPORTING
    await prisma.historicalMigrationBatch.update({
      where: { id: batchId },
      data: { status: 'IMPORTING' }
    });

    const approvedRecords = await prisma.historicalMigrationRecord.findMany({
      where: {
        batchId,
        status: 'APPROVED'
      },
      orderBy: { pageNumber: 'asc' }
    });

    const summary: BatchImportSummary = {
      batchId,
      totalApproved: approvedRecords.length,
      patientsCreated: 0,
      visitsImported: 0,
      recordsSkipped: 0,
      errors: []
    };

    // Process records atomically per record for strict fault isolation
    for (const record of approvedRecords) {
      try {
        await prisma.$transaction(async (tx) => {
          // Mandatory Pre-Import Validation
          if (!record.reviewedName || !record.reviewedName.trim()) {
            throw new Error(`Record #${record.pageNumber} is missing required Patient Name.`);
          }
          if (!record.reviewedVisitDate) {
            throw new Error(`Record #${record.pageNumber} is missing required Visit Date.`);
          }

          const resolution = record.duplicateResolution || 'CREATE_NEW';

          if (resolution === 'SKIP') {
            await tx.historicalMigrationRecord.update({
              where: { id: record.id },
              data: { status: 'SKIPPED' }
            });
            summary.recordsSkipped++;
            return;
          }

          let targetPatientId = record.matchedPatientId;

          // 1. Create Patient if CREATE_NEW or if matched patient is invalid
          if (resolution === 'CREATE_NEW' || !targetPatientId) {
            const cleanPhone = record.reviewedPhone ? record.reviewedPhone.trim() : null;
            if (cleanPhone) {
              const existingWithPhone = await tx.patient.findFirst({
                where: { phone: cleanPhone }
              });
              if (existingWithPhone) {
                throw new Error(`Cannot create new patient: Phone ${cleanPhone} already belongs to patient ${existingWithPhone.name}. Resolve phone conflict before import.`);
              }
            }

            const newPatient = await tx.patient.create({
              data: {
                name: record.reviewedName.trim(),
                phone: cleanPhone,                    // Nullable, never fake phone
                age: record.reviewedAge ?? null,      // Nullable, never fake 0
                gender: record.reviewedGender ?? null,// Nullable, never fake "Unknown"
                status: 'Active',
                preferredCommunicationChannel: 'AUTO'
              }
            });
            targetPatientId = newPatient.id;
            summary.patientsCreated++;
          }

          // 2. Create Historical Visit
          const historicalVisit = await tx.visit.create({
            data: {
              patientId: targetPatientId,
              status: 'COMPLETED',
              visitDate: record.reviewedVisitDate, // Actual clinical historical date
              reasonForVisit: record.reviewedReason || null, // Clean null
              amountDue: 0,
              consultationFee: 0,
              treatmentFee: 0,
              medicineCost: 0,
              paymentOwner: 'RECEPTION',
              createdAt: new Date() // Actual database ingestion audit timestamp
            }
          });

          // 3. Mark Record as IMPORTED
          await tx.historicalMigrationRecord.update({
            where: { id: record.id },
            data: {
              status: 'IMPORTED',
              importedPatientId: targetPatientId,
              importedVisitId: historicalVisit.id,
              importedAt: new Date()
            }
          });

          summary.visitsImported++;
        });
      } catch (recError: any) {
        console.error(`[HistoricalImportService] Record ${record.id} import error:`, recError);
        summary.errors.push({
          recordId: record.id,
          error: recError.message || 'Unknown import error'
        });

        await prisma.historicalMigrationRecord.update({
          where: { id: record.id },
          data: {
            status: 'FAILED',
            errorMessage: recError.message || 'Import error'
          }
        });
      }
    }

    // Refresh final counts on batch
    const allRecords = await prisma.historicalMigrationRecord.findMany({
      where: { batchId },
      select: { status: true }
    });

    const importedCount = allRecords.filter(r => r.status === 'IMPORTED').length;
    const skippedCount = allRecords.filter(r => r.status === 'SKIPPED').length;
    const failedCount = allRecords.filter(r => r.status === 'FAILED').length;
    const remainingToReview = allRecords.filter(r => r.status === 'NEEDS_REVIEW' || r.status === 'PENDING_OCR').length;

    const finalStatus = remainingToReview > 0 
      ? 'AWAITING_REVIEW' 
      : failedCount > 0 
        ? 'COMPLETED' 
        : 'COMPLETED';

    await prisma.historicalMigrationBatch.update({
      where: { id: batchId },
      data: {
        status: finalStatus,
        importedRecords: importedCount,
        skippedRecords: skippedCount,
        failedRecords: failedCount
      }
    });

    return summary;
  }
}
