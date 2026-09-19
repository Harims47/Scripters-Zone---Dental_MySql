import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { reimbursementBodySchema } from '../schemas/reimbursementSchema';
import { generateReimbursementPDF } from '../services/documentService';
import { getClinicBranding } from '../services/pdf/clinicBranding';

/**
 * Concurrency-safe helper to generate sequential document number: RMB-YYYY-XXXXXX
 */
async function generateDocumentNumber(tx: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RMB-${year}-`;

  const lastDoc = await tx.reimbursementDocument.findFirst({
    where: { documentNumber: { startsWith: prefix } },
    orderBy: { documentNumber: 'desc' },
    select: { documentNumber: true }
  });

  let nextSeq = 1;
  if (lastDoc && lastDoc.documentNumber) {
    const parts = lastDoc.documentNumber.split('-');
    const seqStr = parts[parts.length - 1];
    const parsed = parseInt(seqStr, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
}

export const getReimbursements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search = (req.query.search as string || '').trim();
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { documentNumber: { contains: search } },
        { patientNameSnapshot: { contains: search } },
        { patientPhoneSnapshot: { contains: search } },
        { subject: { contains: search } }
      ];
    }

    const [total, documents] = await Promise.all([
      prisma.reimbursementDocument.count({ where }),
      prisma.reimbursementDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              phone: true,
              age: true,
              gender: true
            }
          }
        }
      })
    ]);

    return res.json({
      success: true,
      data: documents,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getReimbursementById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const document = await prisma.reimbursementDocument.findUnique({
      where: { id },
      include: {
        patient: true
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Reimbursement document not found' });
    }

    // PaymentOwner security boundary check if visit is linked
    if (document.visitId && req.user?.role === 'Receptionist') {
      const visit = await prisma.visit.findUnique({ where: { id: document.visitId } });
      if (visit && visit.paymentOwner === 'DOCTOR') {
        return res.status(403).json({ error: 'Forbidden: Access to doctor-owned financial records is restricted' });
      }
    }

    return res.json({ success: true, data: document });
  } catch (error) {
    next(error);
  }
};

export const createReimbursement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = reimbursementBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      });
    }

    const {
      patientId,
      documentDate,
      subject,
      content,
      treatmentDescription,
      amount,
      visitId,
      clinicName: customClinicName,
      clinicAddress: customClinicAddress,
      clinicPhone: customClinicPhone
    } = parseResult.data;

    // 1. Verify Patient exists
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // 2. If visitId provided, verify visit & respect paymentOwner security
    if (visitId) {
      const visit = await prisma.visit.findUnique({ where: { id: visitId } });
      if (!visit) {
        return res.status(404).json({ error: 'Referenced visit not found' });
      }
      if (visit.patientId !== patientId) {
        return res.status(400).json({ error: 'Referenced visit does not belong to the selected patient' });
      }
      if (visit.paymentOwner === 'DOCTOR' && req.user?.role === 'Receptionist') {
        return res.status(403).json({ error: 'Forbidden: Access to doctor-owned records is restricted' });
      }
    }

    // 3. Resolve logged-in Doctor information
    let doctorName = req.user?.staff?.name || req.user?.username || 'Doctor';
    if (!doctorName.startsWith('Dr.')) {
      doctorName = `Dr. ${doctorName}`;
    }
    const doctorRegNo = req.user?.staff?.permissions?.regNo || null;
    const doctorId = req.user?.staffId || req.user?.id || null;

    // 4. Resolve Clinic metadata (prefer client passed or authoritative configuration)
    const defaultBranding = getClinicBranding();
    const clinicNameSnapshot = customClinicName?.trim() || defaultBranding.name;
    const clinicAddressSnapshot = customClinicAddress?.trim() || defaultBranding.address || '';
    const clinicPhoneSnapshot = customClinicPhone?.trim() || defaultBranding.phone || '';

    // 5. Atomic creation with retry protection against sequence race condition
    let createdDoc: any = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts && !createdDoc) {
      try {
        createdDoc = await prisma.$transaction(async (tx) => {
          const documentNumber = await generateDocumentNumber(tx);

          return tx.reimbursementDocument.create({
            data: {
              documentNumber,
              patientId,
              doctorId,
              visitId: visitId || null,
              documentDate,
              subject,
              content,
              treatmentDescription: treatmentDescription || null,
              amount: amount !== undefined && amount !== null ? Number(amount) : null,
              patientNameSnapshot: patient.name,
              patientAgeSnapshot: patient.age || null,
              patientGenderSnapshot: patient.gender || null,
              patientPhoneSnapshot: patient.phone || null,
              doctorNameSnapshot: doctorName,
              doctorRegNoSnapshot: doctorRegNo,
              clinicNameSnapshot,
              clinicAddressSnapshot,
              clinicPhoneSnapshot,
              status: 'Issued'
            },
            include: {
              patient: true
            }
          });
        });
      } catch (txError: any) {
        if (txError.code === 'P2002' && attempts < maxAttempts - 1) {
          // Unique constraint on documentNumber collided; retry with next sequence
          attempts++;
        } else {
          throw txError;
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Reimbursement document created successfully',
      data: createdDoc
    });
  } catch (error) {
    next(error);
  }
};

export const downloadReimbursementPDF = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const doc = await prisma.reimbursementDocument.findUnique({
      where: { id }
    });

    if (!doc) {
      return res.status(404).json({ error: 'Reimbursement document not found' });
    }

    // PaymentOwner security boundary check if visit is linked
    if (doc.visitId && req.user?.role === 'Receptionist') {
      const visit = await prisma.visit.findUnique({ where: { id: doc.visitId } });
      if (visit && visit.paymentOwner === 'DOCTOR') {
        return res.status(403).json({ error: 'Forbidden: Access to doctor-owned financial records is restricted' });
      }
    }

    const pdfBuffer = await generateReimbursementPDF({
      documentNumber: doc.documentNumber,
      documentDate: doc.documentDate,
      subject: doc.subject,
      content: doc.content,
      treatmentDescription: doc.treatmentDescription,
      amount: doc.amount,
      patientName: doc.patientNameSnapshot,
      patientAge: doc.patientAgeSnapshot,
      patientGender: doc.patientGenderSnapshot,
      patientPhone: doc.patientPhoneSnapshot,
      doctorName: doc.doctorNameSnapshot,
      doctorRegNo: doc.doctorRegNoSnapshot || undefined,
      clinicName: doc.clinicNameSnapshot,
      clinicAddress: doc.clinicAddressSnapshot,
      clinicPhone: doc.clinicPhoneSnapshot
    });

    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', `inline; filename="${doc.documentNumber}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

export const updateReimbursement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.reimbursementDocument.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Reimbursement document not found' });
    }

    const {
      documentDate,
      subject,
      content,
      treatmentDescription,
      amount,
      clinicName,
      clinicAddress,
      clinicPhone
    } = req.body;

    const updated = await prisma.reimbursementDocument.update({
      where: { id },
      data: {
        ...(documentDate ? { documentDate } : {}),
        ...(subject ? { subject: subject.trim() } : {}),
        ...(content ? { content: content.trim() } : {}),
        ...(treatmentDescription !== undefined ? { treatmentDescription: treatmentDescription?.trim() || null } : {}),
        ...(amount !== undefined ? { amount: amount !== null ? Number(amount) : null } : {}),
        ...(clinicName ? { clinicNameSnapshot: clinicName.trim() } : {}),
        ...(clinicAddress ? { clinicAddressSnapshot: clinicAddress.trim() } : {}),
        ...(clinicPhone ? { clinicPhoneSnapshot: clinicPhone.trim() } : {})
      },
      include: {
        patient: true
      }
    });

    return res.json({
      success: true,
      message: 'Reimbursement document updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const deleteReimbursement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.reimbursementDocument.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Reimbursement document not found' });
    }

    await prisma.reimbursementDocument.delete({
      where: { id }
    });

    return res.json({
      success: true,
      message: 'Reimbursement document deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

