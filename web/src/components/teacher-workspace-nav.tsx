"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { schoolSetting, selectedTeacherClass, teacherHref, teacherMenu, teacherTab } from "@/lib/teacher-navigation";

type ClassOption = { id: string; name: string; school_name: string };

export function TeacherWorkspaceNav({ classes, admin }: { classes: ClassOption[]; admin: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const tab = teacherTab(params.get("tab"), admin);
  const selected = selectedTeacherClass(classes, params.get("class"));
  const items = admin ? teacherMenu : teacherMenu.filter(item => item.tab !== "cai-dat");

  return <>
    <section className="staff-banner" aria-labelledby="staff-title">
      <div className="staff-banner-copy page-width">
        <h1 id="staff-title">Quản trị lớp học</h1>
        {classes.length > 1 ?
          <label className="staff-class-choice">Lớp đang quản lý
            <select value={selected?.id} onChange={event => router.push(
              teacherHref(tab, event.target.value, { setting: schoolSetting(params.get("muc")) }), { scroll: false }
            )}>
              {classes.map(item => <option key={item.id} value={item.id}>{item.name} · {item.school_name}</option>)}
            </select>
          </label>
          : <p className="staff-class-name">{selected ? selected.name + " · " + selected.school_name : "Trường Tiểu học Bến Tre"}</p>}
      </div>
    </section>
    <nav className="home-shortcuts staff-menu" aria-label="Menu quản trị" data-count={items.length}>
      {items.map(({ tab: id, label, icon, color }) =>
        <Link key={id} href={teacherHref(id, selected?.id)} prefetch={false} scroll={false}
          className={`home-shortcut home-shortcut-${color}`} aria-current={tab === id ? "page" : undefined}>
          <span className="home-shortcut-icon" aria-hidden="true">{icon}</span><span>{label}</span>
        </Link>)}
    </nav>
  </>;
}
