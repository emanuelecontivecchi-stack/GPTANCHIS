/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir:
    process.env.ANCHISE_NEXT_DIST_DIR ??
    (process.env.VERCEL ? ".next" : ".next-app"),
  transpilePackages: ["@anchise/api", "@anchise/contracts"]
};

export default nextConfig;
