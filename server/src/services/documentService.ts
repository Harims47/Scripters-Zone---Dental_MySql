import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { PDF_THEME } from './pdf/pdfTheme';
import {
  ClinicBranding,
  getClinicBranding,
  formatCurrency,
  formatHumanDate,
  resolveLogoPath,
  cleanDoctorName,
  numberToWordsIndian,
  formatStaffRoleOrName
} from './pdf/clinicBranding';
import {
  initPDFDocument,
  renderClinicHeader,
  renderDocumentTitle,
  renderDocumentMetadata,
  renderPatientInformation,
  renderUnifiedInfoCard,
  renderSectionHeader,
  renderFinancialSummary,
  renderSignatureBlock,
  finalizeDocumentWithFooters
} from './pdf/pdfComponents';

export { resolveLogoPath };

export interface PrescriptionData {
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  patientName: string;
  patientId?: string; // accepted in data payload, NEVER exposed on PDF
  patientPhone?: string;
  patientAge?: number | string;
  patientGender?: string;
  visitDate: string;
  visitId?: string; // accepted in data payload, NEVER exposed on PDF
  doctorName?: string;
  diagnosis?: string;
  items: {
    medicineName: string;
    quantity: number;
    dosage?: string;
    duration?: string;
    frequency?: string;
    instructions?: string;
  }[];
}

export interface ReceiptData {
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  patientName: string;
  patientAge?: number | string;
  patientGender?: string;
  patientId?: string; // NEVER exposed on PDF
  patientPhone?: string;
  visitId?: string;   // NEVER exposed on PDF
  visitDate: string;
  consultationFee: number;
  treatmentFee?: number;
  medicineCost: number;
  totalAmount: number;
  amountPaid: number;
  priorPaid?: number;
  cumulativePaid?: number;
  balanceDue?: number;
  isPartial?: boolean;
  paymentNumber?: number;
  totalPaymentsCount?: number;
  paymentMethod: string;
  paymentDate: string;
  paymentStatus: string;
  receiptNo: string;
  receivedBy: string;
  doctorName?: string;
  paymentNotes?: string;
}

export interface InvoiceData {
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  invoiceNumber: string;
  visitId?: string;   // NEVER exposed on PDF
  visitDate: string;
  patientName: string;
  patientAge?: number | string;
  patientGender?: string;
  patientId?: string; // NEVER exposed on PDF
  patientPhone?: string;
  doctorName?: string;
  consultationFee: number;
  treatmentFee: number;
  medicineCost: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: string;
  treatments?: {
    name: string;
    category?: string;
    notes?: string;
    fee?: number;
  }[];
  medicines?: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  payments?: {
    receiptNo: string;
    date: string;
    method: string;
    amount: number;
  }[];
}

