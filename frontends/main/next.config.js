// @ts-check
const { validateEnv } = require("./validateEnv")

validateEnv()

const NEXT_PUBLIC_OPTIMIZE_IMAGES = Boolean(
  (process.env.NEXT_PUBLIC_OPTIMIZE_IMAGES ?? "true") === "true",
)
const IS_LOCAL_DEV = process.env.NODE_ENV === "development"

const processFeatureFlags = () => {
  const featureFlagPrefix =
    process.env.NEXT_PUBLIC_POSTHOG_FEATURE_PREFIX || "FEATURE_"
  const bootstrapFeatureFlags = {}

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(`NEXT_PUBLIC_${featureFlagPrefix}`)) {
      bootstrapFeatureFlags[
        key.replace(`NEXT_PUBLIC_${featureFlagPrefix}`, "").replaceAll("_", "-")
      ] = value === "True" ? true : JSON.stringify(value)
    }
  }

  return bootstrapFeatureFlags
}

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
  async redirects() {
    return [
      {
        // can be removed once fastly redirect is in place
        source: "/attach/:code",
        destination: "/enrollmentcode/:code",
        permanent: true,
      },
    ]
  },

  async headers() {
    return [
      {
        source: "/sitemaps/:path*.xml",
        headers: [
          {
            key: "Cache-Control",
            value:
              "s-maxage=1800, stale-if-error=86400, stale-while-revalidate=86400",
          },
        ],
      },
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
            value:
              "s-maxage=1800, stale-if-error=86400, stale-while-revalidate=86400",
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
    ]
  },

  transpilePackages: ["@mitodl/smoot-design/ai"],

  images: {
    unoptimized: !NEXT_PUBLIC_OPTIMIZE_IMAGES,
    dangerouslyAllowLocalIP: IS_LOCAL_DEV,
    remotePatterns: [
      {
        hostname: "**",
      },
    ],
    qualities: [25, 50, 75, 100],
  },

  env: {
    FEATURE_FLAGS: JSON.stringify(processFeatureFlags()),
  },

  experimental: {
    // Turbopack filesystem caching is enabled by default in Next.js 16.1+
    // Explicitly enable it for clarity (optional - already default)
    turbopackFileSystemCacheForDev: true,
  },
}

const { withSentryConfig } = require("@sentry/nextjs")
const withSentry = (config) =>
  withSentryConfig(config, {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/build/

    org: "mit-office-of-digital-learning",
    project: "open-next",

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    // tunnelRoute: "/monitoring",
  })

module.exports = withSentry(nextConfig)
