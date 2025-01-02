// @ts-check
const { validateEnv } = require("./validateEnv")

validateEnv()


/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  async rewrites() {
    return [
      /* Static assets moved from /static, though image paths are sometimes
       * returned on the API, e.g. /api/v0/channels/type/unit/ocw/
       * Also rewrites requests for /static/hash.txt
       */
      {
        source: "/static/:path*",
        destination: "/:path*",
      },
    ]
  },

  async headers() {
    return [
      /* This is intended to target the base HTML responses and streamed RSC
       * content. Some routes are dynamically rendered, so NextJS by default
       * sets no-cache. However we are currently serving public content that is
       * cacheable.
       *
       * Excludes everything with a file extension so we're matching only on routes.
       */
      {
        source: "/((?!.*\\.[a-zA-Z0-9]{2,4}$).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "s-maxage=1800",
          },
        ],
      },

      /* Images rendered with the Next.js Image component have the cache header
       * set on them, but CSS background images do not.
       */
      {
        source: "/images/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "s-maxage=31536000",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "s-maxage=31536000",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Document-Policy",
            value: "js-profiling",
          },
        ],
      },
    ]
  },

  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "**",
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "**",
        port: "",
        pathname: "**",
      },
    ],
  },
}



const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
})

module.exports = [withBundleAnalyzer].reduce(
  (acc, withPlugin) => withPlugin(acc),
  nextConfig,
)
