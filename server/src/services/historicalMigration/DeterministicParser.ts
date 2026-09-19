export interface ExtractedSixFields {
  patientName: string | null;
  phoneNumber: string | null;
  age: number | null;
  gender: 'Male' | 'Female' | 'Other' | null;
  visitDate: Date | null;
  reasonForVisit: string | null;
  multipleDatesDetected: boolean;
}

/**
 * DeterministicParser
 * 
 * Extracts STRICTLY the six locked fields:
 * 1. Patient Name
 * 2. Phone Number
 * 3. Age
 * 4. Gender
 * 5. Visit Date
 * 6. Reason for Visit
 * 
 * Strict Invariants:
 * - Zero treatment extraction
 * - Zero medicine/prescription extraction
 * - Zero diagnosis/clinical NLP
 * - Zero odontogram/tooth extraction
 * - Zero payments/billing extraction
 * - Zero treatment plans
 * - Zero medical AI
 * - Zero fabricated defaults (No 0, No "Unknown", No fake phone)
 * - Missing fields remain strictly null
 */
export class DeterministicParser {
  static parse(rawText: string): ExtractedSixFields {
    if (!rawText || !rawText.trim()) {
      return {
        patientName: null,
        phoneNumber: null,
        age: null,
        gender: null,
        visitDate: null,
        reasonForVisit: null,
        multipleDatesDetected: false
      };
    }

    const lines = rawText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const phoneNumber = this.extractPhone(lines, rawText);
    const age = this.extractAge(lines, rawText);
    const gender = this.extractGender(lines, rawText);
    const { visitDate, multipleDatesDetected } = this.extractVisitDate(lines, rawText);
    const patientName = this.extractName(lines);
    const reasonForVisit = this.extractReason(lines);

    return {
      patientName,
      phoneNumber,
      age,
      gender,
      visitDate,
      reasonForVisit,
      multipleDatesDetected
    };
  }

