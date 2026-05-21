/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.pstatic.net" },
      { protocol: "https", hostname: "**.naver.net" },
      { protocol: "https", hostname: "**.naver.com" },
    ],
  },
};

export default nextConfig;
