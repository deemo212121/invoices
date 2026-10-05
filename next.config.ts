import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A plain static site (the out/ folder): everything runs in the browser, so any static host
  // works. Cloudflare serves it (see wrangler.jsonc).
  output: "export",
  turbopack: {
    resolveAlias: {
      // Invoice PDFs are only made in the browser; use pdfkit's browser build everywhere.
      pdfkit: "./node_modules/pdfkit/js/pdfkit.browser.mjs",
    },
  },
};

export default nextConfig;