  /**
   * 1. Patient Name Extraction
   * Looks for name prefixes (Pt:, Patient:, Name:, Shri, Smt, Mr, Mrs, Dr)
   * If not found, falls back to the first non-header, non-date alphabetical line.
   */
  private static extractName(lines: string[]): string | null {
    // 1. Explicit Prefix Search
    for (const line of lines) {
      const prefixMatch = line.match(/(?:(?:pt|patient|name|patient\s*name)\s*[:\-\.]\s*)([A-Za-z\s\.\'\-]+)/i);
      if (prefixMatch && prefixMatch[1]) {
        const candidate = this.cleanName(prefixMatch[1]);
        if (candidate) return candidate;
      }
    }

    // 2. Title prefix search (e.g. Mr. Ramesh Kumar, Smt. Geeta)
    for (const line of lines) {
      const titleMatch = line.match(/\b(Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Shri|Smt\.?)\s+([A-Za-z\s\.\'\-]+)/i);
      if (titleMatch && titleMatch[2]) {
        // Guard: Don't capture doctor clinic header e.g. "Dr. Sharma Dental Clinic"
        if (!/clinic|hospital|dental|care|centre|center/i.test(line)) {
          const candidate = this.cleanName(`${titleMatch[1]} ${titleMatch[2]}`);
          if (candidate) return candidate;
        }
      }
    }

    // 3. Heuristic: First alphabetic line that is not a clinic title/header or metadata
    for (const line of lines.slice(0, 8)) {
      if (/clinic|hospital|dental|date|phone|mobile|tel|age|sex|gender|c\/o|rx|prescription|invoice|receipt/i.test(line)) {
        continue;
      }
      const lettersOnly = line.replace(/[^A-Za-z]/g, '');
      if (lettersOnly.length >= 3 && lettersOnly.length <= 40) {
        // Likely patient name
        const candidate = this.cleanName(line);
        if (candidate) return candidate;
      }
    }

    return null;
  }

  private static cleanName(raw: string): string | null {
    const cleaned = raw
      .replace(/[0-9:;,~|/*\\_()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length < 2) return null;
    // Don't accept purely common non-name words
    if (/^(dental|clinic|hospital|doctor|patient|date|time|teeth|tooth|rx)$/i.test(cleaned)) {
      return null;
    }
    return cleaned;
  }

  /**
   * 2. Phone Number Extraction
   * Standard 10-digit Indian mobile numbers starting with 6-9, with optional +91/0 prefix.
   */
  private static extractPhone(lines: string[], rawText: string): string | null {
    // Look line by line for phone prefixes first
    for (const line of lines) {
      if (/(?:ph|phone|mob|mobile|contact|tel)\s*[:\-\.]?/i.test(line)) {
        const afterPrefix = line.replace(/^.*?(?:ph|phone|mob|mobile|contact|tel)\s*[:\-\.]?/i, '');
        const digitsOnly = afterPrefix.replace(/\D/g, '');
        if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
          return digitsOnly;
        }
        if (digitsOnly.length === 12 && digitsOnly.startsWith('91') && /^[6-9]/.test(digitsOnly.slice(2))) {
          return digitsOnly.slice(2);
        }
        if (digitsOnly.length === 11 && digitsOnly.startsWith('0') && /^[6-9]/.test(digitsOnly.slice(1))) {
          return digitsOnly.slice(1);
        }
      }
    }

    // Full text regex search allowing optional spaces or hyphens between digit blocks
    const pattern = /(?:(?:\+|0{0,2})91[\s-]*)?([6-9]\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}|[6-9]\d{9})\b/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(rawText)) !== null) {
      const digits = match[0].replace(/\D/g, '');
      const normalized = digits.slice(-10);
      if (normalized.length === 10 && /^[6-9]/.test(normalized)) {
        return normalized;
      }
    }

    return null;
  }

  /**
   * 3. Age Extraction
   * Patterns: Age: 42, 42 Yrs, 42/M. Strictly validated 1..115. Never 0.
   */
  private static extractAge(lines: string[], rawText: string): number | null {
    // Prefix search e.g. Age: 35 or Age - 35
    for (const line of lines) {
      const match = line.match(/\b(?:age|yr|yrs|years)\s*[:\-\.]?\s*(\d{1,3})\b/i);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (val >= 1 && val <= 115) return val;
      }
    }

    // Pattern: 42 Yrs / 42 Y
    const yrsMatch = rawText.match(/\b(\d{1,3})\s*(?:yrs?|years?|y)\b/i);
    if (yrsMatch && yrsMatch[1]) {
      const val = parseInt(yrsMatch[1], 10);
      if (val >= 1 && val <= 115) return val;
    }

    // Composite Age/Sex pattern e.g. "35/M", "28 / F"
    const compositeMatch = rawText.match(/\b(\d{1,3})\s*[/]\s*(?:m(?:ale)?|f(?:emale)?)\b/i);
    if (compositeMatch && compositeMatch[1]) {
      const val = parseInt(compositeMatch[1], 10);
      if (val >= 1 && val <= 115) return val;
    }

    return null;
  }

  /**
   * 4. Gender Extraction
   * Male, Female, Other. Never defaults to "Unknown".
   */
  private static extractGender(lines: string[], rawText: string): 'Male' | 'Female' | 'Other' | null {
    // Explicit Prefix Search e.g. Sex: M or Gender: Female
    for (const line of lines) {
      const match = line.match(/\b(?:sex|gender)\s*[:\-\.]?\s*(male|female|other|m|f)\b/i);
      if (match && match[1]) {
        return this.normalizeGender(match[1]);
      }
    }

    // Composite Age/Sex e.g. 42/M or 28/F
    const compositeMatch = rawText.match(/\b\d{1,3}\s*[/]\s*(m(?:ale)?|f(?:emale)?)\b/i);
    if (compositeMatch && compositeMatch[1]) {
      return this.normalizeGender(compositeMatch[1]);
    }

    // Standalone tokens if labeled
    for (const line of lines) {
      if (/\b(?:mr|shri)\b/i.test(line) && !/\b(?:mrs|smt|dr)\b/i.test(line)) {
        // Can infer male with caution if in name line
        return 'Male';
      }
      if (/\b(?:mrs|ms|smt|miss)\b/i.test(line)) {
        return 'Female';
      }
    }

    return null;
  }

  private static normalizeGender(token: string): 'Male' | 'Female' | 'Other' | null {
    const t = token.toLowerCase();
    if (t === 'm' || t === 'male') return 'Male';
    if (t === 'f' || t === 'female') return 'Female';
    if (t === 'other') return 'Other';
    return null;
  }

  /**
   * 5. Visit Date Extraction
   * Formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD Mon YYYY
   */
  private static extractVisitDate(lines: string[], rawText: string): { visitDate: Date | null; multipleDatesDetected: boolean } {
    const foundDates: Date[] = [];

    // Date regex patterns
    // 1. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const numericDateRegex = /\b([0-3]?\d)[\/\-\.]([0-1]?\d)[\/\-\.]((?:19|20)?\d{2})\b/g;
    let match: RegExpExecArray | null;

    while ((match = numericDateRegex.exec(rawText)) !== null) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      let year = parseInt(match[3], 10);
      if (year < 100) {
        year += year > 50 ? 1900 : 2000;
      }

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1990 && year <= 2030) {
        const d = new Date(Date.UTC(year, month - 1, day));
        if (!isNaN(d.getTime())) {
          foundDates.push(d);
        }
      }
    }

    // 2. DD Mon YYYY e.g. 12 Jun 2016, 15 August 2018
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const textDateRegex = /\b([0-3]?\d)\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,\s]+((?:19|20)?\d{2})\b/gi;

    while ((match = textDateRegex.exec(rawText)) !== null) {
      const day = parseInt(match[1], 10);
      const mStr = match[2].slice(0, 3).toLowerCase();
      const month = months.indexOf(mStr);
      let year = parseInt(match[3], 10);
      if (year < 100) {
        year += year > 50 ? 1900 : 2000;
      }

      if (day >= 1 && day <= 31 && month !== -1 && year >= 1990 && year <= 2030) {
        const d = new Date(Date.UTC(year, month, day));
        if (!isNaN(d.getTime())) {
          foundDates.push(d);
        }
      }
    }

    // Deduplicate distinct dates
    const uniqueTimeStamps = Array.from(new Set(foundDates.map(d => d.getTime())));
    const multipleDatesDetected = uniqueTimeStamps.length > 1;

    // Check if one date has explicit "Date:" or "Dt:" prefix
    for (const line of lines) {
      if (/(?:date|dt|visit\s*date)\s*[:\-\.]/i.test(line)) {
        const lineMatch = line.match(/\b([0-3]?\d)[\/\-\.]([0-1]?\d)[\/\-\.]((?:19|20)?\d{2})\b/);
        if (lineMatch) {
          const day = parseInt(lineMatch[1], 10);
          const month = parseInt(lineMatch[2], 10);
          let year = parseInt(lineMatch[3], 10);
          if (year < 100) year += year > 50 ? 1900 : 2000;
          if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            return {
              visitDate: new Date(Date.UTC(year, month - 1, day)),
              multipleDatesDetected
            };
          }
        }
      }
    }

    return {
      visitDate: uniqueTimeStamps.length > 0 ? new Date(uniqueTimeStamps[0]) : null,
      multipleDatesDetected
    };
  }

