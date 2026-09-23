/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  // Webpack-bundling this SDK breaks its runtime transport detection
  // (works when required directly under plain Node, fails once bundled),
  // which surfaced in production as every pronunciation assessment
  // getting canceled by Azure. Keeping it external avoids that bundling.
  serverExternalPackages: ["microsoft-cognitiveservices-speech-sdk"],
};

export default nextConfig;
