import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { prisma } from '../db';

export interface ColumnMapping {
  name?: string;
  phone?: string;
  age?: string;
  dob?: string;
  gender?: string;
  address?: string;
  email?: string;
  preferredCommunicationChannel?: string;
}

export type RowClassification = 'NEW' | 'EXACT_DUPLICATE' | 'PHONE_CONFLICT' | 'INVALID';

export interface ValidatedRow {
  rowNumber: number;
  classification: RowClassification;
  data?: {
    name: string;
    phone: string;
    age: number;
    gender: 'Male' | 'Female' | 'Other';
    address?: string;
    email?: string;
    preferredCommunicationChannel?: 'AUTO' | 'WHATSAPP' | 'SMS' | 'EMAIL' | 'NONE';
  };
  matchedExistingPatient?: {
    id: string;
    name: string;
    phone: string | null;
  };
  errors: string[];
}

export interface InspectionResult {
  fileName: string;
  fileType: 'xlsx' | 'csv';
  totalRows: number;
  headers: string[];
  sampleRows: Record<string, string>[];
  suggestedMappings: ColumnMapping;
  unmappedClinicalColumns: string[];
}

export interface ValidationSummary {
  totalRows: number;
  newCount: number;
  exactDuplicateCount: number;
  phoneConflictCount: number;
  invalidCount: number;
  sampleRows: {
    new: ValidatedRow[];
    exactDuplicates: ValidatedRow[];
    phoneConflicts: ValidatedRow[];
    invalid: ValidatedRow[];
  };
  invalidRowsList: {
    rowNumber: number;
    name?: string;
    phone?: string;
    errors: string[];
  }[];
}

export interface ImportExecutionResult {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  details: {
    rowNumber: number;
    name: string;
    phone: string;
    status: 'IMPORTED' | 'SKIPPED' | 'FAILED';
    reason?: string;
  }[];
}

// Normalize phone numbers (Indian mobile: 10 digits)
export function normalizePhone(raw?: any): string | null {
  if (!raw) return null;
  const str = String(raw).trim();
  const digits = str.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]\d{9}$/.test(digits.substring(1))) {
    return digits.substring(1);
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]\d{9}$/.test(digits.substring(2))) {
    return digits.substring(2);
  }
  return null;
}

// Normalize gender to 'Male' | 'Female' | 'Other'
export function normalizeGender(raw?: any): 'Male' | 'Female' | 'Other' | null {
  if (!raw) return null;
  const val = String(raw).trim().toLowerCase();
  if (val === 'm' || val === 'male') return 'Male';
  if (val === 'f' || val === 'female') return 'Female';
  if (val === 'o' || val === 'other' || val === 'transgender' || val === 't') return 'Other';
  return null;
}

// Calculate age from DOB string or Date
export function calculateAgeFromDOB(raw?: any): number | null {
  if (!raw) return null;
  let d: Date | null = null;
  if (raw instanceof Date) {
    d = raw;
  } else {
    const str = String(raw).trim();
    // Try DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (ddmmyyyy) {
      d = new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
    } else {
      const parsed = Date.parse(str);
      if (!isNaN(parsed)) {
        d = new Date(parsed);
      }
    }
  }

  if (!d || isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  if (age >= 0 && age <= 125) {
    return age;
  }
  return null;
}

// Suggest mappings based on column names
export function suggestColumnMappings(headers: string[]): {
  mappings: ColumnMapping;
  unmappedClinical: string[];
} {
  const mappings: ColumnMapping = {};
  const unmappedClinical: string[] = [];

  const clinicalRegex = /(diagnosis|treatment|prescription|medicine|dosage|tooth|notes?|clinical|payment|bill|amount|fee|visit[_\s]?date|history|implant|scaling|rct|caries)/i;

  for (const h of headers) {
    const clean = h.trim();
    const lower = clean.toLowerCase();

    if (clinicalRegex.test(lower)) {
      unmappedClinical.push(clean);
      continue;
    }

    if (!mappings.name && /^(name|patient[_\s]?name|full[_\s]?name|first[_\s]?name|client[_\s]?name)$/i.test(lower)) {
      mappings.name = clean;
    } else if (!mappings.phone && /^(phone|mobile|contact|cell|phone[_\s]?(no|num|number)?|mobile[_\s]?(no|num|number)?|contact[_\s]?(no|num|number)?)$/i.test(lower)) {
      mappings.phone = clean;
    } else if (!mappings.age && /^(age|patient[_\s]?age|years)$/i.test(lower)) {
      mappings.age = clean;
    } else if (!mappings.dob && /^(dob|date[_\s]?of[_\s]?birth|birth[_\s]?date|birthdate)$/i.test(lower)) {
      mappings.dob = clean;
    } else if (!mappings.gender && /^(gender|sex)$/i.test(lower)) {
      mappings.gender = clean;
    } else if (!mappings.address && /^(address|city|location|residential[_\s]?address)$/i.test(lower)) {
      mappings.address = clean;
    } else if (!mappings.email && /^(email|e-mail|mail|email[_\s]?address)$/i.test(lower)) {
      mappings.email = clean;
    }
  }

  return { mappings, unmappedClinical };
}