  /**
   * 6. Reason for Visit Extraction
   * Identifies chief complaint / reason line without extracting clinical notes or treatments.
   */
  private static extractReason(lines: string[]): string | null {
    // Explicit prefix match
    for (const line of lines) {
      const match = line.match(/(?:c\/o|co|complaint|chief\s*complaint|reason|problem|issue)\s*[:\-\.]\s*(.+)/i);
      if (match && match[1]) {
        const cleaned = this.cleanReason(match[1]);
        if (cleaned) return cleaned;
      }
    }

    // Common non-treatment complaint tokens
    const complaintTokens = [
      'tooth pain', 'toothache', 'dental pain', 'severe pain', 'pain in tooth',
      'swelling', 'caries', 'cavity', 'bleeding gums', 'sensitivity',
      'broken tooth', 'chipped tooth', 'cleaning', 'routine checkup', 'general checkup'
    ];

    for (const line of lines) {
      const lower = line.toLowerCase();
      // Guard against treatments
      if (/treatment|done|extraction completed|filling done|rct completed|prescribed|medicine/i.test(lower)) {
        continue;
      }
      for (const token of complaintTokens) {
        if (lower.includes(token)) {
          const cleaned = this.cleanReason(line);
          if (cleaned) return cleaned;
        }
      }
    }

    return null;
  }

  private static cleanReason(raw: string): string | null {
    const cleaned = raw
      .replace(/^(c\/o|co|complaint|chief complaint|reason)[:\-\.\s]*/i, '')
      .replace(/[;|~_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length < 2) return null;
    return cleaned.slice(0, 200);
  }
}
