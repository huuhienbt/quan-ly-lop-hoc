import Link from "next/link";
import { redirect } from "next/navigation";
import { TeacherHomeChat } from "@/components/teacher-home-chat";
import { TeacherPosts } from "@/components/teacher-posts";
import { TeacherSettings } from "@/components/teacher-settings";
import { schoolSetting, selectedTeacherClass, teacherHref, teacherTab } from "@/lib/teacher-navigation";
import { getWorkspaceClasses, getWorkspaceUser } from "@/lib/teacher-workspace";

export default async function TeacherPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [actor, query] = await Promise.all([getWorkspaceUser(), searchParams]);
  if (actor?.role !== "TEACHER" && actor?.role !== "SUPER_ADMIN") {
    const next = query.tab === "cai-dat" ? "quan-tri" : query.tab === "hoc-tap" || query.tab === "tro-chuyen" ? query.tab : "";
    redirect("/dang-nhap?vai=giaovien" + (next ? "&tiep=" + next : ""));
  }
  const admin = actor.role === "SUPER_ADMIN";
  const tab = teacherTab(query.tab, admin);
  const classes = await getWorkspaceClasses(actor.id);
  const selected = selectedTeacherClass(classes, query.class);
  if (query.tab === "cai-dat" && !admin) redirect(teacherHref("bai-viet", selected?.id));

  const invalidClass = query.class !== undefined && query.class !== selected?.id;
  return <>
    {invalidClass && <p className="teacher-feedback is-error" role="alert">Thầy cô không có quyền quản lý lớp đã chọn. Vui lòng kiểm tra lại lớp ở đầu trang.</p>}
    {tab === "cai-dat" && admin
      ? <TeacherSettings section={schoolSetting(query.muc)} classId={selected?.id} actorId={actor.id} />
      : !selected
        ? <section className="teacher-no-class"><h2>Chưa có lớp để quản lý</h2>
          {admin ? <><p>Tạo lớp để bắt đầu đăng tin và bài học.</p>
            <Link className="button button-primary" href={teacherHref("cai-dat", undefined, { setting: "nam-hoc" })} scroll={false} prefetch={false}>Mở cài đặt năm học và lớp học</Link></>
            : <p>Thầy cô hãy liên hệ quản trị viên để được phân công lớp.</p>}
        </section>
        : tab === "tro-chuyen"
          ? <section className="teacher-content-section" id="tro-chuyen" aria-labelledby="staff-chat-title">
            <div className="teacher-section-heading"><h2 id="staff-chat-title">Trò chuyện với lớp</h2></div>
            <TeacherHomeChat classId={selected.id} />
          </section>
          : <TeacherPosts tab={tab === "hoc-tap" ? tab : "bai-viet"} classId={selected.id} actorId={actor.id}
              create={query.soan === "1"} editId={typeof query.sua === "string" && query.sua.length <= 100 ? query.sua : undefined} />}
  </>;
}
