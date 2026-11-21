import { redirect } from "next/navigation";

export default async function LegacyStudentSignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  redirect(query.changed === "1" ? "/dang-nhap?changed=1" : "/dang-nhap");
}
