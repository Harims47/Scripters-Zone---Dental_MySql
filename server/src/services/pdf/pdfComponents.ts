import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { PDF_THEME } from './pdfTheme';
import { ClinicBranding, formatAddressLines, formatCurrency, cleanDoctorName } from './clinicBranding';

export interface DataTableColumn {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: (val: any, row?: any) => string;
}

export interface DataTableConfig {
  columns: DataTableColumn[];
  data: any[];
  startY: number;
  margin?: number;
  rowHeight?: number;
}

/**
 * Initializes a new PDFKit document with standard fonts registered and bufferPages enabled for two-pass layout.
 */
export const initPDFDocument = (options?: {
  size?: 'A4' | [number, number];
  layout?: 'portrait' | 'landscape';
  margin?: number;
  info?: any;
}): typeof PDFDocument => {
  const isLandscape = options?.layout === 'landscape';
  const doc = new PDFDocument({
    size: options?.size || 'A4',
    layout: options?.layout || 'portrait',
    margin: options?.margin !== undefined ? options.margin : 0,
    bufferPages: true,
    autoFirstPage: true,
    info: {
      Producer: 'DentalCore Clinic Management System',
      Creator: 'DentalCore PDF Engine',
      ...options?.info
    }
  });

  // Helper to resolve font files across development and compiled dist directories
  const resolveFontPath = (fontFileName: string): string => {
    const candidatePaths = [
      path.join(process.cwd(), 'src/assets/fonts', fontFileName),
      path.join(process.cwd(), 'server/src/assets/fonts', fontFileName),
      path.join(__dirname, '../../assets/fonts', fontFileName),
      path.join(__dirname, '../../../src/assets/fonts', fontFileName),
      path.join(__dirname, '../../../../server/src/assets/fonts', fontFileName),
      path.join(__dirname, '../../../../../server/src/assets/fonts', fontFileName)
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return p;
    }
    return '';
  };

  const fontRegular = resolveFontPath('Roboto-Regular.ttf');
  const fontBold = resolveFontPath('Roboto-Bold.ttf');
  const tamilRegular = resolveFontPath('NotoSansTamil-Regular.ttf');
  const tamilBold = resolveFontPath('NotoSansTamil-Bold.ttf');

  if (fontRegular) doc.registerFont(PDF_THEME.fonts.regular, fontRegular);
  if (fontBold) doc.registerFont(PDF_THEME.fonts.bold, fontBold);
  if (tamilRegular) doc.registerFont(PDF_THEME.fonts.tamilRegular, tamilRegular);
  if (tamilBold) doc.registerFont(PDF_THEME.fonts.tamilBold, tamilBold);

  return doc;
};

/**
 * Renders a consistent, professional clinic header with logo, clinic details, and divider rule.
 */
export const renderClinicHeader = (
  doc: any,
  branding: ClinicBranding,
  options?: { showLogo?: boolean; y?: number; margin?: number }
): number => {
  const margin = options?.margin || 40;
  const startY = options?.y || 24;
  const contentWidth = doc.page.width - margin * 2;
  const showLogo = options?.showLogo !== false && Boolean(branding.logoPath && fs.existsSync(branding.logoPath));

  let logoRendered = false;
  let logoBottom = startY;

  // Render logo if available (the logo itself contains the clinic name)
  if (showLogo && branding.logoPath) {
    try {
      const logoHeight = 44;
      doc.image(branding.logoPath, margin, startY, { height: logoHeight });
      logoRendered = true;
      logoBottom = startY + logoHeight;
    } catch {
      logoRendered = false;
    }
  }

  // Right: Address, Phone, Email (only what is configured)
  const headerRightWidth = 270;
  const rightX = doc.page.width - margin - headerRightWidth;
  let contactY = startY + 2;

  // Left: Only render clinic name text if logo is NOT present (logo itself already contains the clinic name)
  if (!logoRendered && branding.name) {
    const headerLeftWidth = contentWidth - headerRightWidth - 10;
    doc.font(PDF_THEME.fonts.bold)
      .fontSize(18)
      .fillColor(PDF_THEME.colors.primaryNavy)
      .text(branding.name.toUpperCase(), margin, startY + 2, { width: headerLeftWidth });
  }

  const addressLines = formatAddressLines(branding.address);
  doc.font(PDF_THEME.fonts.regular).fontSize(8.5).fillColor(PDF_THEME.colors.textMuted);
  for (const line of addressLines) {
    doc.text(line, rightX, contactY, { width: headerRightWidth, align: 'right' });
    contactY += 12;
  }

  if (branding.phone) {
    doc.font(PDF_THEME.fonts.bold).fillColor(PDF_THEME.colors.primaryTeal);
    doc.text(`Phone: ${branding.phone}`, rightX, contactY, { width: headerRightWidth, align: 'right' });
    contactY += 12;
  }

  if (branding.email) {
    doc.font(PDF_THEME.fonts.regular).fontSize(8).fillColor(PDF_THEME.colors.textMuted);
    doc.text(branding.email, rightX, contactY, { width: headerRightWidth, align: 'right' });
    contactY += 12;
  }

  const dividerY = Math.max(startY + 54, contactY + 6, logoBottom + 8);
  doc.moveTo(margin, dividerY)
    .lineTo(doc.page.width - margin, dividerY)
    .lineWidth(1)
    .strokeColor(PDF_THEME.colors.primaryTeal)
    .stroke();

  return dividerY + 12;
};

