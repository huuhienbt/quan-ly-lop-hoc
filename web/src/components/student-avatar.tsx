"use client";

import Image from "next/image";
import { useState } from "react";

export function StudentAvatar({ name, src, className, size, decorative = true }: {
  name: string;
  src: string | null;
  className: string;
  size: number;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState("");
  return <span className={className} aria-hidden={decorative || undefined}>
    {src && src !== failed
      ? <Image src={src} alt={decorative ? "" : "Ảnh đại diện"} width={size} height={size} unoptimized onError={() => setFailed(src)} />
      : <span aria-hidden="true">{Array.from(name.trim())[0]?.toLocaleUpperCase("vi") ?? "H"}</span>}
  </span>;
}
