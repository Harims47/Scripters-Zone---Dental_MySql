import { prisma } from '../../db';
import { DuplicateStatus, DuplicateResolution } from '@prisma/client';

export interface DuplicateCheckResult {
  duplicateStatus: DuplicateStatus;
  suggestedResolution: DuplicateResolution;
  matchedPatientId: string | null;
  matchedPatientSummary?: {
    id: string;
    name: string;
    phone: string | null;
    age: number | null;
    gender: string | null;
  } | null;
}

export class DuplicateMatchingService {
  /**
   * Evaluates candidate patient details against existing database records.
   * Never silently merges patients.
   */
  static async evaluateCandidate(
    name: string | null,
    phone: string | null,
    age?: number | null,
    gender?: string | null
  ): Promise<DuplicateCheckResult> {
    const cleanPhone = phone ? phone.trim().replace(/\D/g, '').slice(-10) : null;
    const cleanName = name ? name.trim().toLowerCase().replace(/\s+/g, ' ') : null;

    // 1. Check Phone Match if candidate phone is present
    if (cleanPhone && cleanPhone.length === 10) {
      const patientByPhone = await prisma.patient.findFirst({
        where: { phone: { contains: cleanPhone } }
      });

      if (patientByPhone) {
        const existingCleanName = patientByPhone.name.trim().toLowerCase().replace(/\s+/g, ' ');
        const isNameSimilar = cleanName ? this.isNameFuzzyMatch(cleanName, existingCleanName) : false;

        if (isNameSimilar) {
          return {
            duplicateStatus: 'EXACT_MATCH',
            suggestedResolution: 'USE_EXISTING',
            matchedPatientId: patientByPhone.id,
            matchedPatientSummary: {
              id: patientByPhone.id,
              name: patientByPhone.name,
              phone: patientByPhone.phone,
              age: patientByPhone.age,
              gender: patientByPhone.gender
            }
          };
        } else {
          // Phone belongs to someone else (e.g. shared family phone)
          return {
            duplicateStatus: 'PHONE_CONFLICT',
            suggestedResolution: 'CREATE_NEW',
            matchedPatientId: patientByPhone.id,
            matchedPatientSummary: {
              id: patientByPhone.id,
              name: patientByPhone.name,
              phone: patientByPhone.phone,
              age: patientByPhone.age,
              gender: patientByPhone.gender
            }
          };
        }
      }
    }

    // 2. Check Name Match if phone is null or did not match
    if (cleanName && cleanName.length >= 3) {
      const patientsByName = await prisma.patient.findMany({
        where: {
          name: { contains: cleanName }
        },
        take: 5
      });

      if (patientsByName.length > 0) {
        // Find closest match
        const best = patientsByName[0];
        return {
          duplicateStatus: 'POSSIBLE_DUPLICATE',
          suggestedResolution: 'USE_EXISTING',
          matchedPatientId: best.id,
          matchedPatientSummary: {
            id: best.id,
            name: best.name,
            phone: best.phone,
            age: best.age,
            gender: best.gender
          }
        };
      }
    }

    // 3. Unique Patient
    return {
      duplicateStatus: 'UNIQUE',
      suggestedResolution: 'CREATE_NEW',
      matchedPatientId: null,
      matchedPatientSummary: null
    };
  }

  private static isNameFuzzyMatch(nameA: string, nameB: string): boolean {
    if (nameA === nameB) return true;
    if (nameA.includes(nameB) || nameB.includes(nameA)) return true;

    // Word token overlap
    const tokensA = new Set(nameA.split(' ').filter(t => t.length > 1));
    const tokensB = new Set(nameB.split(' ').filter(t => t.length > 1));
    let common = 0;
    tokensA.forEach(t => {
      if (tokensB.has(t)) common++;
    });

    return common > 0 && common >= Math.min(tokensA.size, tokensB.size);
  }
}
