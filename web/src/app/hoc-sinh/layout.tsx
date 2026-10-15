import Link from "next/link";
import type { Metadata } from "next";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="student-shell">
      <header className="site-header page-width student-header"><Brand /><Link className="student-header-link" href="/">Trang chủ</Link></header>
      {children}
      <footer className="student-footer page-width"><p>Trường Tiểu học Bến Tre</p><span>Gieo yêu thương · Nuôi hạnh phúc</span></footer>
    </div>
  );
}
