import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://e-class-vinhlong.vercel.app"),
  title: {
    default: "Lớp học hạnh phúc · Tiểu học Bến Tre",
    template: "%s · Lớp học hạnh phúc",
  },
  description: "Cùng thầy cô xây dựng một lớp học an toàn, ấm áp và hạnh phúc tại Trường Tiểu học Bến Tre.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#noi-dung">Bỏ qua đến nội dung chính</a>
        {children}
      </body>
    </html>
  );
}
