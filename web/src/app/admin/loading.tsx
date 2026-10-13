import { Brand } from "@/components/brand";

export default function AdminLoading() {
  return (
    <div className="admin-shell">
      <header className="admin-header"><div className="admin-header-inner page-width"><Brand /></div></header>
      <main className="loading-shell page-width" id="noi-dung" aria-busy="true" aria-label="Đang tải trang quản trị">
        <p className="eyebrow">ĐANG TẢI KHÔNG GIAN QUẢN TRỊ…</p>
        <div className="skeleton skeleton-title" aria-hidden="true" />
        <div className="stats-grid" aria-hidden="true">{[1, 2, 3].map((item) => <div className="skeleton skeleton-stat" key={item} />)}</div>
        <div className="skeleton skeleton-panel" aria-hidden="true" />
      </main>
    </div>
  );
}
