"use client";

import Link from "next/link";
import { ClockIcon } from "@/components/icons";

export default function StudentError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="student-password-main page-width" id="noi-dung"><div className="student-password-card student-error-card"><span className="student-lock-icon"><ClockIcon /></span><h1>Chưa thể mở góc học sinh</h1><p className="student-card-description">Kết nối tạm thời chưa sẵn sàng. Em hãy thử lại sau một chút nhé.</p><button type="button" className="button button-primary" onClick={reset}>Thử lại</button><Link className="button button-outline" href="/hoc-sinh/dang-nhap">Về trang đăng nhập</Link></div></main>;
}
