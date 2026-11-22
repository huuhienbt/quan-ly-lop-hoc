import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { studentAccountLink } from "@/lib/student-home";
import "./home-account-link.css";

export function HomeAccountLink({ accountName, className, studentSignedIn = false }: { accountName: string | null; className: string; studentSignedIn?: boolean }) {
  return <Link className={`${className} home-account-link`} href={studentSignedIn ? studentAccountLink : "/dang-nhap"} prefetch={false}>
    <span>{accountName ?? "Đăng nhập"}</span><ArrowIcon />
  </Link>;
}
