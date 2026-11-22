"use client";

import Link from "next/link";
import { ClockIcon } from "@/components/icons";

export default function TeacherError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="teacher-no-class"><span className="teacher-empty-icon"><ClockIcon /></span><h2>Chưa thể mở mục này</h2><p>Kết nối tạm thời chưa sẵn sàng. Thầy cô có thể thử lại sau một chút.</p><div className="teacher-error-actions"><button type="button" className="button button-primary" onClick={reset}>Thử lại</button><Link className="button button-outline" href="/">Về trang chủ</Link></div></section>;
}
