import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import "./home-shortcuts.css";

const shortcuts = [
  { icon: "☀️", title: "Việc hôm nay", note: "Xem và đánh dấu việc đã làm", href: "/hoc-sinh#viec-hom-nay", student: true, color: "yellow" },
  { icon: "🎒", title: "Chuẩn bị buổi tới", note: "Sách vở và đồ dùng cần mang", href: "/hoc-sinh#chuan-bi", student: true, color: "mint" },
  { icon: "💬", title: "Trò chuyện", note: "Nhắn với thầy cô và các bạn", href: "/hoc-sinh#tro-chuyen", student: true, color: "pink" },
  { icon: "📚", title: "Tin lớp", note: "Thông báo và hoạt động mới", href: "/#bang-tin", color: "blue" },
  { icon: "🗓️", title: "Lịch tuần", note: "Theo dõi những ngày sắp tới", href: "/#lich-tuan", color: "lavender" },
  { icon: "🧩", title: "Trò chơi học tập", note: "Đố vui ca dao, tục ngữ", href: "/tro-choi/ca-dao-tuc-ngu", color: "peach" },
];

export function HomeShortcuts({ studentSignedIn }: { studentSignedIn: boolean }) {
  return <section className="home-shortcuts" id="loi-tat" aria-labelledby="home-shortcuts-title">
    <div className="home-shortcuts-heading"><h2 id="home-shortcuts-title">Em muốn làm gì?</h2><p>Chọn một mục để bắt đầu.</p></div>
    <nav className="home-shortcuts-grid" aria-label="Lối vào nhanh">
      {shortcuts.map((shortcut) => <Link key={shortcut.title} className={`home-shortcut home-shortcut-${shortcut.color}`} href={shortcut.student && !studentSignedIn ? "/hoc-sinh/dang-nhap" : shortcut.href}>
        <span className="home-shortcut-icon" aria-hidden="true">{shortcut.icon}</span><span className="home-shortcut-copy"><strong>{shortcut.title}</strong><small>{shortcut.note}</small></span><ArrowIcon />
      </Link>)}
    </nav>
  </section>;
}
