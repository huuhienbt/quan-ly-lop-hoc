"use client";

import Link from "next/link";
import { ClockIcon } from "@/components/icons";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="noi-dung" className="panel error-card">
      <span className="value-icon butter"><ClockIcon /></span>
      <h1>Chưa thể mở trang quản trị</h1>
      <p>Kết nối tạm thời chưa sẵn sàng. Bạn có thể thử lại sau ít phút hoặc quay về trang chủ.</p>
      <button className="button button-primary" onClick={reset} type="button">Thử lại</button>
      <Link className="button button-outline" href="/">Về trang chủ</Link>
    </main>
  );
}
