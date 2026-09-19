import { Request, Response } from 'express';
import { prisma } from '../db';
import {
  generatePrescriptionPDF,
  generateReceiptPDF,
  generateInvoicePDF,
  generatePurchaseOrderPDF
} from '../services/documentService';
import { getClinicBranding } from '../services/pdf/clinicBranding';

export const getPrescriptionPDF = async (req: Request, res: Response) => {
  try {
    const visitId = req.params.visitId as string;

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: true,
        consultation: true,
        prescription: {
          include: {
            items: {
              include: { medicine: true }
            }
          }
        }
      }
    }) as any;

    if (!visit || !visit.prescription) {
      return res.status(404).json({ error: 'Prescription not found for this visit.' });
    }

    const staff = visit.doctorId ? await prisma.staff.findUnique({
      where: { id: visit.doctorId }
    }) : null;

    const branding = getClinicBranding();

    const prescriptionData = {
      clinicName: branding.name,
      clinicAddress: branding.address,
      clinicPhone: branding.phone,
      patientName: visit.patient.name,
      patientAge: visit.patient.age || '',
      patientGender: visit.patient.gender || '',
      patientPhone: visit.patient.phone,
      diagnosis: visit.consultation?.reasonForVisit || visit.reasonForVisit || undefined,
      visitDate: visit.createdAt ? new Date(visit.createdAt).toISOString() : new Date().toISOString(),
      doctorName: staff ? staff.name : 'Doctor',
      items: visit.prescription.items.map((item: any) => ({
        medicineName: item.medicine?.name || 'Medicine',
        quantity: item.quantity,
        dosage: item.dosage || undefined,
        frequency: item.frequency || undefined,
        duration: item.duration || undefined,
        instructions: item.instructions || undefined
      }))
    };

    const pdfBuffer = await generatePrescriptionPDF(prescriptionData);

    const safePatientName = (visit.patient.name || 'Patient').replace(/[^a-zA-Z0-9]/g, '_');
    const docCode = visit.id.substring(0, 8).toUpperCase();

    res.header('Content-Type', 'application/pdf');
    res.attachment(`prescription_${safePatientName}_${docCode}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating prescription PDF:', error);
    res.status(500).json({ error: 'Failed to generate prescription PDF' });
  }
};

export const getReceiptPDF = async (req: Request, res: Response) => {
  try {
    const visitId = req.params.visitId as string;
    const requestedPaymentId = (req.query.paymentId as string) || undefined;

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: true,
        payments: {
          orderBy: { createdAt: 'asc' }
        },
        consultation: true,
        completedTreatmentItems: {
          include: { catalogItem: true }
        },
        dispensing: {
          include: {
            items: {
              include: { medicine: true }
            }
          }
        }
      }
    }) as any;

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found.' });
    }

    // Security Check: If visit is doctor-owned, Receptionists are prohibited from accessing receipt data
    if (visit.paymentOwner === 'DOCTOR' && req.user?.role === 'Receptionist') {
      return res.status(403).json({
        error: 'Access denied: Payment and receipt details for this doctor-owned visit are restricted from Reception.',
      });
    }

    // Fetch doctor name
    let doctorName = 'Doctor';
    if (visit.doctorId) {
      const doctorStaff = await prisma.staff.findUnique({
        where: { id: visit.doctorId }
      });
      if (doctorStaff) doctorName = doctorStaff.name;
    }

    const validPayments = (visit.payments || []).filter(
      (p: any) => p.status === 'Paid' || p.status === 'Completed'
    );

    let payment = null;
    let paymentIndex = -1;
    if (requestedPaymentId) {
      paymentIndex = validPayments.findIndex((p: any) => p.id === requestedPaymentId);
      if (paymentIndex !== -1) {
        payment = validPayments[paymentIndex];
      }
    }
    if (!payment) {
      payment = validPayments.length > 0 ? validPayments[validPayments.length - 1] : null;
      paymentIndex = validPayments.length - 1;
    }

    if (!payment) {
      return res.status(400).json({ error: 'Payment is not completed. Cannot generate receipt.' });
    }

    // Authoritative visit charges
    const consultationFee = visit.consultationFee || 0;
    const treatmentFee = visit.treatmentFee || 0;

    let calculatedMedicineCost = 0;
    if (visit.dispensing && visit.dispensing.items) {
      calculatedMedicineCost = visit.dispensing.items.reduce(
        (sum: number, item: any) => sum + ((item.dispensedQuantity || item.prescribedQuantity || 0) * (item.medicine?.unitPrice || 0)),
        0
      );
    }
    const medicineCost = visit.medicineCost ?? calculatedMedicineCost;
    const grossTotal = consultationFee + treatmentFee + medicineCost;

    // Prior payments made before this installment
    const priorPaid = validPayments.slice(0, paymentIndex).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const cumulativePaid = priorPaid + payment.amount;
    const balanceDue = Math.max(0, grossTotal - cumulativePaid);
    const isPartial = balanceDue > 0;

    const branding = getClinicBranding();
    const receiptNo = payment.id ? `RCPT-${payment.id.substring(0, 8).toUpperCase()}` : 'RCPT-001';

    const receiptData = {
      clinicName: branding.name,
      clinicAddress: branding.address,
      clinicPhone: branding.phone,
      patientName: visit.patient.name,
      patientAge: visit.patient?.age ?? undefined,
      patientGender: visit.patient?.gender || undefined,
      patientPhone: visit.patient.phone,
      visitDate: visit.createdAt ? new Date(visit.createdAt).toISOString() : new Date().toISOString(),
      doctorName,
      consultationFee,
      treatmentFee,
      medicineCost,
      totalAmount: grossTotal > 0 ? grossTotal : payment.amount,
      amountPaid: payment.amount,
      priorPaid,
      cumulativePaid,
      balanceDue,
      isPartial,
      paymentNumber: paymentIndex >= 0 ? paymentIndex + 1 : 1,
      totalPaymentsCount: validPayments.length,
      paymentMethod: payment.method || 'Cash',
      paymentDate: payment.date ? new Date(payment.date).toISOString() : (payment.createdAt ? new Date(payment.createdAt).toISOString() : new Date().toISOString()),
      paymentStatus: isPartial ? 'Partially Paid' : 'Paid',
      paymentNotes: payment.notes || undefined,
      receiptNo,
      receivedBy: req.user?.username || 'Staff',
    };

    const pdfBuffer = await generateReceiptPDF(receiptData);

    res.header('Content-Type', 'application/pdf');
    res.attachment(`receipt_${receiptNo}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    res.status(500).json({ error: 'Failed to generate receipt PDF' });
  }
};