/**
 * Renders a document title banner with optional badge and subtitle.
 */
export const renderDocumentTitle = (
  doc: any,
  title: string,
  subtitle?: string,
  badge?: { text: string; color?: string; bg?: string },
  y?: number,
  margin: number = 40
): number => {
  const startY = y || doc.y;
  const contentWidth = doc.page.width - margin * 2;

  doc.font(PDF_THEME.fonts.bold)
    .fontSize(15)
    .fillColor(PDF_THEME.colors.textDark)
    .text(title.toUpperCase(), margin, startY, { width: contentWidth - (badge ? 120 : 0) });

  let titleBottom = startY + 18;

  if (badge) {
    const badgeW = 100;
    const badgeH = 20;
    const badgeX = doc.page.width - margin - badgeW;
    const badgeBg = badge.bg || PDF_THEME.colors.statusPaidBg;
    const badgeColor = badge.color || PDF_THEME.colors.statusPaid;

    doc.fillColor(badgeBg).rect(badgeX, startY - 2, badgeW, badgeH).fill();
    doc.fillColor(badgeColor)
      .font(PDF_THEME.fonts.bold)
      .fontSize(9.5)
      .text(badge.text.toUpperCase(), badgeX, startY + 3, { width: badgeW, align: 'center' });
  }

  if (subtitle) {
    doc.font(PDF_THEME.fonts.regular)
      .fontSize(9)
      .fillColor(PDF_THEME.colors.textMuted)
      .text(subtitle, margin, titleBottom, { width: contentWidth });
    titleBottom += 14;
  }

  return titleBottom + 4;
};

/**
 * Renders a labeled key-value metadata block inside a refined light card.
 */
export const renderDocumentMetadata = (
  doc: any,
  items: { label: string; value: string }[],
  x: number,
  y: number,
  width: number,
  height?: number
): number => {
  const cardPad = 8;
  const lineHeight = 16;
  const calculatedHeight = Math.max(items.length * lineHeight + cardPad * 2, 48);
  const cardHeight = height !== undefined ? height : calculatedHeight;

  doc.fillColor(PDF_THEME.colors.bgLight).rect(x, y, width, cardHeight).fill();
  doc.rect(x, y, width, cardHeight).lineWidth(0.5).strokeColor(PDF_THEME.colors.borderLight).stroke();

  let curY = y + cardPad;
  const labelWidth = Math.min(width * 0.42, 90);
  const valueWidth = width - labelWidth - cardPad * 2;

  for (const item of items) {
    doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor(PDF_THEME.colors.textDark)
      .text(item.label, x + cardPad, curY, { width: labelWidth });
    doc.font(PDF_THEME.fonts.regular).fontSize(9).fillColor(PDF_THEME.colors.textDark)
      .text(item.value, x + cardPad + labelWidth, curY, { width: valueWidth });
    curY += lineHeight;
  }

  return y + cardHeight;
};

/**
 * Renders a patient information card strictly without database IDs.
 */
