import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its font metric files from its package folder at runtime,
  // so it must not be bundled.
  serverExternalPackages: ["pdfkit"],
  experimental: {
    serverActions: {
      // Product image uploads go through server actions.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