export const getInvoicePDF = async (req: Request, res: Response) => {
  try {
    const visitId = req.params.visitId as string;

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: true,
        consultation: true,
        payments: {
          orderBy: { createdAt: 'asc' }
        },
        completedTreatmentItems: {
          include: { catalogItem: true }
        },
        dispensing: {
          include: {
            items: {
              include: { medicine: true }
            }
          }
        }
      }
    }) as any;

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found.' });
    }

    // Security Check: If visit is doctor-owned, Receptionists are prohibited from accessing invoice data
    if (visit.paymentOwner === 'DOCTOR' && req.user?.role === 'Receptionist') {
      return res.status(403).json({
        error: 'Access denied: Invoice and financial details for this doctor-owned visit are restricted from Reception.',
        message: 'Handled by Doctor'
      });
    }

    // Fetch doctor name
    let doctorName = 'Doctor';
    if (visit.doctorId) {
      const doctorStaff = await prisma.staff.findUnique({
        where: { id: visit.doctorId }
      });
      if (doctorStaff) doctorName = doctorStaff.name;
    }

    const consultationFee = visit.consultationFee || 0;
    const treatmentFee = visit.treatmentFee || 0;

    let calculatedMedicineCost = 0;
    const medicines = (visit.dispensing?.items || []).map((item: any) => {
      const qty = item.dispensedQuantity || item.prescribedQuantity || 0;
      const unitPrice = item.medicine?.unitPrice || 0;
      const total = qty * unitPrice;
      calculatedMedicineCost += total;
      return {
        name: item.medicine?.name || 'Medicine',
        quantity: qty,
        unitPrice,
        total
      };
    });

    const medicineCost = visit.medicineCost ?? calculatedMedicineCost;
    const grossTotal = consultationFee + treatmentFee + medicineCost;

    const validPayments = (visit.payments || []).filter((p: any) => p.status === 'Paid' || p.status === 'Completed');
    const paidTotal = validPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const amountDue = Math.max(0, grossTotal - paidTotal);

    const treatments = (visit.completedTreatmentItems || []).map((t: any) => ({
      name: t.catalogItem?.name || 'Dental Procedure',
      category: t.catalogItem?.category,
      notes: t.notes || undefined,
    }));

    const payments = validPayments.map((p: any) => ({
      receiptNo: p.id ? `RCPT-${p.id.substring(0, 8).toUpperCase()}` : 'RCPT',
      date: p.date ? new Date(p.date).toISOString() : new Date(p.createdAt).toISOString(),
      method: p.method || 'Cash',
      amount: p.amount || 0
    }));

    const status = amountDue === 0 ? 'Fully Paid' : paidTotal > 0 ? 'Partially Paid' : 'Unpaid';
    const invoiceNumber = `INV-${visit.id.substring(0, 8).toUpperCase()}`;

    const branding = getClinicBranding();

    const pdfBuffer = await generateInvoicePDF({
      clinicName: branding.name,
      clinicAddress: branding.address,
      clinicPhone: branding.phone,
      invoiceNumber,
      visitDate: visit.createdAt ? new Date(visit.createdAt).toISOString() : new Date().toISOString(),
      patientName: visit.patient.name,
      patientAge: visit.patient?.age ?? undefined,
      patientGender: visit.patient?.gender || undefined,
      patientPhone: visit.patient.phone,
      doctorName,
      consultationFee,
      treatmentFee,
      medicineCost,
      totalAmount: grossTotal,
      amountPaid: paidTotal,
      amountDue,
      status,
      treatments,
      medicines,
      payments
    });

    res.header('Content-Type', 'application/pdf');
    res.attachment(`invoice_${invoiceNumber}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
};

export const getPurchaseOrderPDF = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: { medicine: true }
        }
      }
    }) as any;

    if (!po) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    const branding = getClinicBranding();

    const pdfBuffer = await generatePurchaseOrderPDF({
      clinicName: branding.name,
      orderNumber: po.orderNumber,
      orderDate: po.orderDate ? new Date(po.orderDate).toISOString() : new Date().toISOString(),
      supplierName: po.supplier?.name || 'Supplier',
      supplierEmail: po.supplier?.email || undefined,
      supplierPhone: po.supplier?.phone || undefined,
      items: (po.items || []).map((item: any) => ({
        medicineName: item.medicine?.name || 'Item',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.totalAmount || (item.quantity * item.unitPrice),
      })),
      totalAmount: po.totalAmount,
      expectedDate: po.expectedDate ? new Date(po.expectedDate).toISOString() : undefined,
      notes: po.notes || undefined,
    });

    res.header('Content-Type', 'application/pdf');
    res.attachment(`purchase_order_${po.orderNumber}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating purchase order PDF:', error);
    res.status(500).json({ error: 'Failed to generate purchase order PDF' });
  }
};
