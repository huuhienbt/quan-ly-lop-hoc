import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { GoogleSignInButton, SignOutButton } from "@/components/auth-buttons";
import { ClassroomIllustration } from "@/components/classroom-illustration";
import { ArrowIcon, ClockIcon, HeartIcon, PeopleIcon, ShieldIcon, SunIcon } from "@/components/icons";
import { getSetupState } from "@/lib/config";
import { getCurrentUser } from "@/lib/rbac";
import { getCurrentStudentAccount } from "@/lib/student-session";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const setup = getSetupState();
  const student = await getCurrentStudentAccount();
  if (student) redirect(student.must_change_password ? "/hoc-sinh/doi-mat-khau" : "/hoc-sinh");
  const user = await getCurrentUser();
  const query = await searchParams;
  const authError = typeof query.error === "string";

  return (
    <div className="site-shell">
      <header className="site-header page-width student-home-header">
        <Brand />
        <nav aria-label="Điều hướng chính" className="header-actions">
          <a className="nav-link" href="#cung-dong-hanh">Về lớp học</a>
          <Link className="student-home-link" href="/hoc-sinh/dang-nhap">Học sinh</Link>
          {user ? <SignOutButton /> : <a className="button button-outline" href="#bat-dau">Dành cho thầy cô <ArrowIcon /></a>}
        </nav>
      </header>
      <main id="noi-dung">
        <section className="home-hero page-width" aria-labelledby="home-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="status-dot" /> ƯƠM MẦM NIỀM VUI MỖI NGÀY</p>
            <h1 id="home-title">Một lớp học.<br />Muôn điều <span>hạnh phúc<svg viewBox="0 0 380 15" aria-hidden="true"><path d="M3 10c105-10 219-8 374-6" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></svg></span>.</h1>
            <p className="hero-description">Nơi thầy cô cùng vun đắp một lớp học ấm áp — để mỗi em được lắng nghe, được khích lệ và lớn lên trong yêu thương.</p>
            <a className="button button-primary hero-cta" href="#bat-dau">Cùng xây dựng lớp học <ArrowIcon /></a>
            <div className="hero-origin"><span className="origin-mark"><SunIcon /></span><span>Bắt đầu từ <strong>Bốn 12</strong><br /><span>Trường Tiểu học Bến Tre</span></span></div>
          </div>
          <ClassroomIllustration />
        </section>

        <section id="bat-dau" className="access-section page-width" aria-labelledby="access-title">
          <div className="access-intro">
            <p className="eyebrow">DÀNH CHO THẦY CÔ</p>
            <h2 id="access-title">Cùng bắt đầu<br />những điều tốt đẹp.</h2>
            <p>Đăng nhập bằng tài khoản Google của thầy cô. Quản trị viên sẽ xét duyệt quyền và phân công lớp phù hợp.</p>
            <p className="privacy-note"><ShieldIcon /> Chỉ giáo viên được duyệt mới có quyền quản lý lớp.</p>
          </div>
          <div className="access-card">
            {authError && <p className="form-message is-error" role="alert">Chưa thể đăng nhập bằng tài khoản này. Vui lòng thử lại hoặc liên hệ quản trị viên.</p>}
            {query.access === "denied" && <p className="form-message is-error" role="alert">Tài khoản của bạn chưa có quyền truy cập trang quản trị.</p>}
            {user ? <>
              <div className="account-avatar">{user.name.slice(0, 1).toLocaleUpperCase("vi")}</div>
              <p className="card-kicker">RẤT VUI ĐƯỢC GẶP THẦY CÔ</p>
              <h3>Xin chào, {user.name}!</h3>
              <p className="account-email">{user.email}</p>
              {user.role === "SUPER_ADMIN" ? <>
                <span className="badge badge-green">Quản trị viên</span>
                <p className="access-description">Duyệt giáo viên, tạo lớp và phân công chủ nhiệm trong không gian quản trị.</p>
                <Link className="button button-primary full-width" href="/admin">Vào trang quản trị <ArrowIcon /></Link>
              </> : user.role === "TEACHER" ? <>
                <span className="badge badge-green">Giáo viên đã được duyệt</span>
                <p className="access-description">Tài khoản của thầy cô đã được cấp quyền giáo viên. Quản trị viên sẽ phân công lớp; không gian lớp học đang được chuẩn bị.</p>
              </> : <>
                <span className="badge badge-amber"><ClockIcon /> Chưa được cấp quyền giáo viên</span>
                <p className="access-description">Liên hệ quản trị viên để được xét duyệt tài khoản và phân công lớp.</p>
              </>}
            </> : <>
              <div className="access-icon"><PeopleIcon /></div>
              <h3>Chào mừng thầy cô</h3>
              <p className="access-description">Một tài khoản, một bước khởi đầu<br />cho lớp học hạnh phúc.</p>
              {!setup.ready && <p className="setup-note"><span className="status-dot" /> Đăng nhập đang được thiết lập</p>}
              <GoogleSignInButton enabled={setup.ready} />
              <p className="sign-in-note">Không cần tạo mật khẩu mới.<br />Quyền quản lý được xét duyệt riêng cho từng tài khoản.</p>
              <p className="student-home-access">Em là học sinh? <Link href="/hoc-sinh/dang-nhap">Đăng nhập tại đây <ArrowIcon /></Link></p>
            </>}
          </div>
        </section>

        <section id="cung-dong-hanh" className="values-section page-width" aria-labelledby="values-title">
          <div className="section-heading"><p className="eyebrow">CÙNG ĐỒNG HÀNH</p><h2 id="values-title">Hạnh phúc bắt đầu từ những điều nhỏ.</h2></div>
          <div className="values-grid">
            <article className="value-card"><span className="value-icon peach"><HeartIcon /></span><h3>Thấu hiểu và yêu thương</h3><p>Mỗi em đều có giá trị riêng. Một lời động viên hôm nay có thể trở thành niềm tự tin ngày mai.</p></article>
            <article className="value-card"><span className="value-icon sage"><ShieldIcon /></span><h3>An toàn và tin cậy</h3><p>Thầy cô được phân quyền rõ ràng, để thông tin lớp được chăm sóc bởi đúng người phụ trách.</p></article>
            <article className="value-card"><span className="value-icon butter"><SunIcon /></span><h3>Cùng nhau lớn lên</h3><p>Từ lớp Bốn 12, cùng nuôi dưỡng những điều tốt đẹp để lan tỏa đến toàn trường.</p></article>
          </div>
        </section>
      </main>
      <footer className="site-footer page-width"><Brand compact /><p>Gieo yêu thương · Nuôi hạnh phúc</p></footer>
    </div>
  );
}
