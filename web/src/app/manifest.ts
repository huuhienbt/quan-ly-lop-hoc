import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Lớp học hạnh phúc",
    short_name: "Lớp học",
    description: "Việc hôm nay, thời khóa biểu và trò chuyện của lớp Bốn 12, Trường Tiểu học Bến Tre.",
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
      { name: "Việc hôm nay", url: "/hoc-sinh#viec-hom-nay" },
      { name: "Trò chuyện với lớp", url: "/hoc-sinh#tro-chuyen" },
      { name: "Trò chơi học tập", url: "/tro-choi/ca-dao-tuc-ngu" },
    ],
  };
}
