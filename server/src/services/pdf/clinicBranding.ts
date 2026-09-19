import path from 'path';
import fs from 'fs';
import { getCanonicalClinicConfig } from '../../config/clinicConfig';

export interface ClinicBranding {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoPath?: string | null;
}

/**
 * Resolves the clinic logo asset on disk.
 * Returns absolute path if found, or null if unconfigured.
 */
export const resolveLogoPath = (): string | null => {
  const candidatePaths = [
    path.join(process.cwd(), 'src/assets/dental-logo-trimmed.png'),
    path.join(process.cwd(), 'src/assets/dental-logo.png'),
    path.join(process.cwd(), '../public/dental-logo-trimmed.png'),
    path.join(process.cwd(), '../public/dental-logo.png'),
    path.join(process.cwd(), 'public/dental-logo-trimmed.png'),
    path.join(__dirname, '../../assets/dental-logo-trimmed.png'),
    path.join(__dirname, '../../assets/dental-logo.png'),
    path.join(__dirname, '../../../src/assets/dental-logo-trimmed.png'),
    path.join(__dirname, '../../../src/assets/dental-logo.png'),
    path.join(__dirname, '../../../public/dental-logo-trimmed.png'),
    path.join(__dirname, '../../../public/dental-logo.png')
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
};

/**
 * Authoritative provider for clinic branding.
 * Overrides can be passed per-document (e.g. historical snapshots in reimbursement claims).
 * Does NOT invent missing fields.
 */
export const getClinicBranding = (overrides?: Partial<ClinicBranding>): ClinicBranding => {
  const base = getCanonicalClinicConfig();
  const rawAddress = overrides?.address !== undefined ? (overrides.address?.trim() || undefined) : base.address;
  const sanitizedAddress = rawAddress
    ? rawAddress.replace(/,?\s*near\s+Government\s+Hospital,?\s*/gi, ', ').trim().replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',')
    : undefined;

  return {
    name: overrides?.name?.trim() || base.name,
    address: sanitizedAddress,
    phone: overrides?.phone !== undefined ? (overrides.phone?.trim() || undefined) : base.phone,
    email: overrides?.email !== undefined ? (overrides.email?.trim() || undefined) : base.email,
    logoPath: overrides?.logoPath !== undefined ? overrides.logoPath : resolveLogoPath()
  };
};

/**
 * Formats a numeric amount using the Indian Rupee currency standard:
 * Examples: ₹2,890, ₹2,000, ₹890
 * Supports 2 decimal places if present, or integers cleanly.
 */
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '₹0';
  }
  const num = Number(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  
  // Format integer and fractional parts
  const parts = absNum.toFixed(2).split('.');
  let intPart = parts[0];
  const decPart = parts[1];

  // Indian numbering system: 3 digits, then groups of 2 digits
  let lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  // If decimal part is '00', omit it for clean whole rupee figures (e.g. ₹2,890)
  const result = decPart === '00' ? formattedInt : `${formattedInt}.${decPart}`;
  return isNegative ? `-₹${result}` : `₹${result}`;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a date into uniform project-wide human-readable format: DD MMM YYYY (e.g. "17 Sep 2026")
 */
export const formatHumanDate = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);

  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

/**
 * Splits an address string into clean, readable multi-line chunks for PDF headers without awkward word wraps.
 */
export const formatAddressLines = (address?: string): string[] => {
  if (!address) return [];
  // Strip "near Government Hospital," or similar landmark phrasing if present
  let cleaned = address.replace(/,?\s*near\s+Government\s+Hospital,?\s*/gi, ', ').trim();
  // Clean duplicate town names if present in legacy strings
  cleaned = cleaned.replace(/Gopichettipalayam,\s*Gobichettipalayam/gi, 'Gobichettipalayam').trim();
  cleaned = cleaned.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',');
  const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
  
  if (parts.length <= 2) return [cleaned];
  
  const lines: string[] = [];
  let current = '';
  for (const part of parts) {
    if ((current + ', ' + part).length > 45 && current.length > 0) {
      lines.push(current);
      current = part;
    } else {
      current = current.length > 0 ? `${current}, ${part}` : part;
    }
  }
  if (current) lines.push(current);
  return lines;
};

/**
 * Formats a doctor's name cleanly with "Dr." prefix, avoiding duplicates like "Dr. DR ...".
 */
export const cleanDoctorName = (name?: string | null): string => {
  if (!name) return 'Doctor';
  const trimmed = name.trim();
  if (/^dr\.?\s+/i.test(trimmed)) {
    return `Dr. ${trimmed.replace(/^dr\.?\s+/i, '')}`;
  }
  return `Dr. ${trimmed}`;
};

/**
 * Converts a positive number to Indian Rupee word format (e.g. 559 -> "Five Hundred Fifty-Nine Rupees Only")
 */
export const numberToWordsIndian = (num: number): string => {
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanOneThousand = (n: number): string => {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + a[n % 10] : '') + ' ';
    } else if (n > 0) {
      str += a[n] + ' ';
    }
    return str.trim();
  };

  const integerPart = Math.floor(num);
  let n = integerPart;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const remainder = n;

  let result = '';
  if (crore > 0) result += convertLessThanOneThousand(crore) + ' Crore ';
  if (lakh > 0) result += convertLessThanOneThousand(lakh) + ' Lakh ';
  if (thousand > 0) result += convertLessThanOneThousand(thousand) + ' Thousand ';
  if (remainder > 0) result += convertLessThanOneThousand(remainder) + ' ';

  result = result.trim();
  return result ? `${result} Rupees Only` : 'Zero Rupees Only';
};

/**
 * Formats staff roles or usernames into clean readable titles (e.g. "headdoctor" -> "Head Doctor")
 */
export const formatStaffRoleOrName = (val?: string | null): string => {
  if (!val) return 'Staff';
  const trimmed = val.trim();
  if (trimmed.toLowerCase() === 'headdoctor') return 'Head Doctor';
  if (trimmed.toLowerCase() === 'receptionist') return 'Receptionist';
  return trimmed
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

