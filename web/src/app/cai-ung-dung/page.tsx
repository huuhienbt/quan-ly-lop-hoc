import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { androidRelease } from "@/lib/android-release";
import "./install.css";

export const metadata: Metadata = { title: "Cài ứng dụng Android" };

export default function InstallAppPage() {
  return <div className="install-app-shell"><header className="page-width install-app-header"><Brand /><Link href="/">Về trang chủ</Link></header><main id="noi-dung" className="install-app-main page-width">
    <section className="install-app-card" aria-labelledby="install-app-title"><div className="install-app-heading"><Image src="/icons/app-192.png" alt="" width={80} height={80} /><div><p className="install-app-eyebrow">ỨNG DỤNG ANDROID</p><h1 id="install-app-title">Lớp học hạnh phúc</h1><p>Việc hôm nay, thời khóa biểu và trò chuyện cùng lớp.</p></div></div>
      <p className="install-app-intro">Mở lớp học từ biểu tượng trên điện thoại. Dùng chung tài khoản và dữ liệu với website; kết nối Internet khi sử dụng.</p>
      <a className="install-app-download" href={androidRelease.downloadUrl} download>Tải ứng dụng APK <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4" /></svg></a>
      <p className="install-app-version">Phiên bản {androidRelease.version} · Android {androidRelease.minimumAndroid} trở lên · Chrome được cập nhật</p>
      <h2>Cài trong 3 bước</h2><ol className="install-app-steps"><li><strong>Tải tệp APK</strong><p>Mở trang này trên điện thoại Android và bấm nút tải phía trên.</p></li><li><strong>Mở tệp và chọn Cài đặt</strong><p>Nếu điện thoại yêu cầu, cho phép cài đặt từ trình duyệt vừa tải tệp. Có thể tắt quyền này sau khi cài xong.</p></li><li><strong>Mở ứng dụng và đăng nhập</strong><p>Học sinh dùng số điện thoại đã đăng ký. Thầy cô dùng tài khoản Google đang có trên website.</p></li></ol>
      <div className="install-app-help"><h2>Thông tin cần biết</h2><p>Đây là bản cài trực tiếp, chưa phát hành trên Google Play. Các nội dung mới của lớp tự cập nhật khi mở ứng dụng.</p><p>Trên iPhone hoặc máy tính, tiếp tục <Link href="/">sử dụng website</Link>.</p><a href={androidRelease.checksumUrl}>Xem mã kiểm tra SHA-256 của tệp tải</a></div>
    </section>
  </main></div>;
}
