import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import "./home-account-link.css";

export function HomeAccountLink({ accountName, className }: { accountName: string | null; className: string }) {
  return <Link className={`${className} home-account-link`} href="/dang-nhap">
    <span>{accountName ?? "Đăng nhập"}</span><ArrowIcon />
  </Link>;
}
