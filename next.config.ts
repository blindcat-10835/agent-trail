import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "*": [
      "tests/**",
      "docs/**",
      ".planning/**",
      ".local/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
  },
};

export default nextConfig;
