import { createMDX } from "fumadocs-mdx/next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

const config = {
  reactStrictMode: true,
  turbopack: {
    root,
  },
};

const withMDX = createMDX();

export default withMDX(config);
