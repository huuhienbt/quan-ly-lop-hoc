import type { MetadataRoute } from "next";
import { classHomeLinks } from "@/lib/student-home";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Lớp học hạnh phúc",
    short_name: "Lớp học",
    description: "Tin lớp, thư viện ảnh và trò chuyện của lớp Bốn 12, Trường Tiểu học Bến Tre.",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fffefb",
    theme_color: "#137e70",
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "Trò chuyện với lớp", url: classHomeLinks["tro-chuyen"] },
      { name: "Trò chơi học tập", url: classHomeLinks["do-vui"] },
    ],
  };
}
