import type { Metadata } from "next";
import "./teacher.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
