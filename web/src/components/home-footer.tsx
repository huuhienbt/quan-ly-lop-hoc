import Link from "next/link";
import { Brand } from "@/components/brand";
import "./home-footer.css";

export function HomeFooter() {
  return (
    <footer className="class-home-footer">
      <div className="page-width class-home-footer-inner">
        <div className="class-home-footer-identity">
          <Brand compact />
          <p>Bốn 12 · Trường Tiểu học Bến Tre</p>
        </div>
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
