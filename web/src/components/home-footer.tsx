import Link from "next/link";
import { Brand } from "@/components/brand";
import "./home-footer.css";

export function HomeFooter({ container = "page-width" }: { container?: "page-width" | "discovery-container" | "harmony-container" }) {
  return (
    <footer className="class-home-footer">
      <div className={`${container} class-home-footer-inner`}>
        <Brand />
        <nav aria-label="Liên kết cuối trang">
          <a href="#bang-tin">Tin lớp</a>
          <Link href="/tro-choi/ca-dao-tuc-ngu">Đố vui</Link>
          <Link href="/dang-nhap">Đăng nhập</Link>
        </nav>
        <a className="class-home-footer-top" href="#noi-dung">Lên đầu trang <span aria-hidden="true">↑</span></a>
      </div>
    </footer>
  );
}
