import Link from "next/link";
import { getSiteTheme } from "@/lib/site-theme";

export async function Brand({ compact = false }: { compact?: boolean }) {
  const theme = await getSiteTheme();
  const storybook = theme === "discovery" || theme === "harmony";
  return (
    <Link href="/" className="brand" aria-label="Lớp học hạnh phúc — Trang chủ">
      <span className="brand-symbol" aria-hidden="true">
        {storybook ? <svg viewBox="0 0 64 64" fill="none">
          <path d="M7 20c9-3 18-2 25 3 7-5 16-6 25-3v31c-9-3-18-2-25 3-7-5-16-6-25-3V20Z" fill="#FFFDF5" stroke="#18558B" strokeWidth="2.7" strokeLinejoin="round" />
          <path d="M12 24c6-1 11 0 16 3v20c-5-2-10-3-16-2V24Z" fill="#A6E2DE" /><path d="M52 24c-6-1-11 0-16 3v20c5-2 10-3 16-2V24Z" fill="#FFDE83" />
          <path d="M32 23v31M16 31l8 2M16 37l8 2M40 33l8-2M40 39l8-2" stroke="#18558B" strokeWidth="2" strokeLinecap="round" />
          <path d="m32 4 2.4 6.6L41 13l-6.6 2.4L32 22l-2.4-6.6L23 13l6.6-2.4L32 4Z" fill="#F3BC3F" /><path d="m13 7 1.4 3.6L18 12l-3.6 1.4L13 17l-1.4-3.6L8 12l3.6-1.4L13 7Zm38 0 1.4 3.6L56 12l-3.6 1.4L51 17l-1.4-3.6L46 12l3.6-1.4L51 7Z" fill="#66BCAC" />
        </svg> : <svg viewBox="0 0 64 64" fill="none">
          <path d="m32 7 7.5 15.2 16.8 2.4-12.2 11.9L47 53.3 32 45.4l-15 7.9 2.9-16.8L7.7 24.6l16.8-2.4L32 7Z" fill="currentColor" stroke="#F4AF19" strokeWidth="2.6" strokeLinejoin="round" />
          <ellipse cx="24.5" cy="31" rx="2.4" ry="3.2" fill="#165A9A" /><ellipse cx="39.5" cy="31" rx="2.4" ry="3.2" fill="#165A9A" />
          <path d="M27 37c2.8 3.2 7.2 3.2 10 0" stroke="#165A9A" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="20" cy="37" r="3.3" fill="#F29C9A" /><circle cx="44" cy="37" r="3.3" fill="#F29C9A" />
          <path d="m15 10 1.2 3.4 3.4 1.2-3.4 1.2L15 19.2l-1.2-3.4-3.4-1.2 3.4-1.2L15 10Z" fill="#fff" />
        </svg>}
      </span>
      <span className="brand-copy">
        <strong>Lớp học hạnh phúc</strong>
        {!compact && <span>TRƯỜNG TIỂU HỌC BẾN TRE</span>}
      </span>
    </Link>
  );
}