// Load workbook rows safely from Buffer
export async function parseFileRows(
  buffer: Buffer,
  fileType: 'xlsx' | 'csv'
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const workbook = new ExcelJS.Workbook();

  if (fileType === 'xlsx') {
    await workbook.xlsx.load(buffer as any);
  } else if (fileType === 'csv') {
    const stream = Readable.from(buffer);
    await workbook.csv.read(stream);
  } else {
    throw new Error('Unsupported file format. Only .xlsx and .csv are supported.');
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 1) {
    return { headers: [], rows: [] };
  }

  // Row 1: Headers
  const headerRow = worksheet.getRow(1);
  const rawHeaders = Array.isArray(headerRow.values)
    ? headerRow.values.slice(1).map(v => (v !== null && v !== undefined ? String(v).trim() : ''))
    : [];

  const headers = rawHeaders.filter(h => h.length > 0);
  if (headers.length === 0) {
    return { headers: [], rows: [] };
  }

  const rows: Record<string, string>[] = [];
  const totalRows = worksheet.rowCount;

  for (let r = 2; r <= totalRows; r++) {
    const row = worksheet.getRow(r);
    const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
    const isRowEmpty = rowValues.every(v => v === null || v === undefined || String(v).trim() === '');
    if (isRowEmpty) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      const cellVal = rowValues[idx];
      rowObj[header] = cellVal !== null && cellVal !== undefined ? String(cellVal).trim() : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

// Inspect file metadata, headers, sample rows & auto-mapping
export async function inspectFile(
  buffer: Buffer,
  fileName: string,
  fileType: 'xlsx' | 'csv'
): Promise<InspectionResult> {
  const { headers, rows } = await parseFileRows(buffer, fileType);
  const { mappings, unmappedClinical } = suggestColumnMappings(headers);

  return {
    fileName,
    fileType,
    totalRows: rows.length,
    headers,
    sampleRows: rows.slice(0, 5),
    suggestedMappings: mappings,
    unmappedClinicalColumns: unmappedClinical
  };
}

// Validate rows against Patient schema & database duplicates
export async function validateRows(
  rows: Record<string, string>[],
  mappings: ColumnMapping
): Promise<ValidationSummary> {
  // Collect all normalized phones to query DB in a single batch
  const normalizedPhoneMap = new Map<number, string>();
  const allPhones: string[] = [];

  rows.forEach((row, idx) => {
    const rawPhone = mappings.phone ? row[mappings.phone] : undefined;
    const norm = normalizePhone(rawPhone);
    if (norm) {
      normalizedPhoneMap.set(idx, norm);
      allPhones.push(norm);
    }
  });

  // Query existing patients in single DB query
  const existingPatients = allPhones.length > 0
    ? await prisma.patient.findMany({
        where: { phone: { in: Array.from(new Set(allPhones)) } },
        select: { id: true, name: true, phone: true }
      })
    : [];

  const existingPhoneMap = new Map<string, { id: string; name: string; phone: string | null }>();
  existingPatients.forEach(p => {
    if (p.phone) {
      existingPhoneMap.set(p.phone, p);
    }
  });

  const seenInFilePhones = new Map<string, { rowNumber: number; name: string }>();

  const validatedRows: ValidatedRow[] = [];
  const invalidRowsList: ValidationSummary['invalidRowsList'] = [];

  let newCount = 0;
  let exactDuplicateCount = 0;
  let phoneConflictCount = 0;
  let invalidCount = 0;

  const sampleNew: ValidatedRow[] = [];
  const sampleExact: ValidatedRow[] = [];
  const sampleConflict: ValidatedRow[] = [];
  const sampleInvalid: ValidatedRow[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // Data rows start at line 2
    const errors: string[] = [];

    // 1. Name validation
    const rawName = mappings.name ? row[mappings.name] : undefined;
    const name = rawName ? String(rawName).trim() : '';
    if (!name) {
      errors.push('Name is required');
    }

    // 2. Phone validation
    const rawPhone = mappings.phone ? row[mappings.phone] : undefined;
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      errors.push('Missing or invalid phone number — Phone is a mandatory 10-digit unique identifier in DentalCore');
    }

    // 3. Age validation (from Age or DOB)
    let age: number | null = null;
    if (mappings.age && row[mappings.age]) {
      const parsedAge = parseInt(String(row[mappings.age]).trim(), 10);
      if (!isNaN(parsedAge) && parsedAge >= 0 && parsedAge <= 125) {
        age = parsedAge;
      }
    }
    if (age === null && mappings.dob && row[mappings.dob]) {
      age = calculateAgeFromDOB(row[mappings.dob]);
    }
    if (age === null) {
      errors.push('Valid Age (0-125) or Date of Birth is required');
    }

    // 4. Gender validation
    const rawGender = mappings.gender ? row[mappings.gender] : undefined;
    const gender = normalizeGender(rawGender);
    if (!gender) {
      errors.push("Gender must be Male, Female, or Other");
    }

    // 5. Optional fields
    const address = mappings.address && row[mappings.address] ? String(row[mappings.address]).trim() : undefined;
    const email = mappings.email && row[mappings.email] ? String(row[mappings.email]).trim() : undefined;
    let preferredCommunicationChannel: any = 'AUTO';
    if (mappings.preferredCommunicationChannel && row[mappings.preferredCommunicationChannel]) {
      const pref = String(row[mappings.preferredCommunicationChannel]).trim().toUpperCase();
      if (['AUTO', 'WHATSAPP', 'SMS', 'EMAIL', 'NONE'].includes(pref)) {
        preferredCommunicationChannel = pref;
      }
    }

    // If schema validation failed -> INVALID
    if (errors.length > 0 || !phone || !name || age === null || !gender) {
      invalidCount++;
      const item: ValidatedRow = {
        rowNumber,
        classification: 'INVALID',
        errors
      };
      validatedRows.push(item);
      invalidRowsList.push({ rowNumber, name, phone: rawPhone, errors });
      if (sampleInvalid.length < 5) sampleInvalid.push(item);
      return;
    }

    // Check In-File Duplicate
    if (seenInFilePhones.has(phone)) {
      const prev = seenInFilePhones.get(phone)!;
      const isSameName = prev.name.toLowerCase().trim() === name.toLowerCase().trim();
      const classification: RowClassification = isSameName ? 'EXACT_DUPLICATE' : 'PHONE_CONFLICT';
      const reason = isSameName
        ? `Duplicate record inside file (same phone as Row ${prev.rowNumber})`
        : `Shared phone number inside file (Phone already used for "${prev.name}" in Row ${prev.rowNumber})`;

      if (classification === 'EXACT_DUPLICATE') {
        exactDuplicateCount++;
        const item: ValidatedRow = { rowNumber, classification, errors: [reason] };
        validatedRows.push(item);
        if (sampleExact.length < 5) sampleExact.push(item);
      } else {
        phoneConflictCount++;
        const item: ValidatedRow = { rowNumber, classification, errors: [reason] };
        validatedRows.push(item);
        if (sampleConflict.length < 5) sampleConflict.push(item);
      }
      return;
    }

    // Check DB Duplicate
    if (existingPhoneMap.has(phone)) {
      const existing = existingPhoneMap.get(phone)!;
      const isSameName = existing.name.toLowerCase().trim() === name.toLowerCase().trim();
      const classification: RowClassification = isSameName ? 'EXACT_DUPLICATE' : 'PHONE_CONFLICT';
      const reason = isSameName
        ? `Patient already exists in database (${existing.name}, Phone: ${existing.phone})`
        : `Phone conflict: Phone number is already registered to existing patient: "${existing.name}"`;

      if (classification === 'EXACT_DUPLICATE') {
        exactDuplicateCount++;
        const item: ValidatedRow = {
          rowNumber,
          classification,
          matchedExistingPatient: existing,
          errors: [reason]
        };
        validatedRows.push(item);
        if (sampleExact.length < 5) sampleExact.push(item);
      } else {
        phoneConflictCount++;
        const item: ValidatedRow = {
          rowNumber,
          classification,
          matchedExistingPatient: existing,
          errors: [reason]
        };
        validatedRows.push(item);
        if (sampleConflict.length < 5) sampleConflict.push(item);
      }
      return;
    }

    // New valid record
    seenInFilePhones.set(phone, { rowNumber, name });
    newCount++;
    const validItem: ValidatedRow = {
      rowNumber,
      classification: 'NEW',
      data: {
        name,
        phone,
        age,
        gender,
        address,
        email,
        preferredCommunicationChannel
      },
      errors: []
    };
    validatedRows.push(validItem);
    if (sampleNew.length < 5) sampleNew.push(validItem);
  });

  return {
    totalRows: rows.length,
    newCount,
    exactDuplicateCount,
    phoneConflictCount,
    invalidCount,
    sampleRows: {
      new: sampleNew,
      exactDuplicates: sampleExact,
      phoneConflicts: sampleConflict,
      invalid: sampleInvalid
    },
    invalidRowsList
  };
}

