export const STUDENT_BULK_RESET_LIMIT = 60;
export const STUDENT_BULK_RESET_HOURS = 24;

const commonPatterns = new Set(["11223344", "12121212", "12341234", "00000001", "10000000"]);

export function isPredictableStudentPassword(value: string): boolean {
  return /^\d{8,}$/.test(value) && (commonPatterns.has(value) || /^(\d)\1+$/.test(value) ||
    "01234567890123456789".includes(value) || "98765432109876543210".includes(value));
}
