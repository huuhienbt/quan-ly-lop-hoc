import Link from "next/link";
import { SunIcon } from "./icons";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Lớp học hạnh phúc — Trang chủ">
      <span className="brand-symbol"><SunIcon /></span>
      <span className="brand-copy">
        <strong>Lớp học hạnh phúc</strong>
        {!compact && <span>TRƯỜNG TIỂU HỌC BẾN TRE</span>}
      </span>
    </Link>
  );
}