// Execute patient import (Additive only) in safe batches
export async function executeImport(
  buffer: Buffer,
  fileType: 'xlsx' | 'csv',
  mappings: ColumnMapping
): Promise<ImportExecutionResult> {
  const { rows } = await parseFileRows(buffer, fileType);
  const validation = await validateRows(rows, mappings);

  // We re-query the DB to ensure full atomicity and idempotency
  const seenPhones = new Set<string>();
  const toInsert: {
    name: string;
    phone: string;
    age: number;
    gender: string;
    address?: string;
    email?: string;
    preferredCommunicationChannel: any;
    status: string;
  }[] = [];

  const details: ImportExecutionResult['details'] = [];
  let skippedCount = 0;
  let failedCount = 0;

  // Process rows sequentially to build insert list
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNumber = idx + 2;

    const rawName = mappings.name ? row[mappings.name] : undefined;
    const name = rawName ? String(rawName).trim() : '';
    const rawPhone = mappings.phone ? row[mappings.phone] : undefined;
    const phone = normalizePhone(rawPhone);

    let age: number | null = null;
    if (mappings.age && row[mappings.age]) {
      const p = parseInt(String(row[mappings.age]).trim(), 10);
      if (!isNaN(p) && p >= 0 && p <= 125) age = p;
    }
    if (age === null && mappings.dob && row[mappings.dob]) {
      age = calculateAgeFromDOB(row[mappings.dob]);
    }

    const rawGender = mappings.gender ? row[mappings.gender] : undefined;
    const gender = normalizeGender(rawGender);

    if (!name || !phone || age === null || !gender) {
      failedCount++;
      details.push({
        rowNumber,
        name: name || 'Unknown',
        phone: rawPhone ? String(rawPhone) : 'None',
        status: 'FAILED',
        reason: 'Failed validation (missing required fields or invalid format)'
      });
      continue;
    }

    if (seenPhones.has(phone)) {
      skippedCount++;
      details.push({
        rowNumber,
        name,
        phone,
        status: 'SKIPPED',
        reason: 'In-file duplicate or conflict'
      });
      continue;
    }

    // Check DB
    const existing = await prisma.patient.findUnique({
      where: { phone },
      select: { id: true, name: true }
    });

    if (existing) {
      skippedCount++;
      details.push({
        rowNumber,
        name,
        phone,
        status: 'SKIPPED',
        reason: `Phone already exists in database (${existing.name})`
      });
      continue;
    }

    seenPhones.add(phone);
    const address = mappings.address && row[mappings.address] ? String(row[mappings.address]).trim() : undefined;
    const email = mappings.email && row[mappings.email] ? String(row[mappings.email]).trim() : undefined;

    let preferredCommunicationChannel: any = 'AUTO';
    if (mappings.preferredCommunicationChannel && row[mappings.preferredCommunicationChannel]) {
      const pref = String(row[mappings.preferredCommunicationChannel]).trim().toUpperCase();
      if (['AUTO', 'WHATSAPP', 'SMS', 'EMAIL', 'NONE'].includes(pref)) {
        preferredCommunicationChannel = pref;
      }
    }

    toInsert.push({
      name,
      phone,
      age,
      gender,
      address,
      email,
      preferredCommunicationChannel,
      status: 'Active'
    });
  }

  // Safe batch insert in chunks of 100
  let importedCount = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    await prisma.patient.createMany({
      data: batch,
      skipDuplicates: true
    });
    importedCount += batch.length;

    batch.forEach(item => {
      details.push({
        rowNumber: 0,
        name: item.name,
        phone: item.phone,
        status: 'IMPORTED'
      });
    });
  }

  return {
    totalRows: rows.length,
    importedCount,
    skippedCount,
    failedCount,
    details
  };
}
