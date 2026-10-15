import { SiteThemeForm } from "@/components/site-theme-form";
import { getSiteThemeSettings } from "@/lib/site-theme";
import "@/app/admin/site-theme.css";

export async function SiteThemePanel() {
  let settings;
  try {
    settings = await getSiteThemeSettings();
  } catch {
    return (
      <section className="panel site-theme-panel" id="giao-dien" aria-labelledby="site-theme-title">
        <div className="panel-heading"><div><h2 id="site-theme-title">Giao diện website</h2><p>Hai phong cách để lựa chọn, luôn giữ lại Giao diện 1.</p></div></div>
        <div className="panel-body"><p className="form-message is-error" role="alert">Chưa thể đọc cấu hình giao diện. Hãy tải lại trang sau khi kết nối cơ sở dữ liệu hoạt động.</p><button className="button button-primary" disabled>Chưa thể áp dụng giao diện</button></div>
      </section>
    );
  }
  return (
    <section className="panel site-theme-panel" id="giao-dien" aria-labelledby="site-theme-title">
      <div className="panel-heading"><div><h2 id="site-theme-title">Giao diện website</h2><p>Chọn một thế giới học tập cho lớp mình. Cả hai giao diện đều được lưu để dùng lại.</p></div><span className="badge badge-neutral">2 giao diện</span></div>
      <div className="panel-body"><SiteThemeForm settings={settings} /></div>
    </section>
  );
}
