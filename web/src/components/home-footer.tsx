import { Brand } from "@/components/brand";
import "./home-footer.css";

export function HomeFooter({ container = "page-width", topHref = "#noi-dung" }: { container?: "page-width" | "discovery-container" | "harmony-container"; topHref?: string }) {
  return (
    <footer className="class-home-footer">
      <div className={`${container} class-home-footer-inner`}>
        <Brand />
        <a className="class-home-footer-top" href={topHref}>Lên đầu trang <span aria-hidden="true">↑</span></a>
      </div>
    </footer>
  );
}