export interface PurchaseOrderData {
  clinicName?: string;
  orderNumber: string;
  orderDate: string;
  supplierName: string;
  supplierEmail?: string;
  supplierPhone?: string;
  items: {
    medicineName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  totalAmount: number;
  expectedDate?: string;
  notes?: string;
}

export interface ReimbursementPDFData {
  documentNumber: string;
  documentDate: string;
  subject: string;
  content: string;
  treatmentDescription?: string | null;
  amount?: number | null;
  patientName: string;
  patientAge?: number | string | null;
  patientGender?: string | null;
  patientPhone?: string | null;
  doctorName?: string | null;
  doctorRegNo?: string | null;
  clinicName?: string | null;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
}

// ══════════════════════════════════════════════════════════════════════════
// 1. PRESCRIPTION PDF GENERATOR
// ══════════════════════════════════════════════════════════════════════════
export const generatePrescriptionPDF = (data: PrescriptionData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = initPDFDocument({ size: 'A4', margin: 0 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const branding = getClinicBranding({
      name: data.clinicName,
      address: data.clinicAddress,
      phone: data.clinicPhone
    });

    const W = doc.page.width;   // 595.28
    const H = doc.page.height;  // 841.89
    const GRN = '#1A5C1A';      // Dark clinical green matching physical sheet
    const GRN_LIGHT = '#E6F4E6';
    const BDR = 12;             // Page border inset

    // Frequency / Instructions -> time slot resolver
    const resolveSlots = (freq: string, dosage: string, instructions?: string) => {
      const f = (freq || '').toLowerCase().trim();
      const inst = (instructions || '').toLowerCase().trim();
      const qty = (dosage || '').match(/^(\d+)/)?.[1] ?? '1';
      const e = (s: string) => s ? qty : '';

      const hasBreakfast = /breakfast/i.test(inst);
      const hasLunch = /lunch/i.test(inst);
      const hasDinner = /dinner/i.test(inst);

      if (hasBreakfast || hasLunch || hasDinner) {
        return {
          m: hasBreakfast ? qty : '',
          a: hasLunch ? qty : '',
          ev: '',
          n: hasDinner ? qty : ''
        };
      }

      if (/four|qid|4.time|1-1-1-1/i.test(f)) return { m: qty, a: qty, ev: qty, n: qty };
      if (/three|tds|tid|thrice|1-1-1/i.test(f)) return { m: qty, a: qty, ev: '', n: qty };
      if (/twice|two|bd|bid|1-0-1/i.test(f)) return { m: qty, a: '', ev: '', n: qty };
      if (/once|od|morning only|1-0-0/i.test(f)) return { m: qty, a: '', ev: '', n: '' };
      if (/night|bedtime|hs/i.test(f)) return { m: '', a: '', ev: '', n: qty };
      if (/morning/i.test(f)) return { m: qty, a: '', ev: '', n: '' };
      if (/afternoon/i.test(f)) return { m: '', a: qty, ev: '', n: '' };
      if (/evening/i.test(f)) return { m: '', a: '', ev: qty, n: '' };
      return { m: e(qty), a: '', ev: '', n: '' };
    };

    const resolveFood = (instructions: string) => {
      const i = (instructions || '').toLowerCase();
      const hasBefore = /before/i.test(i) || /empty|bf/i.test(i);
      const hasAfter = /after/i.test(i) || /pc|af/i.test(i);
      return {
        bf: hasBefore ? '\u2714' : '',
        af: hasAfter ? '\u2714' : ''
      };
    };

    const drEn = cleanDoctorName(data.doctorName);

    // ── PAGE 1: PRESCRIPTION FRONT ──────────────────────────────────────────
    // Double clinical border
    doc.rect(BDR, BDR, W - BDR * 2, H - BDR * 2).lineWidth(2.0).strokeColor(GRN).stroke();
    doc.rect(BDR + 3, BDR + 3, W - BDR * 2 - 6, H - BDR * 2 - 6).lineWidth(0.6).strokeColor(GRN).stroke();

    const hLeft = BDR + 8;
    const hRight = W - BDR - 8;
    const hY = BDR + 8;

    // Left Header: Doctor & Clinic Details (English)
    doc.font(PDF_THEME.fonts.bold).fontSize(12).fillColor(GRN).text(drEn, hLeft, hY);
    doc.font(PDF_THEME.fonts.regular).fontSize(8.5).fillColor(GRN)
      .text('Dental Surgeon', hLeft, hY + 16)
      .text(branding.name, hLeft, hY + 28, { width: 210 });
    if (branding.address) {
      doc.text(branding.address, hLeft, hY + 40, { width: 210 });
    }
    if (branding.phone) {
      doc.text(`Phone : ${branding.phone}`, hLeft, hY + 54);
    }

    // Right Header: Doctor & Clinic Details (Tamil)
    const rW = 210;
    const rX = hRight - rW;
    doc.font(PDF_THEME.fonts.tamilBold).fontSize(12).fillColor(GRN).text(drEn, rX, hY, { width: rW, align: 'right' });
    doc.font(PDF_THEME.fonts.tamilRegular).fontSize(8.5).fillColor(GRN)
      .text('பல் மருத்துவர்', rX, hY + 16, { width: rW, align: 'right' })
      .text(branding.name, rX, hY + 28, { width: rW, align: 'right' });
    if (branding.address) {
      doc.text(branding.address, rX, hY + 40, { width: rW, align: 'right' });
    }
    if (branding.phone) {
      doc.text(`தொலைபேசி : ${branding.phone}`, rX, hY + 54, { width: rW, align: 'right' });
    }

    // Center: Clinic Logo if available, else clinical badge
    const lcx = W / 2;
    if (branding.logoPath && fs.existsSync(branding.logoPath)) {
      try {
        doc.image(branding.logoPath, lcx - 22, hY + 4, { height: 44 });
      } catch {
        doc.circle(lcx, hY + 28, 18).lineWidth(1.2).strokeColor(GRN).stroke();
      }
    } else {
      doc.circle(lcx, hY + 28, 18).lineWidth(1.2).strokeColor(GRN).stroke();
      doc.font(PDF_THEME.fonts.bold).fontSize(20).fillColor(GRN).text('+', lcx - 7, hY + 15, { width: 14 });
    }

    // Separator line
    const sep1Y = hY + 74;
    doc.moveTo(hLeft, sep1Y).lineTo(hRight, sep1Y).lineWidth(1.2).strokeColor(GRN).stroke();

    // Date & Diagnosis Row
    const dateY = sep1Y + 5;
    doc.font(PDF_THEME.fonts.tamilRegular).fontSize(8.5).fillColor(GRN).text('ஞாயிறு விடுமுறை', hLeft, dateY);
    doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor(GRN).text('Date :', W / 2 - 70, dateY);
    doc.font(PDF_THEME.fonts.regular).fontSize(9).fillColor('#000000')
      .text(formatHumanDate(data.visitDate), W / 2 - 40, dateY, { width: 90 });

    if (data.diagnosis) {
      doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor(GRN).text('DIAGNOSIS :', W / 2 + 55, dateY);
      doc.font(PDF_THEME.fonts.regular).fontSize(8.5).fillColor('#111111')
        .text(data.diagnosis, W / 2 + 120, dateY, { width: W - (W / 2 + 120) - BDR - 8, ellipsis: true });
    }

    const sep2Y = dateY + 16;
    doc.moveTo(hLeft, sep2Y).lineTo(hRight, sep2Y).lineWidth(0.8).strokeColor(GRN).stroke();

    // Patient Details Row (Strictly NO database UUID)
    const patY = sep2Y + 5;
    doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor(GRN).text('PATIENT NAME :', hLeft, patY);
    doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor('#000000')
      .text(data.patientName || 'Patient', hLeft + 96, patY, { width: 190 });

    doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor(GRN).text('AGE :', hLeft + 295, patY);
    doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor('#000000')
      .text(String(data.patientAge ? `${data.patientAge} Y` : '—'), hLeft + 325, patY, { width: 35 });

    doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor(GRN).text('GENDER :', hLeft + 365, patY);
    doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor('#000000')
      .text(String(data.patientGender || '—'), hLeft + 415, patY, { width: 60 });

    const sep3Y = patY + 16;
    doc.moveTo(hLeft, sep3Y).lineTo(hRight, sep3Y).lineWidth(0.8).strokeColor(GRN).stroke();

    // Medicine Table Layout
    const tblTop = sep3Y;
    const tblLeft = hLeft;
    const tblRt = hRight;
    const tblW = tblRt - tblLeft;

    const cT = 50; // time column width (x4 = 200)
    const cF = 52; // food column (x2 = 104)
    const cMedW = tblW - cT * 4 - cF * 2;

    const xMed = tblLeft;
    const xMorn = xMed + cMedW;
    const xAftn = xMorn + cT;
    const xEvng = xAftn + cT;
    const xNgt = xEvng + cT;
    const xBf = xNgt + cT;
    const xAf = xBf + cF;

    // Header Row
    const hdrH = 28;
    doc.fillColor(GRN_LIGHT).rect(tblLeft, tblTop, tblW, hdrH).fill();

    // Vertical dividers in header
    [xMorn, xAftn, xEvng, xNgt, xBf, xAf].forEach(x => {
      doc.moveTo(x, tblTop).lineTo(x, tblTop + hdrH).lineWidth(0.6).strokeColor(GRN).stroke();
    });

    // Time headers (Tamil)
    doc.font(PDF_THEME.fonts.tamilBold).fontSize(8.5).fillColor(GRN);
    doc.text('காலை', xMorn + 2, tblTop + 3, { width: cT, align: 'center' });
    doc.text('மதியம்', xAftn + 2, tblTop + 3, { width: cT, align: 'center' });
    doc.text('மாலை', xEvng + 2, tblTop + 3, { width: cT, align: 'center' });
    doc.text('இரவு', xNgt + 2, tblTop + 3, { width: cT, align: 'center' });

    // Food headers (Tamil)
    doc.font(PDF_THEME.fonts.tamilBold).fontSize(8).fillColor(GRN)
      .text('உணவுக்கு', xBf, tblTop + 2, { width: cF * 2, align: 'center' });
    doc.font(PDF_THEME.fonts.tamilRegular).fontSize(8).fillColor(GRN)
      .text('முன்', xBf, tblTop + 15, { width: cF, align: 'center' });
    doc.font(PDF_THEME.fonts.tamilRegular).fontSize(8).fillColor(GRN)
      .text('பின்', xAf, tblTop + 15, { width: cF, align: 'center' });
    doc.moveTo(xBf, tblTop + 14).lineTo(xAf + cF, tblTop + 14).lineWidth(0.4).strokeColor(GRN).stroke();

    doc.rect(tblLeft, tblTop, tblW, hdrH).lineWidth(0.8).strokeColor(GRN).stroke();

    // Rx Symbol
    const rowY = tblTop + hdrH;
    doc.font(PDF_THEME.fonts.bold).fontSize(18).fillColor(GRN).text('Rx', tblLeft + 3, rowY + 4, { width: 28 });

    // Medicine Rows
    const bodyBase = rowY;
    const filled = data.items.length;
    const availH = H - BDR - 55 - bodyBase;
    const rowH = filled > 10 ? Math.max(22, Math.floor(availH / Math.min(filled + 1, 16))) : 30;
    const totalRows = Math.max(filled + 2, Math.min(Math.floor(availH / rowH), 14));

    for (let i = 0; i < totalRows; i++) {
      const ry = rowY + i * rowH;
      const item = i < filled ? data.items[i] : null;

      doc.fillColor(i % 2 === 0 ? '#FAFFF8' : '#FFFFFF').rect(tblLeft, ry, tblW, rowH).fill();

      if (item) {
        const slots = resolveSlots(item.frequency || '', item.dosage || '1', item.instructions || '');
        const food = resolveFood(item.instructions || '');

        doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor('#111111')
          .text(`${i + 1}.  ${item.medicineName}`, tblLeft + 32, ry + 5, { width: cMedW - 36 });
        if (item.dosage || item.duration) {
          const sub = [item.dosage, item.duration].filter(Boolean).join('  |  ');
          doc.font(PDF_THEME.fonts.regular).fontSize(7.5).fillColor('#555555')
            .text(sub, tblLeft + 32, ry + 18, { width: cMedW - 36 });
        }

        doc.font(PDF_THEME.fonts.bold).fontSize(11).fillColor(GRN);
        if (slots.m) doc.text(slots.m, xMorn + 2, ry + 9, { width: cT, align: 'center' });
        if (slots.a) doc.text(slots.a, xAftn + 2, ry + 9, { width: cT, align: 'center' });
        if (slots.ev) doc.text(slots.ev, xEvng + 2, ry + 9, { width: cT, align: 'center' });
        if (slots.n) doc.text(slots.n, xNgt + 2, ry + 9, { width: cT, align: 'center' });

        doc.font(PDF_THEME.fonts.bold).fontSize(12).fillColor(GRN);
        if (food.bf) doc.text(food.bf, xBf, ry + 9, { width: cF, align: 'center' });
        if (food.af) doc.text(food.af, xAf, ry + 9, { width: cF, align: 'center' });
      }

      doc.rect(tblLeft, ry, tblW, rowH).lineWidth(0.4).strokeColor(i < filled ? '#aacfaa' : '#cccccc').stroke();
      [xMorn, xAftn, xEvng, xNgt, xBf, xAf].forEach(x => {
        doc.moveTo(x, ry).lineTo(x, ry + rowH).lineWidth(0.4).strokeColor(GRN).stroke();
      });
    }

    // Signature area
    const sigY = H - BDR - 48;
    const sigX = hRight - 170;
    doc.moveTo(sigX, sigY).lineTo(hRight, sigY).lineWidth(0.8).dash(3, { space: 2 }).strokeColor(GRN).stroke();
    doc.undash();
    doc.font(PDF_THEME.fonts.regular).fontSize(8).fillColor(GRN).text(drEn, sigX, sigY + 3, { width: 170, align: 'center' });
    doc.font(PDF_THEME.fonts.regular).fontSize(7.5).fillColor(GRN).text('Signature & Stamp', sigX, sigY + 15, { width: 170, align: 'center' });

    // Tamil note footer
    doc.moveTo(hLeft, H - BDR - 26).lineTo(hRight, H - BDR - 26).lineWidth(0.8).strokeColor(GRN).stroke();
    doc.font(PDF_THEME.fonts.tamilRegular).fontSize(8.5).fillColor(GRN)
      .text('குறிப்பு : மறுமுறை வரும்போது கண்டிப்பாக இந்த சீட்டை கொண்டு வரவும்', 0, H - BDR - 18, { align: 'center' });

    // ── PAGE 2: POST-CARE INSTRUCTIONS (Back of sheet) ──────────────────────
    doc.addPage();
    doc.rect(BDR, BDR, W - BDR * 2, H - BDR * 2).lineWidth(2.0).strokeColor(GRN).stroke();
    doc.rect(BDR + 3, BDR + 3, W - BDR * 2 - 6, H - BDR * 2 - 6).lineWidth(0.6).strokeColor(GRN).stroke();

    let py = BDR + 16;
    doc.font(PDF_THEME.fonts.tamilBold).fontSize(13).fillColor(GRN)
      .text('பல் பிடுங்கிய பின்பு பின்பற்ற வேண்டிய வழிமுறைகள்', BDR + 12, py, {
        align: 'center',
        width: W - BDR * 2 - 24,
        underline: true
      });
    py += 26;
    doc.moveTo(BDR + 8, py).lineTo(W - BDR - 8, py).lineWidth(0.8).strokeColor(GRN).stroke();
    py += 10;

    const extractionSteps = [
      'பல் பிடுங்கிய இடத்தில் வைக்கப்படும் பஞ்சை ஒரு மணி நேரம் இறுக்கமாக கடித்திருக்க வேண்டும்.',
      'கண்டிப்பாக எச்சில் துப்பக்கூடாது; வாயிலும் எச்சிலை வைத்திருக்க கூடாது — முழுங்கி கொள்ளவும்.',
      'பல் பிடுங்கிய பிறகு ஒருநாள் சூடாக சாப்பிடக்கூடாது. வாயை பலமாகவும் கொப்பளிக்க கூடாது.',
      'பல் பிடுங்கிய பிறகு ஒரு நாளைக்கு மேல் இரத்தக் கசிவு இருந்தால் மருத்துவரை அணுகவும்.'
    ];

    extractionSteps.forEach((step, i) => {
      doc.font(PDF_THEME.fonts.bold).fontSize(10).fillColor(GRN).text(`${i + 1}.`, BDR + 14, py, { width: 20 });
      doc.font(PDF_THEME.fonts.tamilRegular).fontSize(10).fillColor('#1A1A1A')
        .text(step, BDR + 36, py, { width: W - BDR * 2 - 50 });
      py += 44;
    });

    py += 10;
    doc.font(PDF_THEME.fonts.tamilBold).fontSize(13).fillColor(GRN)
      .text('பர்சிதைவு (அல்லது) பற்குழியை அடைத்த பிறகு பின்பற்ற வேண்டிய வழிமுறைகள்', BDR + 12, py, {
        align: 'center',
        width: W - BDR * 2 - 24,
        underline: true
      });
    py += 28;
    doc.moveTo(BDR + 8, py).lineTo(W - BDR - 8, py).lineWidth(0.8).strokeColor(GRN).stroke();
    py += 10;

    doc.font(PDF_THEME.fonts.bold).fontSize(10).fillColor(GRN).text('1.', BDR + 14, py, { width: 20 });
    doc.font(PDF_THEME.fonts.tamilRegular).fontSize(10).fillColor('#1A1A1A')
      .text('1 மணி நேரம் கழிந்து உணவு அருந்தவும்.', BDR + 36, py, { width: W - BDR * 2 - 50 });
    py += 30;

    // Handwritten notes space
    const boxY = py + 10;
    doc.rect(BDR + 8, boxY, W - BDR * 2 - 16, 100).lineWidth(0.6).strokeColor('#aaaaaa').stroke();

    // Two-pass footer across both pages
    const totalPages = doc.bufferedPageRange().count;
    for (let p = 0; p < totalPages; p++) {
      doc.switchToPage(p);
      doc.font(PDF_THEME.fonts.regular).fontSize(7.5).fillColor(GRN)
        .text(`${branding.name}  •  Page ${p + 1} of ${totalPages}`, 0, H - BDR - 8, { align: 'center' });
    }

    doc.end();
  });
};

// ══════════════════════════════════════════════════════════════════════════
// 2. RECEIPT PDF GENERATOR
// ══════════════════════════════════════════════════════════════════════════
export const generateReceiptPDF = (data: ReceiptData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = initPDFDocument({ size: 'A4', margin: 0 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const branding = getClinicBranding({
      name: data.clinicName,
      address: data.clinicAddress,
      phone: data.clinicPhone
    });

    const margin = 40;
    let currentY = renderClinicHeader(doc, branding, { margin });

    const isPartialPayment = (data.balanceDue !== undefined && data.balanceDue > 0) || data.isPartial;
    const badgeText = isPartialPayment ? 'PARTIAL PAYMENT' : 'PAID (SETTLED)';
    const badgeColor = isPartialPayment ? PDF_THEME.colors.statusPartial : PDF_THEME.colors.statusPaid;
    const badgeBg = isPartialPayment ? PDF_THEME.colors.statusPartialBg : PDF_THEME.colors.statusPaidBg;

    // Document Title Banner with Dynamic Badge
    currentY = renderDocumentTitle(
      doc,
      'OFFICIAL PAYMENT RECEIPT',
      undefined,
      { text: badgeText, color: badgeColor, bg: badgeBg },
      currentY,
      margin
    );
    currentY += 8;

    const docName = data.doctorName && data.doctorName !== 'Doctor' && data.doctorName !== 'N/A'
      ? cleanDoctorName(data.doctorName)
      : 'Dr. N MOHAMED RAFI B D S';

    const receiptType = data.totalPaymentsCount && data.totalPaymentsCount > 1
      ? `Installment ${data.paymentNumber || 1} of ${data.totalPaymentsCount}`
      : (isPartialPayment ? 'Partial Installment' : 'Full Payment');

    // Perfectly balanced 5-item symmetrical columns
    const patientItems = [
      { label: 'Patient Name :', value: data.patientName },
      { label: 'Age :', value: data.patientAge ? `${data.patientAge} Yrs` : '—' },
      { label: 'Gender :', value: data.patientGender || '—' },
      { label: 'Phone No :', value: data.patientPhone || '—' },
      { label: 'Doctor In-Charge :', value: docName }
    ];

    const metaItems = [
      { label: 'Receipt No :', value: data.receiptNo },
      { label: 'Payment Date :', value: formatHumanDate(data.paymentDate) },
      { label: 'Payment Type :', value: receiptType },
      { label: 'Payment Method :', value: data.paymentMethod || 'Cash' },
      { label: 'Received By :', value: formatStaffRoleOrName(data.receivedBy) }
    ];

    currentY = renderUnifiedInfoCard(doc, {
      leftItems: patientItems,
      rightItems: metaItems,
      y: currentY,
      margin
    });
    currentY += 24;

    // Billing Details Table with proper spacing
    currentY = renderSectionHeader(doc, 'BILLING & VISIT CHARGES BREAKDOWN', currentY, margin);
    currentY += 6;

    const tableTop = currentY;
    const tableWidth = doc.page.width - margin * 2;
    const colW = {
      num: 36,
      desc: tableWidth - 36 - 130,
      amount: 130
    };

    // Table Header
    doc.fillColor(PDF_THEME.colors.headerBg).rect(margin, tableTop, tableWidth, 26).fill();
    doc.rect(margin, tableTop, tableWidth, 26).lineWidth(0.6).strokeColor(PDF_THEME.colors.border).stroke();
    doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor(PDF_THEME.colors.primaryNavy);
    doc.text('#', margin + 10, tableTop + 8, { width: colW.num });
    doc.text('DESCRIPTION / SERVICE', margin + colW.num + 10, tableTop + 8, { width: colW.desc });
    doc.text('AMOUNT (₹)', margin + tableWidth - colW.amount - 10, tableTop + 8, { width: colW.amount, align: 'right' });

    let rowY = tableTop + 26;
    let rowIdx = 1;

    // Row 1: Consultation Fee (if any)
    if (data.consultationFee > 0 || (!data.treatmentFee && !data.medicineCost)) {
      doc.fillColor(PDF_THEME.colors.bgWhite).rect(margin, rowY, tableWidth, 30).fill();
      doc.font(PDF_THEME.fonts.regular).fontSize(9).fillColor(PDF_THEME.colors.textMuted);
      doc.text(String(rowIdx++), margin + 10, rowY + 9, { width: colW.num });
      doc.font(PDF_THEME.fonts.bold).fillColor(PDF_THEME.colors.textDark).text('Doctor Consultation & Examination', margin + colW.num + 10, rowY + 9, { width: colW.desc });
      doc.font(PDF_THEME.fonts.regular).text(formatCurrency(data.consultationFee).replace('₹', ''), margin + tableWidth - colW.amount - 10, rowY + 9, {
        width: colW.amount,
        align: 'right'
      });
      doc.moveTo(margin, rowY + 30).lineTo(margin + tableWidth, rowY + 30).lineWidth(0.4).strokeColor(PDF_THEME.colors.borderLight).stroke();
      rowY += 30;
    }

    // Row 2: Treatment / Procedure Fee (if any)
    if (data.treatmentFee && data.treatmentFee > 0) {
      doc.fillColor(rowIdx % 2 === 1 ? PDF_THEME.colors.bgWhite : PDF_THEME.colors.bgLight).rect(margin, rowY, tableWidth, 30).fill();
      doc.font(PDF_THEME.fonts.regular).fontSize(9).fillColor(PDF_THEME.colors.textMuted);
      doc.text(String(rowIdx++), margin + 10, rowY + 9, { width: colW.num });
      doc.font(PDF_THEME.fonts.bold).fillColor(PDF_THEME.colors.textDark).text('Dental Procedures & Treatments', margin + colW.num + 10, rowY + 9, { width: colW.desc });
      doc.font(PDF_THEME.fonts.regular).text(formatCurrency(data.treatmentFee).replace('₹', ''), margin + tableWidth - colW.amount - 10, rowY + 9, {
        width: colW.amount,
        align: 'right'
      });
      doc.moveTo(margin, rowY + 30).lineTo(margin + tableWidth, rowY + 30).lineWidth(0.4).strokeColor(PDF_THEME.colors.borderLight).stroke();
      rowY += 30;
    }

    // Row 3: Medicine Cost (if any)
    if (data.medicineCost > 0) {
      doc.fillColor(rowIdx % 2 === 1 ? PDF_THEME.colors.bgWhite : PDF_THEME.colors.bgLight).rect(margin, rowY, tableWidth, 30).fill();
      doc.font(PDF_THEME.fonts.regular).fontSize(9).fillColor(PDF_THEME.colors.textMuted);
      doc.text(String(rowIdx++), margin + 10, rowY + 9, { width: colW.num });
      doc.font(PDF_THEME.fonts.bold).fillColor(PDF_THEME.colors.textDark).text('Pharmacy & Prescribed Medicines', margin + colW.num + 10, rowY + 9, { width: colW.desc });
      doc.font(PDF_THEME.fonts.regular).text(formatCurrency(data.medicineCost).replace('₹', ''), margin + tableWidth - colW.amount - 10, rowY + 9, {
        width: colW.amount,
        align: 'right'
      });
      doc.moveTo(margin, rowY + 30).lineTo(margin + tableWidth, rowY + 30).lineWidth(0.4).strokeColor(PDF_THEME.colors.borderLight).stroke();
      rowY += 30;
    }

    // Total Highlight Row
    doc.fillColor(PDF_THEME.colors.headerBg).rect(margin, rowY, tableWidth, 34).fill();
    doc.rect(margin, rowY, tableWidth, 34).lineWidth(0.8).strokeColor(PDF_THEME.colors.border).stroke();
    doc.font(PDF_THEME.fonts.bold).fontSize(10).fillColor(PDF_THEME.colors.primaryNavy);
    doc.text('TOTAL VISIT CHARGES', margin + colW.num + 10, rowY + 10);
    doc.fontSize(11).fillColor(PDF_THEME.colors.primaryNavy);
    doc.text(formatCurrency(data.totalAmount), margin + tableWidth - colW.amount - 10, rowY + 10, {
      width: colW.amount,
      align: 'right'
    });

    currentY = rowY + 46;

    // Amount in Words & Payment Settlement Card
    const wordsH = 66;
    doc.fillColor(PDF_THEME.colors.bgLight).rect(margin, currentY, tableWidth, wordsH).fill();
    doc.rect(margin, currentY, tableWidth, wordsH).lineWidth(0.6).strokeColor(PDF_THEME.colors.borderLight).stroke();

    // Top half: Amount in Words of THIS receipt
    doc.font(PDF_THEME.fonts.bold).fontSize(8.5).fillColor(PDF_THEME.colors.textMuted);
    doc.text('AMOUNT IN WORDS : ', margin + 14, currentY + 11);
    const wordsLabelW = doc.widthOfString('AMOUNT IN WORDS : ');
    doc.font(PDF_THEME.fonts.bold).fontSize(9.5).fillColor(PDF_THEME.colors.primaryNavy);
    doc.text(numberToWordsIndian(data.amountPaid), margin + 14 + wordsLabelW, currentY + 10);

    // Inner divider
    doc.moveTo(margin + 10, currentY + 30).lineTo(margin + tableWidth - 10, currentY + 30).lineWidth(0.4).strokeColor(PDF_THEME.colors.borderLight).stroke();

    // Bottom half: Payment Method, Status, Paid Now & Balance Due
    doc.font(PDF_THEME.fonts.regular).fontSize(8.5).fillColor(PDF_THEME.colors.textMuted);
    doc.text('Payment Mode : ', margin + 14, currentY + 42);
    doc.font(PDF_THEME.fonts.bold).fillColor(PDF_THEME.colors.textDark).text(data.paymentMethod || 'Cash', margin + 92, currentY + 42);

    doc.font(PDF_THEME.fonts.regular).fillColor(PDF_THEME.colors.textMuted).text('Status : ', margin + 175, currentY + 42);
    doc.font(PDF_THEME.fonts.bold).fillColor(badgeColor).text(isPartialPayment ? 'Partial Payment' : 'Fully Settled', margin + 215, currentY + 42);

    doc.font(PDF_THEME.fonts.regular).fillColor(PDF_THEME.colors.textMuted).text('Paid Now : ', margin + tableWidth - 230, currentY + 42, { width: 65, align: 'right' });
    doc.font(PDF_THEME.fonts.bold).fontSize(10.5).fillColor(PDF_THEME.colors.statusPaid).text(formatCurrency(data.amountPaid), margin + tableWidth - 165, currentY + 41, { width: 55, align: 'right' });

    if (isPartialPayment && data.balanceDue !== undefined) {
      doc.font(PDF_THEME.fonts.regular).fillColor(PDF_THEME.colors.textMuted).text('Balance : ', margin + tableWidth - 105, currentY + 42, { width: 50, align: 'right' });
      doc.font(PDF_THEME.fonts.bold).fontSize(10.5).fillColor(PDF_THEME.colors.statusPartial).text(formatCurrency(data.balanceDue), margin + tableWidth - 55, currentY + 41, { width: 50, align: 'right' });
    } else {
      doc.font(PDF_THEME.fonts.regular).fillColor(PDF_THEME.colors.textMuted).text('Balance : ', margin + tableWidth - 105, currentY + 42, { width: 50, align: 'right' });
      doc.font(PDF_THEME.fonts.bold).fontSize(10.5).fillColor(PDF_THEME.colors.statusPaid).text('₹0', margin + tableWidth - 55, currentY + 41, { width: 50, align: 'right' });
    }

    currentY += wordsH + 30;

    // Lower Section: Side-by-Side Symmetrical Structure (Notes on Left, Signature on Right)
    const lowerY = currentY;
    const notesW = 275;
    const notesH = 96;

    // Left Box: Receipt Acknowledgment & Terms
    doc.fillColor(PDF_THEME.colors.bgLight).rect(margin, lowerY, notesW, notesH).fill();
    doc.rect(margin, lowerY, notesW, notesH).lineWidth(0.5).strokeColor(PDF_THEME.colors.borderLight).stroke();

    doc.font(PDF_THEME.fonts.bold).fontSize(8.5).fillColor(PDF_THEME.colors.primaryNavy)
      .text('RECEIPT ACKNOWLEDGMENT & TERMS', margin + 12, lowerY + 10);

    doc.font(PDF_THEME.fonts.regular).fontSize(7.5).fillColor(PDF_THEME.colors.textMuted);

    if (data.paymentNotes) {
      doc.font(PDF_THEME.fonts.bold).fillColor(PDF_THEME.colors.primaryNavy).text(`• Note: "${data.paymentNotes}"`, margin + 12, lowerY + 26, { width: notesW - 24 });
      doc.font(PDF_THEME.fonts.regular).fillColor(PDF_THEME.colors.textMuted);
      doc.text(`• Acknowledges payment of ${formatCurrency(data.amountPaid)}. Remaining balance: ${formatCurrency(data.balanceDue || 0)}.`, margin + 12, lowerY + 48, { width: notesW - 24, lineGap: 2 });
      doc.text('• Please preserve this receipt for personal accounts and medical claims.', margin + 12, lowerY + 70, { width: notesW - 24, lineGap: 2 });
    } else {
      doc.text('• This document confirms official receipt of payment for services rendered.', margin + 12, lowerY + 28, { width: notesW - 24, lineGap: 3 });
      doc.text('• Prescribed medicines and oral hygiene supplies are non-returnable.', margin + 12, lowerY + 50, { width: notesW - 24, lineGap: 3 });
      doc.text('• Please preserve this receipt for personal accounts and medical tax claims.', margin + 12, lowerY + 72, { width: notesW - 24, lineGap: 3 });
    }

    // Right Box: Authorized Signatory Block (aligned at the exact same Y position)
    renderSignatureBlock(
      doc,
      {
        name: docName,
        clinicName: branding.name,
        phone: branding.phone,
        email: branding.email
      },
      lowerY,
      margin
    );

    // Finalize with two-pass footers
    finalizeDocumentWithFooters(doc, branding, { margin });

    doc.end();
  });
};

// ══════════════════════════════════════════════════════════════════════════
// 3. TAX INVOICE PDF GENERATOR
// ══════════════════════════════════════════════════════════════════════════
export const generateInvoicePDF = (data: InvoiceData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = initPDFDocument({ size: 'A4', margin: 0 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const branding = getClinicBranding({
      name: data.clinicName,
      address: data.clinicAddress,
      phone: data.clinicPhone
    });

    const margin = 40;
    let currentY = renderClinicHeader(doc, branding, { margin });

    const isFullyPaid = data.amountDue === 0;
    const badgeBg = isFullyPaid ? PDF_THEME.colors.statusPaidBg : PDF_THEME.colors.statusPartialBg;
    const badgeColor = isFullyPaid ? PDF_THEME.colors.statusPaid : PDF_THEME.colors.statusPartial;

    // Document Title Banner
    currentY = renderDocumentTitle(
      doc,
      'TAX INVOICE',
      undefined,
      { text: data.status.toUpperCase(), color: badgeColor, bg: badgeBg },
      currentY,
      margin
    );

    const patientItems = [
      { label: 'Patient Name :', value: data.patientName },
      { label: 'Age :', value: data.patientAge ? `${data.patientAge} Yrs` : '—' },
      { label: 'Gender :', value: data.patientGender || '—' },
      { label: 'Phone No :', value: data.patientPhone || '—' }
    ];

    const metaItems = [
      { label: 'Invoice No :', value: data.invoiceNumber },
      { label: 'Invoice Date :', value: formatHumanDate(data.visitDate) },
      ...(data.doctorName && data.doctorName !== 'Doctor' && data.doctorName !== 'N/A'
        ? [{ label: 'Doctor :', value: cleanDoctorName(data.doctorName) }]
        : []),
      { label: 'Payment Status :', value: data.status }
    ];

    currentY = renderUnifiedInfoCard(doc, {
      leftItems: patientItems,
      rightItems: metaItems,
      y: currentY,
      margin
    });
    currentY += 16;

    // Itemized Services & Pharmacy Section
    currentY = renderSectionHeader(doc, 'ITEMIZED SERVICES & PHARMACY', currentY, margin);

    const tableWidth = doc.page.width - margin * 2;
    const colW = {
      num: 28,
      desc: tableWidth - 28 - 45 - 80 - 85,
      qty: 45,
      rate: 80,
      amount: 85
    };

    // Table Header
    doc.fillColor(PDF_THEME.colors.headerBg).rect(margin, currentY, tableWidth, 22).fill();
    doc.rect(margin, currentY, tableWidth, 22).lineWidth(0.5).strokeColor(PDF_THEME.colors.border).stroke();
    doc.font(PDF_THEME.fonts.bold).fontSize(8.5).fillColor(PDF_THEME.colors.primaryNavy);
    doc.text('#', margin + 4, currentY + 6, { width: colW.num });
    doc.text('DESCRIPTION / PROCEDURE', margin + colW.num + 4, currentY + 6, { width: colW.desc });
    doc.text('QTY', margin + colW.num + colW.desc + 4, currentY + 6, { width: colW.qty, align: 'center' });
    doc.text('RATE (₹)', margin + colW.num + colW.desc + colW.qty + 4, currentY + 6, { width: colW.rate, align: 'right' });
    doc.text('AMOUNT (₹)', margin + colW.num + colW.desc + colW.qty + colW.rate + 4, currentY + 6, { width: colW.amount - 8, align: 'right' });

    currentY += 22;
    let itemIndex = 1;

    // Consultation Line (if applicable)
    if (data.consultationFee > 0) {
      doc.fillColor(PDF_THEME.colors.bgWhite).rect(margin, currentY, tableWidth, 22).fill();
      doc.font(PDF_THEME.fonts.regular).fontSize(8.5).fillColor(PDF_THEME.colors.textDark);
      doc.text(String(itemIndex++), margin + 4, currentY + 6, { width: colW.num });
      doc.font(PDF_THEME.fonts.bold).text('Consultation & Clinical Examination', margin + colW.num + 4, currentY + 6, { width: colW.desc });
      doc.font(PDF_THEME.fonts.regular).text('1', margin + colW.num + colW.desc + 4, currentY + 6, { width: colW.qty, align: 'center' });
      doc.text(formatCurrency(data.consultationFee).replace('₹', ''), margin + colW.num + colW.desc + colW.qty + 4, currentY + 6, { width: colW.rate, align: 'right' });
      doc.font(PDF_THEME.fonts.bold).text(formatCurrency(data.consultationFee).replace('₹', ''), margin + colW.num + colW.desc + colW.qty + colW.rate + 4, currentY + 6, { width: colW.amount - 8, align: 'right' });

      doc.moveTo(margin, currentY + 22).lineTo(margin + tableWidth, currentY + 22).lineWidth(0.4).strokeColor(PDF_THEME.colors.borderLight).stroke();
      currentY += 22;
    }

    // Treatments Lines
    if (data.treatments && data.treatments.length > 0) {
      for (const t of data.treatments) {
        doc.fillColor(itemIndex % 2 === 0 ? PDF_THEME.colors.bgLight : PDF_THEME.colors.bgWhite).rect(margin, currentY, tableWidth, 22).fill();
        doc.font(PDF_THEME.fonts.regular).fontSize(8.5).fillColor(PDF_THEME.colors.textDark);
        doc.text(String(itemIndex++), margin + 4, currentY + 6, { width: colW.num });
        const desc = t.notes ? `${t.name} (${t.notes})` : t.name;
        doc.font(PDF_THEME.fonts.bold).text(desc, margin + colW.num + 4, currentY + 6, { width: colW.desc });
        doc.font(PDF_THEME.fonts.regular).text('1', margin + colW.num + colW.desc + 4, currentY + 6, { width: colW.qty, align: 'center' });
        const fee = t.fee || (data.treatmentFee / Math.max(data.treatments.length, 1));
        doc.text(formatCurrency(fee).replace('₹', ''), margin + colW.num + colW.desc + colW.qty + 4, currentY + 6, { width: colW.rate, align: 'right' });
        doc.font(PDF_THEME.fonts.bold).text(formatCurrency(fee).replace('₹', ''), margin + colW.num + colW.desc + colW.qty + colW.rate + 4, currentY + 6, { width: colW.amount - 8, align: 'right' });

        doc.moveTo(margin, currentY + 22).lineTo(margin + tableWidth, currentY + 22).lineWidth(0.4).strokeColor(PDF_THEME.colors.borderLight).stroke();
        currentY += 22;
      }
    }

    // Medicine Lines
    if (data.medicines && data.medicines.length > 0) {
      for (const m of data.medicines) {
        doc.fillColor(itemIndex % 2 === 0 ? PDF_THEME.colors.bgLight : PDF_THEME.colors.bgWhite).rect(margin, currentY, tableWidth, 22).fill();
        doc.font(PDF_THEME.fonts.regular).fontSize(8.5).fillColor(PDF_THEME.colors.textDark);
        doc.text(String(itemIndex++), margin + 4, currentY + 6, { width: colW.num });
        doc.font(PDF_THEME.fonts.bold).text(m.name, margin + colW.num + 4, currentY + 6, { width: colW.desc });
        doc.font(PDF_THEME.fonts.regular).text(String(m.quantity), margin + colW.num + colW.desc + 4, currentY + 6, { width: colW.qty, align: 'center' });
        doc.text(formatCurrency(m.unitPrice).replace('₹', ''), margin + colW.num + colW.desc + colW.qty + 4, currentY + 6, { width: colW.rate, align: 'right' });
        doc.font(PDF_THEME.fonts.bold).text(formatCurrency(m.total).replace('₹', ''), margin + colW.num + colW.desc + colW.qty + colW.rate + 4, currentY + 6, { width: colW.amount - 8, align: 'right' });

        doc.moveTo(margin, currentY + 22).lineTo(margin + tableWidth, currentY + 22).lineWidth(0.4).strokeColor(PDF_THEME.colors.borderLight).stroke();
        currentY += 22;
      }
    }

    currentY += 12;

    // Financial Breakdown — Final totals only (itemized fees are already displayed in the table above)
    const financialSummary = {
      items: [],
      totalAmount: data.totalAmount,
      amountPaid: data.amountPaid,
      amountDue: data.amountDue,
      status: data.status
    };

    currentY = renderFinancialSummary(doc, financialSummary, currentY, margin);
    currentY += 16;

    // Doctor Signature
    if (data.doctorName && data.doctorName !== 'Doctor' && data.doctorName !== 'N/A') {
      renderSignatureBlock(
        doc,
        {
          name: data.doctorName,
          clinicName: branding.name,
          phone: branding.phone,
          email: branding.email
        },
        currentY,
        margin
      );
    }

    // Finalize two-pass footers
    finalizeDocumentWithFooters(doc, branding, { margin });

    doc.end();
  });
};

// ══════════════════════════════════════════════════════════════════════════
// 4. REIMBURSEMENT CLAIM PDF GENERATOR
// ══════════════════════════════════════════════════════════════════════════
export const generateReimbursementPDF = (data: ReimbursementPDFData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = initPDFDocument({ size: 'A4', margin: 0 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const branding = getClinicBranding({
      name: data.clinicName || undefined,
      address: data.clinicAddress || undefined,
      phone: data.clinicPhone || undefined
    });

    const margin = 40;
    let currentY = renderClinicHeader(doc, branding, { margin });

    // Document Title Banner
    currentY = renderDocumentTitle(
      doc,
      'MEDICAL REIMBURSEMENT CERTIFICATE',
      'Issued for patient medical insurance and employer claim purposes',
      undefined,
      currentY,
      margin
    );

    // Patient Info & Claim Metadata Unified Card (Bold labels, regular values, no 'PATIENT INFORMATION' banner)
    const patientItems = [
      { label: 'Patient Name :', value: data.patientName || '—' },
      { label: 'Age :', value: data.patientAge ? `${data.patientAge} Yrs` : '—' },
      { label: 'Gender :', value: data.patientGender || '—' },
      { label: 'Phone No :', value: data.patientPhone || '—' }
    ];

    const metaItems = [
      { label: 'Doc Number :', value: data.documentNumber || '—' },
      { label: 'Claim Date :', value: formatHumanDate(data.documentDate) },
      ...(data.doctorName && data.doctorName !== 'Doctor'
        ? [{ label: 'Treating Doctor :', value: cleanDoctorName(data.doctorName) }]
        : [{ label: 'Treating Doctor :', value: '—' }]),
      ...(data.doctorRegNo ? [{ label: 'Reg Number :', value: data.doctorRegNo }] : [])
    ];

    currentY = renderUnifiedInfoCard(doc, {
      leftItems: patientItems,
      rightItems: metaItems,
      y: currentY,
      margin
    });
    currentY += 18;

    // Treatment & Amount Summary Box
    if (data.treatmentDescription || (data.amount !== null && data.amount !== undefined)) {
      const boxW = doc.page.width - margin * 2;
      const boxH = 48;
      doc.fillColor(PDF_THEME.colors.bgLight).rect(margin, currentY, boxW, boxH).fill();
      doc.rect(margin, currentY, boxW, boxH).lineWidth(0.5).strokeColor(PDF_THEME.colors.borderLight).stroke();

      if (data.treatmentDescription) {
        doc.font(PDF_THEME.fonts.bold).fontSize(8.5).fillColor(PDF_THEME.colors.primaryNavy)
          .text('PROCEDURES / TREATMENT UNDERTAKEN:', margin + 12, currentY + 8);
        doc.font(PDF_THEME.fonts.regular).fontSize(9).fillColor(PDF_THEME.colors.textDark)
          .text(data.treatmentDescription, margin + 12, currentY + 22, { width: boxW - 160 });
      }

      if (data.amount !== null && data.amount !== undefined) {
        doc.font(PDF_THEME.fonts.bold).fontSize(8.5).fillColor(PDF_THEME.colors.primaryNavy)
          .text('TOTAL CLAIM AMOUNT', margin + boxW - 130, currentY + 8, { width: 120, align: 'right' });
        doc.font(PDF_THEME.fonts.bold).fontSize(13.5).fillColor(PDF_THEME.colors.statusPaid)
          .text(formatCurrency(data.amount), margin + boxW - 130, currentY + 22, { width: 120, align: 'right' });
      }

      currentY += boxH + 18;
    }

    // Salutation (under the procedure/treatment card)
    doc.font(PDF_THEME.fonts.bold).fontSize(10.5).fillColor(PDF_THEME.colors.primaryNavy)
      .text('TO WHOMSOEVER IT MAY CONCERN', margin, currentY);
    currentY += 16;

    // Letter Content Paragraphs
    doc.font(PDF_THEME.fonts.regular).fontSize(9.5).fillColor(PDF_THEME.colors.textDark);
    const paragraphs = data.content.split('\n').map(p => p.trim()).filter(Boolean);
    for (const p of paragraphs) {
      doc.text(p, margin, currentY, { width: doc.page.width - margin * 2, lineGap: 4.5 });
      currentY = doc.y + 8;
    }

    // Signature Block anchored nicely towards the bottom
    if (data.doctorName && data.doctorName !== 'Doctor') {
      renderSignatureBlock(
        doc,
        {
          name: data.doctorName,
          title: 'Dental Surgeon',
          clinicName: branding.name,
          phone: branding.phone,
          email: branding.email,
          regNo: data.doctorRegNo || undefined
        },
        currentY + 20,
        margin,
        { alignBottom: true }
      );
    }

    finalizeDocumentWithFooters(doc, branding, {
      margin,
      disclaimer: 'This certificate is officially issued for the purpose of medical reimbursement claims.'
    });

    doc.end();
  });
};

// ══════════════════════════════════════════════════════════════════════════
// 5. PURCHASE ORDER PDF GENERATOR
// ══════════════════════════════════════════════════════════════════════════
export const generatePurchaseOrderPDF = (data: PurchaseOrderData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = initPDFDocument({ size: 'A4', margin: 0 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const branding = getClinicBranding({ name: data.clinicName });
    const margin = 40;
    let currentY = renderClinicHeader(doc, branding, { margin });

    // Title
    currentY = renderDocumentTitle(
      doc,
      'PURCHASE ORDER',
      'Clinic Procurement & Inventory Replenishment',
      undefined,
      currentY,
      margin
    );

    // Vendor & Order Metadata Cards
    const colWidth = (doc.page.width - margin * 2 - 16) / 2;

    const metaItems = [
      { label: 'PO Number :', value: `#${data.orderNumber}` },
      { label: 'Order Date :', value: formatHumanDate(data.orderDate) },
      ...(data.expectedDate ? [{ label: 'Expected By :', value: formatHumanDate(data.expectedDate) }] : []),
      { label: 'Status :', value: 'Sent to Supplier' }
    ];

    const sharedCardHeight = Math.max(metaItems.length * 16 + 20, 84);

    // Left: Vendor Card (symmetrical equal height with metadata card)
    doc.fillColor(PDF_THEME.colors.bgLight).rect(margin, currentY, colWidth, sharedCardHeight).fill();
    doc.rect(margin, currentY, colWidth, sharedCardHeight).lineWidth(0.5).strokeColor(PDF_THEME.colors.borderLight).stroke();
    doc.font(PDF_THEME.fonts.bold).fontSize(8.5).fillColor(PDF_THEME.colors.primaryTeal).text('SUPPLIER / VENDOR', margin + 8, currentY + 8);
    doc.font(PDF_THEME.fonts.bold).fontSize(11).fillColor(PDF_THEME.colors.textDark).text(data.supplierName, margin + 8, currentY + 22, { width: colWidth - 16 });
    const vendorSub = [data.supplierPhone ? `Ph: ${data.supplierPhone}` : '', data.supplierEmail].filter(Boolean).join('  •  ');
    if (vendorSub) {
      doc.font(PDF_THEME.fonts.regular).fontSize(8.5).fillColor(PDF_THEME.colors.textMuted).text(vendorSub, margin + 8, currentY + 40, { width: colWidth - 16 });
    }

    // Right: PO Metadata
    renderDocumentMetadata(doc, metaItems, margin + colWidth + 16, currentY, colWidth, sharedCardHeight);
    currentY += sharedCardHeight + 16;

    // Itemized Order Table
    currentY = renderSectionHeader(doc, 'ORDERED ITEMS & INVENTORY SUPPLIES', currentY, margin);

    const tableWidth = doc.page.width - margin * 2;
    const colW = {
      desc: tableWidth - 50 - 90 - 95,
      qty: 50,
      rate: 90,
      amount: 95
    };

    doc.fillColor(PDF_THEME.colors.headerBg).rect(margin, currentY, tableWidth, 22).fill();
    doc.rect(margin, currentY, tableWidth, 22).lineWidth(0.5).strokeColor(PDF_THEME.colors.border).stroke();
    doc.font(PDF_THEME.fonts.bold).fontSize(8.5).fillColor(PDF_THEME.colors.primaryNavy);
    doc.text('ITEM DESCRIPTION', margin + 8, currentY + 6, { width: colW.desc });
    doc.text('QTY', margin + colW.desc + 8, currentY + 6, { width: colW.qty, align: 'center' });
    doc.text('UNIT PRICE', margin + colW.desc + colW.qty + 8, currentY + 6, { width: colW.rate, align: 'right' });
    doc.text('TOTAL', margin + colW.desc + colW.qty + colW.rate + 8, currentY + 6, { width: colW.amount - 16, align: 'right' });

    currentY += 22;

    data.items.forEach((item, index) => {
      const bg = index % 2 === 0 ? PDF_THEME.colors.bgWhite : PDF_THEME.colors.bgLight;
      doc.fillColor(bg).rect(margin, currentY, tableWidth, 22).fill();
      doc.font(PDF_THEME.fonts.regular).fontSize(8.5).fillColor(PDF_THEME.colors.textDark);
      doc.text(item.medicineName, margin + 8, currentY + 6, { width: colW.desc });
      doc.text(String(item.quantity), margin + colW.desc + 8, currentY + 6, { width: colW.qty, align: 'center' });
      doc.text(formatCurrency(item.unitPrice), margin + colW.desc + colW.qty + 8, currentY + 6, { width: colW.rate, align: 'right' });
      doc.font(PDF_THEME.fonts.bold).text(formatCurrency(item.total), margin + colW.desc + colW.qty + colW.rate + 8, currentY + 6, { width: colW.amount - 16, align: 'right' });

      doc.moveTo(margin, currentY + 22).lineTo(margin + tableWidth, currentY + 22).lineWidth(0.4).strokeColor(PDF_THEME.colors.borderLight).stroke();
      currentY += 22;
    });

    currentY += 12;

    // Total box
    const totalBoxW = 220;
    const totalBoxX = doc.page.width - margin - totalBoxW;
    doc.fillColor(PDF_THEME.colors.headerBg).rect(totalBoxX, currentY, totalBoxW, 30).fill();
    doc.rect(totalBoxX, currentY, totalBoxW, 30).lineWidth(0.8).strokeColor(PDF_THEME.colors.border).stroke();
    doc.font(PDF_THEME.fonts.bold).fontSize(11).fillColor(PDF_THEME.colors.primaryNavy);
    doc.text('PURCHASE TOTAL :', totalBoxX + 10, currentY + 8);
    doc.text(formatCurrency(data.totalAmount), totalBoxX + 110, currentY + 8, { width: 100, align: 'right' });

    currentY += 45;

    if (data.notes) {
      doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor(PDF_THEME.colors.textDark).text('Notes & Delivery Instructions:', margin, currentY);
      doc.font(PDF_THEME.fonts.regular).fontSize(8.5).fillColor(PDF_THEME.colors.textMuted).text(data.notes, margin, currentY + 14, { width: doc.page.width - margin * 2 });
      currentY += 36;
    }

    finalizeDocumentWithFooters(doc, branding, { margin });

    doc.end();
  });
};