export const renderPatientInformation = (
  doc: any,
  patient: { name: string; phone?: string; age?: number | string; gender?: string },
  x: number,
  y: number,
  width: number,
  height?: number
): number => {
  const cardPad = 8;
  const cardHeight = height !== undefined ? height : 64;

  doc.fillColor(PDF_THEME.colors.bgLight).rect(x, y, width, cardHeight).fill();
  doc.rect(x, y, width, cardHeight).lineWidth(0.5).strokeColor(PDF_THEME.colors.borderLight).stroke();

  doc.font(PDF_THEME.fonts.bold)
    .fontSize(8.5)
    .fillColor(PDF_THEME.colors.primaryTeal)
    .text('PATIENT INFORMATION', x + cardPad, y + cardPad);

  doc.font(PDF_THEME.fonts.bold)
    .fontSize(11)
    .fillColor(PDF_THEME.colors.textDark)
    .text(patient.name, x + cardPad, y + cardPad + 14, { width: width - cardPad * 2 });

  const subItems: string[] = [];
  if (patient.age) subItems.push(`${patient.age} Yrs`);
  if (patient.gender) subItems.push(patient.gender);
  if (patient.phone) subItems.push(`Ph: ${patient.phone}`);

  if (subItems.length > 0) {
    doc.font(PDF_THEME.fonts.regular)
      .fontSize(9)
      .fillColor(PDF_THEME.colors.textMuted)
      .text(subItems.join('  •  '), x + cardPad, y + cardPad + 32, { width: width - cardPad * 2 });
  }

  return y + cardHeight;
};

/**
 * Renders a single, cohesive full-width info card combining Left Items (e.g. Patient Details)
 * and Right Items (e.g. Document Metadata), separated by an elegant vertical divider rule.
 */
export const renderUnifiedInfoCard = (
  doc: any,
  config: {
    leftItems: { label: string; value: string; isBold?: boolean }[];
    rightItems: { label: string; value: string; isBold?: boolean }[];
    y: number;
    margin?: number;
  }
): number => {
  const margin = config.margin || 40;
  const contentWidth = doc.page.width - margin * 2;
  const pad = 12;
  const dividerGap = 24;
  const colWidth = (contentWidth - dividerGap) / 2;
  const leftX = margin;
  const rightX = margin + colWidth + dividerGap;

  const lineHeight = 17;
  const maxRows = Math.max(config.leftItems.length, config.rightItems.length);
  const cardHeight = Math.max(maxRows * lineHeight + pad * 2, 82);

  // Single unified card background and border
  doc.fillColor(PDF_THEME.colors.bgLight).rect(margin, config.y, contentWidth, cardHeight).fill();
  doc.rect(margin, config.y, contentWidth, cardHeight).lineWidth(0.5).strokeColor(PDF_THEME.colors.borderLight).stroke();

  // Vertical divider line in the middle
  const dividerX = margin + colWidth + dividerGap / 2;
  doc.moveTo(dividerX, config.y + 8)
    .lineTo(dividerX, config.y + cardHeight - 8)
    .lineWidth(0.5)
    .strokeColor(PDF_THEME.colors.borderLight)
    .stroke();

  // Left Column items (Patient Name, Age, Gender, Phone No)
  let curLeftY = config.y + pad;
  const leftLabelWidth = Math.min(colWidth * 0.40, 95);
  const leftValueWidth = colWidth - leftLabelWidth - pad;

  for (const item of config.leftItems) {
    doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor(PDF_THEME.colors.textDark)
      .text(item.label, leftX + pad, curLeftY, { width: leftLabelWidth });
    doc.font(PDF_THEME.fonts.regular).fontSize(9).fillColor(PDF_THEME.colors.textDark)
      .text(item.value, leftX + pad + leftLabelWidth, curLeftY, { width: leftValueWidth });
    curLeftY += lineHeight;
  }

  // Right Column items (Document Metadata)
  let curRightY = config.y + pad;
  const rightLabelWidth = Math.min(colWidth * 0.42, 95);
  const rightValueWidth = colWidth - rightLabelWidth - pad;

  for (const item of config.rightItems) {
    doc.font(PDF_THEME.fonts.bold).fontSize(9).fillColor(PDF_THEME.colors.textDark)
      .text(item.label, rightX, curRightY, { width: rightLabelWidth });
    doc.font(PDF_THEME.fonts.regular).fontSize(9).fillColor(PDF_THEME.colors.textDark)
      .text(item.value, rightX + rightLabelWidth, curRightY, { width: rightValueWidth });
    curRightY += lineHeight;
  }

  return config.y + cardHeight;
};

