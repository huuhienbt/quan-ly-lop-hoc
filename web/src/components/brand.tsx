import Link from "next/link";
import "./brand.css";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand class-home-brand" aria-label="Lớp học hạnh phúc — Trang chủ">
      <span className="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none">
          <path d="M7 20c9-3 18-2 25 3 7-5 16-6 25-3v31c-9-3-18-2-25 3-7-5-16-6-25-3V20Z" fill="#FFFDF5" stroke="#18558B" strokeWidth="2.7" strokeLinejoin="round" />
          <path d="M12 24c6-1 11 0 16 3v20c-5-2-10-3-16-2V24Z" fill="#A6E2DE" /><path d="M52 24c-6-1-11 0-16 3v20c5-2 10-3 16-2V24Z" fill="#FFDE83" />
          <path d="M32 23v31M16 31l8 2M16 37l8 2M40 33l8-2M40 39l8-2" stroke="#18558B" strokeWidth="2" strokeLinecap="round" />
          <path d="m32 4 2.4 6.6L41 13l-6.6 2.4L32 22l-2.4-6.6L23 13l6.6-2.4L32 4Z" fill="#F3BC3F" /><path d="m13 7 1.4 3.6L18 12l-3.6 1.4L13 17l-1.4-3.6L8 12l3.6-1.4L13 7Zm38 0 1.4 3.6L56 12l-3.6 1.4L51 17l-1.4-3.6L46 12l3.6-1.4L51 7Z" fill="#66BCAC" />
        </svg>
      </span>
      <span className="brand-copy">
        <strong>Lớp học hạnh phúc</strong>
        {!compact && <span className="class-home-brand-detail">Bốn 12 · Trường Tiểu học Bến Tre</span>}
      </span>
    </Link>
  );
}
