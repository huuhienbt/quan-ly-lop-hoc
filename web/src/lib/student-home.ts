export const classHomeLinks = {
  "tin-lop": "/",
  "hoc-tap": "/?muc=hoc-tap",
  "do-vui": "/?muc=do-vui",
  "tro-chuyen": "/?muc=tro-chuyen",
} as const;

export type ClassHomeSection = keyof typeof classHomeLinks;
export type StudentHomeSection = Exclude<ClassHomeSection, "do-vui">;
export type StudentHomeDestination = (typeof classHomeLinks)[StudentHomeSection];

export const studentAccountLink = "/hoc-sinh/thong-tin";

export function studentHomeSection(value: unknown): StudentHomeSection {
  return value === "hoc-tap" || value === "tro-chuyen" ? value : "tin-lop";
}

export function studentHomeLoginLink(section: StudentHomeSection) {
  return section === "tin-lop" ? "/dang-nhap" : `/dang-nhap?tiep=${section}` as const;
}

export function studentPasswordLink(section: StudentHomeSection) {
  return section === "tin-lop" ? "/hoc-sinh/doi-mat-khau" : `/hoc-sinh/doi-mat-khau?tiep=${section}` as const;
}