/**
 * Renders a section header with clean typography and divider.
 */
export const renderSectionHeader = (doc: any, title: string, y: number, margin: number = 40): number => {
  const contentWidth = doc.page.width - margin * 2;
  doc.font(PDF_THEME.fonts.bold)
    .fontSize(10.5)
    .fillColor(PDF_THEME.colors.primaryNavy)
    .text(title, margin, y);

  doc.moveTo(margin, y + 15)
    .lineTo(margin + contentWidth, y + 15)
    .lineWidth(0.5)
    .strokeColor(PDF_THEME.colors.borderLight)
    .stroke();

  return y + 22;
};

/**
 * Renders summary metrics cards horizontally.
 */
export const renderSummaryBlock = (
  doc: any,
  metrics: { label: string; value: string; color?: string }[],
  y: number,
  margin: number = 40
): number => {
  const contentWidth = doc.page.width - margin * 2;
  const gap = 12;
  const cardWidth = (contentWidth - gap * (metrics.length - 1)) / metrics.length;
  const cardHeight = 44;

  metrics.forEach((m, i) => {
    const cardX = margin + i * (cardWidth + gap);
    doc.fillColor(PDF_THEME.colors.bgLight).rect(cardX, y, cardWidth, cardHeight).fill();
    doc.rect(cardX, y, cardWidth, cardHeight).lineWidth(0.5).strokeColor(PDF_THEME.colors.borderLight).stroke();

    doc.font(PDF_THEME.fonts.regular).fontSize(8).fillColor(PDF_THEME.colors.textMuted)
      .text(m.label.toUpperCase(), cardX + 8, y + 7, { width: cardWidth - 16 });

    doc.font(PDF_THEME.fonts.bold).fontSize(11).fillColor(m.color || PDF_THEME.colors.textDark)
      .text(m.value, cardX + 8, y + 21, { width: cardWidth - 16 });
  });

  return y + cardHeight + 12;
};

/**
 * Renders a multi-page capable data table with automatic header repetition, zebra row striping, and cell wrapping.
 */
