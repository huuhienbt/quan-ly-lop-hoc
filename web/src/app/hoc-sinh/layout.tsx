import Link from "next/link";
import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { HomeFooter } from "@/components/home-footer";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="student-shell">
      <div className="student-header-bar" id="dau-trang-hoc-sinh"><header className="site-header page-width student-header"><Brand /><Link className="student-header-link" href="/">Trang chủ</Link></header></div>
      {children}
      <HomeFooter topHref="#dau-trang-hoc-sinh" />
    </div>
  );
}
