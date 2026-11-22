import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/auth-buttons";
import { HomeFooter } from "@/components/home-footer";
import { TeacherWorkspaceNav } from "@/components/teacher-workspace-nav";
import { getWorkspaceClasses, getWorkspaceUser } from "@/lib/teacher-workspace";
import "@/components/home-shortcuts.css";
import "./teacher.css";
import "./workspace.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quản trị lớp học", robots: { index: false, follow: false } };

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const actor = await getWorkspaceUser();
  // The page checks authorization independently and handles the sign-in return tab.
  if (actor?.role !== "TEACHER" && actor?.role !== "SUPER_ADMIN") return children;
  const classes = await getWorkspaceClasses(actor.id);
  return <div className="staff-workspace">
    <header id="dau-trang-quan-tri" className="staff-header"><div className="page-width staff-header-inner">
      <Brand />
      <details className="staff-account">
        <summary><span>{actor.name}</span><span aria-hidden="true">▾</span></summary>
        <div className="staff-account-menu">
          <span className="staff-role">{actor.role === "SUPER_ADMIN" ? "Quản trị viên" : "Giáo viên"}</span>
          <Link href="/" prefetch={false}>Về trang chủ</Link><SignOutButton />
        </div>
      </details>
    </div></header>
    <TeacherWorkspaceNav admin={actor.role === "SUPER_ADMIN"} classes={classes.map(({id, name, school_name}) => ({id, name, school_name}))} />
    <main className="staff-content page-width" id="noi-dung" tabIndex={-1}>{children}</main>
    <HomeFooter topHref="#dau-trang-quan-tri" />
  </div>;
}