export const renderDataTable = (doc: any, config: DataTableConfig): number => {
  const margin = config.margin || 40;
  const contentWidth = doc.page.width - margin * 2;
  const columns = config.columns;
  const data = config.data;

  // 1. Calculate smart base widths for each column
  doc.font(PDF_THEME.fonts.bold).fontSize(8.5);

  const baseWidths = columns.map(col => {
    // If width is explicitly given, start with that
    if (col.width && col.width > 0) return col.width;

    const k = col.key.toLowerCase();
    const l = col.label.toLowerCase();
    const isCurrency = /(amount|fee|cost|paid|balance|price|revenue|total|due)/i.test(k) || /(amount|fee|cost|paid|balance|price|revenue|total|due)/i.test(l);
    const isDate = /(date|time|createdat|updatedat)/i.test(k) || /(date|time)/i.test(l);
    const isWide = /(name|description|notes|reason|doctor|supplier|address|subject|treatment)/i.test(k) || /(name|description|notes|reason|doctor|supplier|address|subject|treatment)/i.test(l);
    const isDays = /(days|outstanding)/i.test(k) || /(days|outstanding)/i.test(l);
    const isQty = /(qty|quantity|count)/i.test(k) || /(qty|quantity|count)/i.test(l);
    const isCompact = /(age|gender|token|status)/i.test(k) || /(age|gender|token|status)/i.test(l);

    let w = 85;
    if (isWide) w = 150;
    else if (isDate) w = 105;
    else if (isCurrency) w = 95;
    else if (isDays) w = 100;
    else if (isQty) w = 85;
    else if (isCompact) w = 70;

    // Ensure base width accommodates the label comfortably
    const labelW = doc.widthOfString(col.label.toUpperCase());
    return Math.max(w, Math.min(Math.ceil(labelW + 16), 140));
  });

  // 2. Scale column widths proportionally so they fill EXACTLY contentWidth
  const totalBase = baseWidths.reduce((acc, w) => acc + w, 0);
  const scale = contentWidth / totalBase;
  const colWidths = baseWidths.map(w => Math.floor(w * scale));

  // Distribute any remaining rounding pixels to the widest column
  const currentTotal = colWidths.reduce((acc, w) => acc + w, 0);
  const diff = contentWidth - currentTotal;
  if (diff > 0) {
    let maxIdx = 0;
    for (let i = 1; i < colWidths.length; i++) {
      if (colWidths[i] > colWidths[maxIdx]) maxIdx = i;
    }
    colWidths[maxIdx] += diff;
  }

  const colXPositions: number[] = [];
  let curX = margin;
  for (const w of colWidths) {
    colXPositions.push(curX);
    curX += w;
  }

  // 3. Dynamic header height calculation to guarantee NO header text is clipped or hidden
  const colHeaderHeights = columns.map((col, i) => {
    return doc.heightOfString(col.label.toUpperCase(), { width: colWidths[i] - 8 });
  });
  const maxLabelHeight = Math.max(...colHeaderHeights, 10);
  const headerHeight = Math.max(24, Math.ceil(maxLabelHeight + 12));

  // Function to render the table header row
  const drawTableHeader = (atY: number) => {
    doc.fillColor(PDF_THEME.colors.headerBg).rect(margin, atY, contentWidth, headerHeight).fill();
    doc.rect(margin, atY, contentWidth, headerHeight).lineWidth(0.5).strokeColor(PDF_THEME.colors.border).stroke();

    doc.font(PDF_THEME.fonts.bold).fontSize(8.5).fillColor(PDF_THEME.colors.primaryNavy);
    columns.forEach((col, i) => {
      const align = col.align || 'left';
      const labelH = colHeaderHeights[i];
      const textY = atY + Math.max(5, (headerHeight - labelH) / 2);
      doc.text(col.label.toUpperCase(), colXPositions[i] + 4, textY, {
        width: colWidths[i] - 8,
        align
      });
    });
  };

  let y = config.startY;
  drawTableHeader(y);
  y += headerHeight;

  if (!data || data.length === 0) {
    doc.fillColor(PDF_THEME.colors.bgWhite).rect(margin, y, contentWidth, 30).fill();
    doc.rect(margin, y, contentWidth, 30).lineWidth(0.5).strokeColor(PDF_THEME.colors.borderLight).stroke();
    doc.font(PDF_THEME.fonts.regular).fontSize(9).fillColor(PDF_THEME.colors.textMuted)
      .text('No records found.', margin, y + 10, { align: 'center', width: contentWidth });
    return y + 30;
  }

  const bottomThreshold = doc.page.height - 60; // Leave space for footer

  doc.font(PDF_THEME.fonts.regular).fontSize(8.5);

  data.forEach((row, rowIndex) => {
    // Measure max height needed for this row
    let maxCellHeight = 18;
    columns.forEach((col, i) => {
      const rawVal = row[col.key];
      const valStr = col.format ? col.format(rawVal, row) : (rawVal === null || rawVal === undefined ? '—' : String(rawVal));
      const cellH = doc.heightOfString(valStr, { width: colWidths[i] - 8 });
      if (cellH + 8 > maxCellHeight) maxCellHeight = cellH + 8;
    });

    // Check if new page is needed
    if (y + maxCellHeight > bottomThreshold) {
      doc.addPage();
      y = margin;
      drawTableHeader(y);
      y += headerHeight;
      doc.font(PDF_THEME.fonts.regular).fontSize(8.5);
    }

    // Zebra background
    const rowBg = rowIndex % 2 === 0 ? PDF_THEME.colors.bgWhite : PDF_THEME.colors.bgLight;
    doc.fillColor(rowBg).rect(margin, y, contentWidth, maxCellHeight).fill();

    // Render cells
    columns.forEach((col, i) => {
      const rawVal = row[col.key];
      const valStr = col.format ? col.format(rawVal, row) : (rawVal === null || rawVal === undefined ? '—' : String(rawVal));
      const align = col.align || 'left';
      doc.fillColor(PDF_THEME.colors.textDark)
        .text(valStr, colXPositions[i] + 4, y + 4, {
          width: colWidths[i] - 8,
          align
        });
    });

    // Row bottom border
    doc.moveTo(margin, y + maxCellHeight)
      .lineTo(margin + contentWidth, y + maxCellHeight)
      .lineWidth(0.4)
      .strokeColor(PDF_THEME.colors.borderLight)
      .stroke();

    y += maxCellHeight;
  });

  return y;
};

