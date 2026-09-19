import ExcelJS from 'exceljs';
import { getClinicBranding, formatCurrency, formatHumanDate } from './pdf/clinicBranding';
import {
  initPDFDocument,
  renderClinicHeader,
  renderDocumentTitle,
  renderDataTable,
  finalizeDocumentWithFooters,
  DataTableColumn
} from './pdf/pdfComponents';

export interface ExportColumn {
  key: string;
  label: string;
}

export const generateCSV = (columns: ExportColumn[], data: any[]): string => {
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = columns.map(c => escapeCsv(c.label)).join(',');
  const dataRows = data.map(row => {
    return columns.map(c => escapeCsv(row[c.key])).join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF) so Excel on Windows properly recognizes UTF-8 formatting and symbols like ₹
  return '\uFEFF' + [headerRow, ...dataRows].join('\n');
};

export const generateXLSX = async (columns: ExportColumn[], data: any[], sheetName: string = 'Data'): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = columns.map(c => ({
    header: c.label,
    key: c.key,
    width: 20
  }));

  data.forEach(row => {
    worksheet.addRow(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks if a column key/label represents an internal database identifier that must NOT be exposed in PDF reports.
 * Preserves legitimate business document numbers (e.g. orderNumber, receiptNo, invoiceNumber, documentNumber).
 */
const isInternalIdentifier = (key: string, label: string): boolean => {
  const k = key.toLowerCase().trim();
  const l = label.toLowerCase().trim();

  // Explicit allowed business identifiers
  if (/^(ordernumber|billnumber|receiptno|invoicenumber|documentnumber|token|referenceno|code)$/i.test(k)) {
    return false;
  }
  // Internal database keys
  if (/^(id|patientid|visitid|paymentid|staffid|userid|providerid|categoryid|queueid|dispensingid)$/i.test(k)) {
    return true;
  }
  if (/(patient|visit|payment|staff|user|provider|category|queue)\s*id/i.test(l)) {
    return true;
  }
  if (l === 'id' || l === 'uuid') {
    return true;
  }
  return false;
};

/**
 * Production-grade tabular report PDF generator.
 * Uses shared clinic branding, logo, balanced A4 landscape layout, dynamic columns,
 * currency formatting, repeated table headers, and two-pass page numbering ("Page X of Y").
 */
export const generatePDF = (
  columns: ExportColumn[],
  data: any[],
  title: string,
  subtitle?: string
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    // A4 Landscape: width 841.89 pt, height 595.28 pt
    const doc = initPDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const branding = getClinicBranding();
    const margin = 40;
    const contentWidth = doc.page.width - margin * 2; // ~761.89 pt

    // 1. Clinic Header
    let currentY = renderClinicHeader(doc, branding, { margin });

    // 2. Report Title & Subtitle
    currentY = renderDocumentTitle(doc, title, subtitle, undefined, currentY, margin);
    currentY += 4;

    // 3. Filter out internal database ID columns
    const sanitizedColumns = columns.filter(c => !isInternalIdentifier(c.key, c.label));

    // 4. Determine smart column widths and alignments
    const tableColumns: DataTableColumn[] = sanitizedColumns.map(col => {
      const k = col.key.toLowerCase();
      const l = col.label.toLowerCase();

      const isCount = /(visit|patient|count|qty|quantity|item|order|unit|token|number|no\b|attendance|days|age)/i.test(k) || /(visit|patient|count|qty|quantity|item|order|unit|token|number|no\b|attendance|days|age)/i.test(l);
      const isCurrency = !isCount && (/(amount|fee|cost|paid|balance|price|revenue|due)/i.test(k) || /(amount|fee|cost|paid|balance|price|revenue|due)/i.test(l));
      const isDate = /(date|time|createdat|updatedat)/i.test(k) || /(date|time)/i.test(l);
      const isCompact = /(age|gender|token|status|days|qty|quantity|visit|patient|count|item|unit)/i.test(k) || /(age|gender|token|status|days|qty|quantity|visit|patient|count|item|unit)/i.test(l);
      const isWide = /(name|description|notes|reason|doctor|supplier|address|subject|treatment)/i.test(k) || /(name|description|notes|reason|doctor|supplier|address|subject|treatment)/i.test(l);

      let align: 'left' | 'center' | 'right' = 'left';
      if (isCurrency) align = 'right';
      else if (isCompact && !isDate) align = 'center';

      return {
        key: col.key,
        label: col.label,
        align,
        // Will be proportionally balanced across full landscape width by renderDataTable
        width: undefined,
        format: (val: any) => {
          if (val === null || val === undefined) return '—';
          // Sanitize if a raw UUID happens to slip into a cell value
          if (typeof val === 'string' && UUID_REGEX.test(val.trim())) {
            return '—';
          }
          if (isCurrency && typeof val === 'number') {
            return formatCurrency(val);
          }
          if (isCurrency && typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') {
            return formatCurrency(Number(val));
          }
          if (isDate && (val instanceof Date || (typeof val === 'string' && !isNaN(Date.parse(val)) && val.length >= 8 && !/^\d+$/.test(val)))) {
            return formatHumanDate(val);
          }
          return String(val);
        }
      };
    });

    // 5. Render Data Table (with automatic header repetition across pages)
    renderDataTable(doc, {
      columns: tableColumns,
      data,
      startY: currentY,
      margin
    });

    // 6. Two-pass page numbering & footers
    finalizeDocumentWithFooters(doc, branding, { margin });

    doc.end();
  });
};
