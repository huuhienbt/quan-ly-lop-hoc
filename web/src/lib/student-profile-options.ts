export const MAX_AVATAR_SOURCE_BYTES = 2 * 1024 * 1024;
export const MAX_AVATAR_UPLOAD_BYTES = 200 * 1024;
export const MAX_AVATAR_BYTES = 64 * 1024;
export const AVATAR_SIZE = 256;
export const AVATAR_KEY_PREFIX = "inline-webp-v1:";
export const AVATAR_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const studentGenders = ["MALE", "FEMALE", "OTHER", "UNSPECIFIED"] as const;
export type StudentGender = (typeof studentGenders)[number];
export const genderLabels: Record<StudentGender, string> = {
  MALE: "Nam", FEMALE: "Nữ", OTHER: "Khác", UNSPECIFIED: "Chưa cập nhật",
};

export interface StudentEditableProfile {
  enrollmentId: string;
  fullName: string;
  dateOfBirth: string | null;
  maxBirthDate: string;
  gender: StudentGender;
  revision: string;
  avatarUrl: string | null;
}

export function studentAvatarUrl(enrollmentId: string, revision: string): string {
  return `/api/student-avatars/${encodeURIComponent(enrollmentId)}?v=${encodeURIComponent(revision)}`;
}