/**
 * Renders financial breakdown and balance due with status badge.
 */
export const renderFinancialSummary = (
  doc: any,
  financial: {
    items: { label: string; amount: number; isBold?: boolean }[];
    totalAmount: number;
    amountPaid?: number;
    amountDue?: number;
    status?: string;
  },
  y: number,
  margin: number = 40
): number => {
  const contentWidth = doc.page.width - margin * 2;
  const summaryWidth = Math.min(260, contentWidth * 0.5);
  const summaryX = doc.page.width - margin - summaryWidth;

  let curY = y;
  const lineHeight = 18;

  for (const item of financial.items) {
    doc.font(item.isBold ? PDF_THEME.fonts.bold : PDF_THEME.fonts.regular)
      .fontSize(9.5)
      .fillColor(PDF_THEME.colors.textDark)
      .text(item.label, summaryX, curY, { width: summaryWidth * 0.55 });

    doc.font(item.isBold ? PDF_THEME.fonts.bold : PDF_THEME.fonts.regular)
      .fontSize(9.5)
      .fillColor(PDF_THEME.colors.textDark)
      .text(formatCurrency(item.amount), summaryX + summaryWidth * 0.55, curY, {
        width: summaryWidth * 0.45,
        align: 'right'
      });

    curY += lineHeight;
  }

  // Divider
  doc.moveTo(summaryX, curY)
    .lineTo(summaryX + summaryWidth, curY)
    .lineWidth(0.8)
    .strokeColor(PDF_THEME.colors.primaryNavy)
    .stroke();
  curY += 6;

  // Total Gross
  doc.font(PDF_THEME.fonts.bold).fontSize(11).fillColor(PDF_THEME.colors.primaryNavy)
    .text('TOTAL AMOUNT', summaryX, curY, { width: summaryWidth * 0.55 });
  doc.font(PDF_THEME.fonts.bold).fontSize(11).fillColor(PDF_THEME.colors.primaryNavy)
    .text(formatCurrency(financial.totalAmount), summaryX + summaryWidth * 0.55, curY, {
      width: summaryWidth * 0.45,
      align: 'right'
    });
  curY += lineHeight + 2;

  // Paid & Balance Due if present
  if (financial.amountPaid !== undefined) {
    doc.font(PDF_THEME.fonts.regular).fontSize(9.5).fillColor(PDF_THEME.colors.textMuted)
      .text('Amount Paid', summaryX, curY, { width: summaryWidth * 0.55 });
    doc.font(PDF_THEME.fonts.bold).fontSize(9.5).fillColor(PDF_THEME.colors.statusPaid)
      .text(formatCurrency(financial.amountPaid), summaryX + summaryWidth * 0.55, curY, {
        width: summaryWidth * 0.45,
        align: 'right'
      });
    curY += lineHeight;
  }

  if (financial.amountDue !== undefined) {
    const dueColor = financial.amountDue > 0 ? PDF_THEME.colors.statusUnpaid : PDF_THEME.colors.statusPaid;
    doc.font(PDF_THEME.fonts.bold).fontSize(10).fillColor(dueColor)
      .text('Balance Due', summaryX, curY, { width: summaryWidth * 0.55 });
    doc.font(PDF_THEME.fonts.bold).fontSize(10).fillColor(dueColor)
      .text(formatCurrency(financial.amountDue), summaryX + summaryWidth * 0.55, curY, {
        width: summaryWidth * 0.45,
        align: 'right'
      });
    curY += lineHeight;
  }

  return curY;
};

/**
 * Renders doctor signature block only when doctor information is legitimately available.
 * Never invents registration numbers, degrees, or fake seals.
 */
