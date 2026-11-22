export default function TeacherLoading() {
  return <div className="staff-loading" role="status">
    <span>Đang tải nội dung…</span><div className="skeleton teacher-loading-panel" aria-hidden="true" />
  </div>;
}
