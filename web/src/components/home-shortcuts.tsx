import Link from "next/link";
import { classHomeLinks, studentHomeLoginLink, type ClassHomeSection } from "@/lib/student-home";
import "./home-shortcuts.css";

export function HomeShortcuts({ activeSection, studentSignedIn }: { activeSection: ClassHomeSection; studentSignedIn: boolean }) {
  const items = [
    { icon: "📰", title: "Tin lớp", section: "tin-lop", color: "blue" },
    { icon: "📘", title: "Học tập", section: "hoc-tap", color: "mint" },
    { icon: "🧩", title: "Đố vui", section: "do-vui", color: "peach" },
    { icon: "💬", title: "Trò chuyện", section: "tro-chuyen", color: "pink" },
  ] as const;

  return <nav className="home-shortcuts" id="loi-tat" aria-label="Menu lớp học">
    {items.map(({ icon, title, section, color }) => {
      const needsLogin = !studentSignedIn && (section === "hoc-tap" || section === "tro-chuyen");
      const href = needsLogin ? studentHomeLoginLink(section) : classHomeLinks[section];
      return <Link key={section} className={`home-shortcut home-shortcut-${color}`} href={href} prefetch={false}
        scroll={needsLogin} aria-current={activeSection === section ? "location" : undefined}>
        <span className="home-shortcut-icon" aria-hidden="true">{icon}</span><span>{title}</span>
      </Link>;
    })}
  </nav>;
}
