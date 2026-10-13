import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth/RBAC pages read the current session and database on every request.
  cacheComponents: false,
  partialPrefetching: false,
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
