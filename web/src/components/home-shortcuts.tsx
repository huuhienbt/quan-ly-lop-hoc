import Link from "next/link";
import "./home-shortcuts.css";

export function HomeShortcuts({ studentSignedIn }: { studentSignedIn: boolean }) {
  const items = [
    { icon: "📰", title: "Tin lớp", href: "/#bang-tin", color: "blue" },
    { icon: "📘", title: "Học tập", href: studentSignedIn ? "/hoc-sinh#kham-pha" : "/dang-nhap?tiep=hoc-tap", color: "mint" },
    { icon: "🧩", title: "Đố vui", href: "/tro-choi/ca-dao-tuc-ngu", color: "peach" },
    { icon: "💬", title: "Trò chuyện", href: studentSignedIn ? "/hoc-sinh#tro-chuyen" : "/dang-nhap?tiep=tro-chuyen", color: "pink" },
  ];

  return <nav className="home-shortcuts" id="loi-tat" aria-label="Menu lớp học">
    {items.map(({ icon, title, href, color }) => (
      <Link key={title} className={`home-shortcut home-shortcut-${color}`} href={href}>
        <span className="home-shortcut-icon" aria-hidden="true">{icon}</span><span>{title}</span>
      </Link>
    ))}
  </nav>;
}
