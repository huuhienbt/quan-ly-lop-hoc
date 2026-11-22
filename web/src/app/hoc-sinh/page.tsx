"use client";

import Link from "next/link";
import { useEffect } from "react";
import { classHomeLinks, type ClassHomeSection } from "@/lib/student-home";

function oldSection(hash: string): ClassHomeSection {
  if (hash === "#kham-pha" || /^#lop-[\w-]+-discovery$/.test(hash)) return "hoc-tap";
  if (hash === "#tro-chuyen" || /^#lop-[\w-]+-chat$/.test(hash)) return "tro-chuyen";
  if (hash === "#tro-choi") return "do-vui";
  return "tin-lop";
}

export default function LegacyStudentHomePage() {
  useEffect(() => {
    // A URL fragment is only available in the browser. Keep older app shortcuts and bookmarks working.
    window.location.replace(classHomeLinks[oldSection(window.location.hash)]);
  }, []);
  return <main id="noi-dung" className="student-password-main page-width">
    <Link className="button button-outline" href="/">Về menu lớp học</Link>
  </main>;
}
