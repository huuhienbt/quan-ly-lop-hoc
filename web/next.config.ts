import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth/RBAC pages read the current session and database on every request.
  cacheComponents: false,
  partialPrefetching: false,
  async headers() {
    return [
      { source: "/downloads/:filename*.apk", headers: [
        { key: "Content-Type", value: "application/vnd.android.package-archive" },
        { key: "Content-Disposition", value: "attachment" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
