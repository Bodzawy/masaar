// Standalone pronunciation trainer domain. Keep in sync with src/lib/trainer/host.ts.
const TRAINER_HOST = "dev.dz2s.de";
const onTrainerHost = [{ type: "host", value: TRAINER_HOST }];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", has: onTrainerHost, destination: "/trainer" },
        {
          // Everything except the trainer itself, its API and framework assets.
          source: "/:path((?!_next/|trainer|api/pronunciation|manifest\\.webmanifest|favicon\\.ico).+)",
          has: onTrainerHost,
          destination: "/trainer",
        },
      ],
    };
  },
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  // Webpack-bundling this SDK breaks its runtime transport detection
  // (works when required directly under plain Node, fails once bundled),
  // which surfaced in production as every pronunciation assessment
  // getting canceled by Azure. Keeping it external avoids that bundling.
  serverExternalPackages: ["microsoft-cognitiveservices-speech-sdk"],
};

export default nextConfig;
