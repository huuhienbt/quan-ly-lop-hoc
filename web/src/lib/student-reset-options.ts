export const STUDENT_BULK_RESET_LIMIT = 60;
export const STUDENT_BULK_RESET_HOURS = 24;
export const STUDENT_PASSWORD_MIN_LENGTH = 8;
export const STUDENT_PASSWORD_MAX_LENGTH = 128;
export const STUDENT_PASSWORD_LENGTH_MESSAGE = `Mật khẩu cần từ ${STUDENT_PASSWORD_MIN_LENGTH} đến ${STUDENT_PASSWORD_MAX_LENGTH} ký tự.`;
export const STUDENT_PASSWORD_HELP = `Dùng từ ${STUDENT_PASSWORD_MIN_LENGTH} đến ${STUDENT_PASSWORD_MAX_LENGTH} ký tự. Không cần chữ hoa, chữ số hay ký tự đặc biệt.`;

const commonPasswords = new Set([
  "11223344", "12121212", "12341234", "00000001", "10000000",
  "password", "password1", "password123", "qwerty123", "qwertyuiop",
  "abcdefgh", "abcdefghij", "iloveyou", "matkhau123", "12345678a",
]);
const nonPrintable = /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}\uFFFE\uFFFF]/u;
const dayFirst = /^(0?[1-9]|[12][0-9]|3[01])[-./ ]?(0?[1-9]|1[0-2])[-./ ]?(19|20)[0-9]{2}$/;
const yearFirst = /^(19|20)[0-9]{2}[-./ ]?(0?[1-9]|1[0-2])[-./ ]?(0?[1-9]|[12][0-9]|3[01])$/;

export function studentPasswordFormatError(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length < STUDENT_PASSWORD_MIN_LENGTH || value.length > STUDENT_PASSWORD_MAX_LENGTH) {
    return STUDENT_PASSWORD_LENGTH_MESSAGE;
  }
  if (!value.trim() || nonPrintable.test(value)) {
    return "Mật khẩu phải nằm trên một dòng và không được chỉ gồm dấu cách.";
  }
}

export function isPredictableStudentPassword(value: string): boolean {
  const password = value.trim().toLowerCase();
  return commonPasswords.has(password) || /^(.)\1+$/u.test(password) ||
    dayFirst.test(password) || yearFirst.test(password) ||
    (/^[0-9]{8,}$/.test(password) &&
      ("01234567890123456789".includes(password) || "98765432109876543210".includes(password)));
}

export function isStudentPhonePassword(value: string, phone: string): boolean {
  const compact = value.trim().replace(/[\s().-]/g, "").replace(/^(?:\+84|84)(?=[0-9]{9}$)/, "0");
  return /^[0-9]{8,10}$/.test(compact) && phone.includes(compact);
}
