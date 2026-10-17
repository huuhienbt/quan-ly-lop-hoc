"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

type SectionKey = "today" | "week" | "news" | "discovery" | "chat";
type Section = { key: SectionKey; label: string; hint: string; symbol: string };
const sections: Section[] = [
  { key: "today", label: "Hôm nay", hint: "Việc cần làm và chuẩn bị", symbol: "☀" },
  { key: "week", label: "Lịch tuần", hint: "Hoạt động của lớp", symbol: "▦" },
  { key: "news", label: "Tin lớp", hint: "Thông báo từ thầy cô", symbol: "▤" },
  { key: "discovery", label: "Khám phá", hint: "Đọc và học điều hay", symbol: "✦" },
  { key: "chat", label: "Trò chuyện", hint: "Với thầy cô và các bạn", symbol: "✉" },
];
const firstStudentAliases: Record<string, string> = { "viec-hom-nay": "today", "chuan-bi": "prepare", "lich-tuan": "week", "tin-lop": "news", "kham-pha": "discovery", "tro-chuyen": "chat" };

function resolveHash(hash: string, prefix: string, firstStudent: boolean): { section: SectionKey; target: string } | null {
  let target: string;
  try { target = decodeURIComponent(hash.replace(/^#/, "")); } catch { return null; }
  if (firstStudent && Object.hasOwn(firstStudentAliases, target)) target = `${prefix}-${firstStudentAliases[target]}`;
  if (!target.startsWith(`${prefix}-`)) return null;
  const suffix = target.slice(prefix.length + 1);
  const section = suffix === "prepare" ? "today" : suffix;
  return sections.some((item) => item.key === section) ? { section: section as SectionKey, target } : null;
}

/** The page supplies server-rendered sections; switching views keeps forms and drafts mounted. */
export function StudentSectionTabs({ prefix, studentName, firstStudent = false, today, week, news, discovery, chat }: {
  prefix: string;
  studentName: string;
  firstStudent?: boolean;
  today: ReactNode;
  week: ReactNode;
  news: ReactNode;
  discovery: ReactNode;
  chat: ReactNode;
}) {
  const [active, setActive] = useState<SectionKey>("today");
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const contents = { today, week, news, discovery, chat };

  useEffect(() => {
    let frame = 0;
    let scrollFrame = 0;
    const readHash = () => {
      const matched = resolveHash(window.location.hash, prefix, firstStudent);
      if (!matched && window.location.hash) return;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      frame = requestAnimationFrame(() => {
        const next = matched?.section ?? "today";
        const focusedPanel = document.activeElement?.closest(".student-section-view");
        const movesFocus = !!focusedPanel && !!root.current?.contains(focusedPanel) && focusedPanel.id !== `${prefix}-view-${next}`;
        setActive(next);
        if (movesFocus) buttons.current[sections.findIndex((item) => item.key === next)]?.focus({ preventScroll: true });
        if (matched) scrollFrame = requestAnimationFrame(() => document.getElementById(matched.target)?.scrollIntoView({ block: "start" }));
      });
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    window.addEventListener("popstate", readHash);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener("hashchange", readHash);
      window.removeEventListener("popstate", readHash);
    };
  }, [prefix, firstStudent]);

  function select(section: SectionKey) {
    setActive(section);
    buttons.current[sections.findIndex((item) => item.key === section)]?.focus({ preventScroll: true });
    const hash = `#${prefix}-${section}`;
    if (window.location.hash !== hash) window.history.pushState(window.history.state, "", hash);
  }

  function navigateKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % sections.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + sections.length) % sections.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = sections.length - 1;
    else return;
    event.preventDefault();
    select(sections[next].key);
  }

  function followSectionLink(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest("a[href^='#']") : null;
    const href = link?.getAttribute("href");
    if (!href) return;
    const matched = resolveHash(href, prefix, firstStudent);
    if (!matched) return;
    event.preventDefault();
    setActive(matched.section);
    if (matched.section !== active) buttons.current[sections.findIndex((item) => item.key === matched.section)]?.focus({ preventScroll: true });
    if (window.location.hash !== href) window.history.pushState(window.history.state, "", href);
    requestAnimationFrame(() => document.getElementById(matched.target)?.scrollIntoView({ block: "start" }));
  }

  return <div className="student-section-workspace" ref={root} onClickCapture={followSectionLink}>
    <div className="student-section-toolbar"><p>Em muốn xem mục nào?</p><Link className="student-game-shortcut" href="/tro-choi/ca-dao-tuc-ngu"><span aria-hidden="true">★</span> Chơi đố vui</Link></div>
    <div className="student-section-tabs" role="tablist" aria-label={`Các mục của ${studentName}`}>
      {sections.map((section, index) => <button type="button" key={section.key} ref={(node) => { buttons.current[index] = node; }} id={`${prefix}-tab-${section.key}`} role="tab" aria-selected={active === section.key} aria-controls={`${prefix}-view-${section.key}`} tabIndex={active === section.key ? 0 : -1} onClick={() => select(section.key)} onKeyDown={(event) => navigateKeys(event, index)}><span className="student-section-tab-icon" aria-hidden="true">{section.symbol}</span><span>{section.label}<small>{section.hint}</small></span></button>)}
    </div>
    {sections.map((section) => <div className="student-section-view" key={section.key} id={`${prefix}-view-${section.key}`} role="tabpanel" aria-labelledby={`${prefix}-tab-${section.key}`} tabIndex={0} hidden={active !== section.key}>{contents[section.key]}</div>)}
  </div>;
}