export const renderSignatureBlock = (
  doc: any,
  doctor?: { name?: string; title?: string; regNo?: string; clinicName?: string; phone?: string; email?: string },
  y?: number,
  margin: number = 40,
  options?: { alignBottom?: boolean }
): number => {
  if (!doctor || !doctor.name) {
    return y || doc.y;
  }

  const blockH = 115;
  let startY = y !== undefined ? y : doc.y;
  if (options?.alignBottom) {
    startY = Math.max(startY, doc.page.height - 165);
  }

  // If startY + blockH would collide with the footer
  if (startY + blockH > doc.page.height - 40) {
    doc.addPage();
    startY = margin + 20;
  }

  const blockW = 220;
  const blockX = doc.page.width - margin - blockW;

  doc.font(PDF_THEME.fonts.regular).fontSize(8.5).fillColor(PDF_THEME.colors.textMuted)
    .text('Authorized Signatory', blockX, startY, { width: blockW, align: 'right' });

  // Signature line
  const lineY = startY + 36;
  doc.moveTo(blockX, lineY)
    .lineTo(blockX + blockW, lineY)
    .lineWidth(0.5)
    .strokeColor(PDF_THEME.colors.border)
    .stroke();

  // Clean doctor name
  const drName = cleanDoctorName(doctor.name);
  doc.font(PDF_THEME.fonts.bold).fontSize(9.5).fillColor(PDF_THEME.colors.textDark)
    .text(drName, blockX, lineY + 6, { width: blockW, align: 'right' });

  let curY = lineY + 19;
  if (doctor.title) {
    doc.font(PDF_THEME.fonts.regular).fontSize(8).fillColor(PDF_THEME.colors.textMuted)
      .text(doctor.title, blockX, curY, { width: blockW, align: 'right' });
    curY += 11;
  }

  if (doctor.email) {
    doc.font(PDF_THEME.fonts.regular).fontSize(8).fillColor(PDF_THEME.colors.textMuted)
      .text(doctor.email, blockX, curY, { width: blockW, align: 'right' });
    curY += 11;
  }

  if (doctor.phone) {
    const phText = /^ph(one)?:/i.test(doctor.phone.trim()) ? doctor.phone.trim() : `Phone: ${doctor.phone.trim()}`;
    doc.font(PDF_THEME.fonts.regular).fontSize(8).fillColor(PDF_THEME.colors.textMuted)
      .text(phText, blockX, curY, { width: blockW, align: 'right' });
    curY += 11;
  }

  if (doctor.clinicName) {
    doc.font(PDF_THEME.fonts.regular).fontSize(8).fillColor(PDF_THEME.colors.textMuted)
      .text(doctor.clinicName, blockX, curY, { width: blockW, align: 'right' });
    curY += 11;
  }

  if (doctor.regNo) {
    doc.font(PDF_THEME.fonts.regular).fontSize(8).fillColor(PDF_THEME.colors.textMuted)
      .text(`Reg No: ${doctor.regNo}`, blockX, curY, { width: blockW, align: 'right' });
    curY += 11;
  }

  return curY;
};

/**
 * Two-pass footer applicator rendering clinic footer, disclaimer, and "Page X of Y" across all buffered pages.
 */
export const finalizeDocumentWithFooters = (
  doc: any,
  branding: ClinicBranding,
  options?: { disclaimer?: string; margin?: number }
): void => {
  const margin = options?.margin || 40;
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);

    const footY = doc.page.height - 34;
    const contentWidth = doc.page.width - margin * 2;

    // Divider line
    doc.moveTo(margin, footY)
      .lineTo(margin + contentWidth, footY)
      .lineWidth(0.5)
      .strokeColor(PDF_THEME.colors.borderLight)
      .stroke();

    // Footer Left: Clinic name & contact
    const contactParts: string[] = [branding.name];
    if (branding.phone) contactParts.push(`Ph: ${branding.phone}`);
    if (branding.email) contactParts.push(branding.email);

    doc.font(PDF_THEME.fonts.regular)
      .fontSize(7.5)
      .fillColor(PDF_THEME.colors.textLight)
      .text(contactParts.join('  •  '), margin, footY + 6, {
        width: contentWidth - 100,
        align: 'left'
      });

    // Optional Disclaimer
    if (options?.disclaimer) {
      doc.fontSize(7)
        .fillColor(PDF_THEME.colors.textLight)
        .text(options.disclaimer, margin, footY + 16, {
          width: contentWidth - 100,
          align: 'left'
        });
    }

    // Footer Right: Page numbering
    doc.font(PDF_THEME.fonts.bold)
      .fontSize(8)
      .fillColor(PDF_THEME.colors.textMuted)
      .text(`Page ${i + 1} of ${totalPages}`, doc.page.width - margin - 90, footY + 6, {
        width: 90,
        align: 'right'
      });
  }
};
