"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

type SectionKey = "news" | "discovery" | "chat";
type Section = { key: SectionKey; label: string; hint: string; symbol: string };
const sections: Section[] = [
  { key: "news", label: "Tin lớp", hint: "Thông báo từ thầy cô", symbol: "▤" },
  { key: "discovery", label: "Học tập", hint: "Đọc và học điều hay", symbol: "✦" },
  { key: "chat", label: "Trò chuyện", hint: "Với thầy cô và các bạn", symbol: "✉" },
];
const firstStudentAliases: Record<string, string> = { "tin-lop": "news", "kham-pha": "discovery", "tro-chuyen": "chat" };

function resolveHash(hash: string, prefix: string, firstStudent: boolean): { section: SectionKey; target: string } | null {
  let target: string;
  try { target = decodeURIComponent(hash.replace(/^#/, "")); } catch { return null; }
  if (firstStudent && Object.hasOwn(firstStudentAliases, target)) target = `${prefix}-${firstStudentAliases[target]}`;
  if (!target.startsWith(`${prefix}-`)) return null;
  const section = target.slice(prefix.length + 1);
  return sections.some((item) => item.key === section) ? { section: section as SectionKey, target } : null;
}

/** The page supplies server-rendered sections; switching views keeps forms and drafts mounted. */
export function StudentSectionTabs({ prefix, studentName, firstStudent = false, news, discovery, chat }: {
  prefix: string;
  studentName: string;
  firstStudent?: boolean;
  news: ReactNode;
  discovery: ReactNode;
  chat: ReactNode;
}) {
  const [active, setActive] = useState<SectionKey>("news");
  const root = useRef<HTMLDivElement>(null);
  const contents = { news, discovery, chat };

  useEffect(() => {
    let frame = 0;
    let scrollFrame = 0;
    const readHash = () => {
      const matched = resolveHash(window.location.hash, prefix, firstStudent);
      if (!matched && window.location.hash) return;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      frame = requestAnimationFrame(() => {
        const next = matched?.section ?? "news";
        const focusedPanel = document.activeElement?.closest(".student-section-view");
        const movesFocus = !!focusedPanel && !!root.current?.contains(focusedPanel) && focusedPanel.id !== `${prefix}-view-${next}`;
        setActive(next);
        if (movesFocus) document.getElementById(`${prefix}-tab-${next}`)?.focus({ preventScroll: true });
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

  function followSectionLink(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest("a[href^='#']") : null;
    const href = link?.getAttribute("href");
    if (!href) return;
    const matched = resolveHash(href, prefix, firstStudent);
    if (!matched) return;
    event.preventDefault();
    setActive(matched.section);
    const menuLink = document.getElementById(`${prefix}-tab-${matched.section}`);
    if (matched.section !== active) menuLink?.focus({ preventScroll: true });
    if (window.location.hash !== href) window.history.pushState(window.history.state, "", href);
    if (link !== menuLink) requestAnimationFrame(() => document.getElementById(matched.target)?.scrollIntoView({ block: "start" }));
  }

  function sectionLink(section: Section) {
    return <a key={section.key} href={`#${prefix}-${section.key}`} id={`${prefix}-tab-${section.key}`}
      aria-current={active === section.key ? "location" : undefined}>
      <span className="student-section-tab-icon" aria-hidden="true">{section.symbol}</span>
      <span>{section.label}<small>{section.hint}</small></span>
    </a>;
  }

  return <div className="student-section-workspace" ref={root} onClickCapture={followSectionLink}>
    <nav className="student-section-tabs" aria-label={`Các mục của ${studentName}`}>
      {sections.slice(0, 2).map(sectionLink)}
      <Link className="student-section-quiz" href="/tro-choi/ca-dao-tuc-ngu">
        <span className="student-section-tab-icon" aria-hidden="true">★</span>
        <span>Đố vui<small>Ca dao, tục ngữ</small></span>
      </Link>
      {sectionLink(sections[2])}
    </nav>
    {sections.map((section) => <div className="student-section-view" key={section.key} id={`${prefix}-view-${section.key}`} hidden={active !== section.key}>{contents[section.key]}</div>)}
  </div>;
}
