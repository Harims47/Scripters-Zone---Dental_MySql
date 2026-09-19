/**
 * Date Range Helper for DentalCore Reporting
 * Standardizes date boundary calculations and date parsing across all reporting services.
 */

export interface ParsedDateRange {
  startDate?: Date;
  endDate?: Date;
  hasFilter: boolean;
}

/**
 * Parses startDate and endDate strings into proper Date boundaries.
 * If only YYYY-MM-DD is given, startDate is start of day (00:00:00.000)
 * and endDate is end of day (23:59:59.999).
 */
export function parseDateRange(startDateStr?: string, endDateStr?: string): ParsedDateRange {
  if (!startDateStr && !endDateStr) {
    return { hasFilter: false };
  }

  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (startDateStr) {
    const s = new Date(startDateStr);
    if (!isNaN(s.getTime())) {
      // If it's pure YYYY-MM-DD, normalize to start of day
      if (startDateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
        s.setHours(0, 0, 0, 0);
      }
      startDate = s;
    }
  }

  if (endDateStr) {
    const e = new Date(endDateStr);
    if (!isNaN(e.getTime())) {
      // If it's pure YYYY-MM-DD, normalize to end of day
      if (endDateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
        e.setHours(23, 59, 59, 999);
      }
      endDate = e;
    }
  }

  return {
    startDate,
    endDate,
    hasFilter: Boolean(startDate || endDate)
  };
}

/**
 * Builds a Prisma createdAt/timestamp filter object.
 */
export function buildPrismaDateFilter(startDate?: Date, endDate?: Date) {
  if (!startDate && !endDate) return undefined;
  const filter: any = {};
  if (startDate) filter.gte = startDate;
  if (endDate) filter.lte = endDate;
  return filter;
}

/**
 * Generates an array of formatted date strings (YYYY-MM-DD) between start and end.
 */
export function getDateArrayBetween(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const curr = new Date(startDate);
  curr.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (curr <= end) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}
