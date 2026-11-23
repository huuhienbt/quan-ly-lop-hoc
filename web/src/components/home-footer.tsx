import { Brand } from "@/components/brand";
import "./home-footer.css";

export function HomeFooter({ container = "page-width", topHref = "#noi-dung" }: { container?: "page-width" | "discovery-container" | "harmony-container"; topHref?: string }) {
  return (
    <footer className="class-home-footer">
      <div className={`${container} class-home-footer-inner`}>
        <Brand />
        <p className="class-home-footer-identity">
          <strong>Lớp Bốn 12 · Trường Tiểu học Bến Tre</strong>
          <span>Phường An Hội · Tỉnh Vĩnh Long</span>
        </p>
        <a className="class-home-footer-top" href={topHref}>Lên đầu trang <span aria-hidden="true">↑</span></a>
      </div>
    </footer>
  );
}
