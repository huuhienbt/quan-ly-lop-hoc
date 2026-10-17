import Link from "next/link";
import { androidRelease } from "@/lib/android-release";
import "./android-download.css";

export function AndroidDownload() {
  return <section className="page-width android-download" aria-labelledby="android-download-title">
    <div className="android-download-copy"><span className="android-download-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 5h4m-3 14h2M9 11l3 3 3-3m-3-3v6" /></svg></span><div><h2 id="android-download-title">Mở lớp học ngay trên điện thoại</h2><p>Cài ứng dụng Android. Dùng tài khoản và dữ liệu đang có.</p></div></div>
    <div className="android-download-actions"><a className="android-download-button" href={androidRelease.downloadUrl} download>Tải APK Android <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v13m-5-5 5 5 5-5M5 20h14" /></svg></a><Link href="/cai-ung-dung">Cách cài đặt</Link></div>
  </section>;
}
