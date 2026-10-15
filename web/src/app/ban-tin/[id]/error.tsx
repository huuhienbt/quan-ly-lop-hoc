"use client";
import Link from "next/link";
export default function PostError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="noi-dung" className="panel error-card"><h1>Chưa thể mở bản tin</h1><p>Kết nối tạm thời chưa sẵn sàng. Bạn có thể thử lại sau ít phút.</p><button type="button" className="button button-primary" onClick={reset}>Thử lại</button><Link className="button button-outline" href="/#bang-tin">Về bảng tin</Link></main>;
}
