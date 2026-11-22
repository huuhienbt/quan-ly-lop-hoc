export type TeacherTab = "bai-viet" | "hoc-tap" | "tro-chuyen" | "cai-dat";
export type TeacherPostTab = Extract<TeacherTab, "bai-viet" | "hoc-tap">;
export type SchoolSetting = "lop-hoc" | "giao-dien" | "nam-hoc" | "giao-vien";

export const teacherMenu = [
  { tab: "bai-viet", label: "Tin lớp", icon: "📰", color: "blue" },
  { tab: "hoc-tap", label: "Học tập", icon: "📘", color: "mint" },
  { tab: "tro-chuyen", label: "Trò chuyện", icon: "💬", color: "pink" },
  { tab: "cai-dat", label: "Cài đặt", icon: "⚙️", color: "peach" },
] as const;

export const schoolSettings: { id: SchoolSetting; label: string }[] = [
  { id: "lop-hoc", label: "Lớp hiện có" },
  { id: "giao-dien", label: "Giao diện website" },
  { id: "nam-hoc", label: "Năm học và lớp học" },
  { id: "giao-vien", label: "Giáo viên và phân công" },
];

export function teacherTab(value: unknown, admin: boolean): TeacherTab {
  if (value === "cai-dat" && admin) return value;
  return value === "hoc-tap" || value === "tro-chuyen" ? value : "bai-viet";
}

export function schoolSetting(value: unknown): SchoolSetting {
  return schoolSettings.find(item => item.id === value)?.id ?? "lop-hoc";
}

export function teacherHref(tab: TeacherTab, classId?: string, options: { setting?: SchoolSetting; create?: boolean; edit?: string } = {}) {
  const params = new URLSearchParams();
  if (tab !== "bai-viet") params.set("tab", tab);
  if (classId) params.set("class", classId);
  if (tab === "cai-dat" && options.setting && options.setting !== "lop-hoc") params.set("muc", options.setting);
  if (tab === "bai-viet" || tab === "hoc-tap") {
    if (options.create) params.set("soan", "1");
    else if (options.edit) params.set("sua", options.edit);
  }
  const query = params.toString();
  return query ? `/teacher?${query}` : "/teacher";
}

export function selectedTeacherClass<T extends { id: string }>(classes: T[], requested: unknown): T | undefined {
  return classes.find(item => item.id === requested) ?? classes[0];
}
