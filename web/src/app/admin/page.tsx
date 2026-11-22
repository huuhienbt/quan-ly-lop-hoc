import { redirect } from "next/navigation";
import { AuthorizationError, requireSuperAdmin } from "@/lib/rbac";
import { schoolSetting, teacherHref } from "@/lib/teacher-navigation";

export const dynamic = "force-dynamic";

// Old bookmarks still work; staff have only one navigation shell.
export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  try { await requireSuperAdmin(); }
  catch (error) {
    if (error instanceof AuthorizationError) redirect(error.status === 401 ? "/dang-nhap?vai=giaovien&tiep=quan-tri" : "/dang-nhap?vai=giaovien");
    throw error;
  }
  const query = await searchParams;
  const settings = query.caiDat === "1" || typeof query.muc === "string";
  redirect(teacherHref(settings ? "cai-dat" : "bai-viet", typeof query.class === "string" ? query.class : undefined,
    { setting: schoolSetting(query.muc) }));
}
