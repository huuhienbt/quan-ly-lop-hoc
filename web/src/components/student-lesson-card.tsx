"use client";

import { useState, type ReactNode } from "react";

export function StudentLessonCard({ title, kind, publishedAt, dateLabel, children }: {
  title: string;
  kind: string;
  publishedAt: string | null;
  dateLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return <details className="student-article-card" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>
      <span className="student-content-kicker">{kind}</span>
      <h4>{title}</h4>
      {publishedAt && <time dateTime={publishedAt}>{dateLabel}</time>}
      <span className="student-news-more">{open ? "Thu gọn bài học" : "Mở bài học"}</span>
    </summary>
    {open && children}
  </details>;
}
