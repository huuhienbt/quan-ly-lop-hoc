import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Lớp học hạnh phúc — Trang chủ">
      <span className="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none">
          <path d="m32 7 7.5 15.2 16.8 2.4-12.2 11.9L47 53.3 32 45.4l-15 7.9 2.9-16.8L7.7 24.6l16.8-2.4L32 7Z" fill="currentColor" stroke="#F4AF19" strokeWidth="2.6" strokeLinejoin="round" />
          <ellipse cx="24.5" cy="31" rx="2.4" ry="3.2" fill="#165A9A" /><ellipse cx="39.5" cy="31" rx="2.4" ry="3.2" fill="#165A9A" />
          <path d="M27 37c2.8 3.2 7.2 3.2 10 0" stroke="#165A9A" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="20" cy="37" r="3.3" fill="#F29C9A" /><circle cx="44" cy="37" r="3.3" fill="#F29C9A" />
          <path d="m15 10 1.2 3.4 3.4 1.2-3.4 1.2L15 19.2l-1.2-3.4-3.4-1.2 3.4-1.2L15 10Z" fill="#fff" />
        </svg>
      </span>
      <span className="brand-copy">
        <strong>Lớp học hạnh phúc</strong>
        {!compact && <span>TRƯỜNG TIỂU HỌC BẾN TRE</span>}
      </span>
    </Link>
  );
}
