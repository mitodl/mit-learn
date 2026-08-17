// @ts-check
const { validateEnv } = require("./validateEnv")

// In CI Docker builds (NEXT_BUILD_CI=1), NEXT_PUBLIC_* vars are not available
// at build time — they are delivered at runtime via the x-public-env <meta>
// (see src/env.ts). Skip build-time validation; validateEnv() runs at server
// startup instead (see src/instrumentation-node.ts).
if (!process.env.NEXT_BUILD_CI) {
  validateEnv()
}

const IS_LOCAL_DEV = process.env.NODE_ENV === "development"

// Dev-server-only: allow cross-origin requests to internal dev endpoints (HMR,
// etc.). Reading NEXT_PUBLIC_ORIGIN from process.env is safe here — unlike app
// code, this config path only runs when NODE_ENV==="development", never in a
// production build where NEXT_PUBLIC_* are absent.
// eslint-disable-next-line no-restricted-syntax -- dev-only; see comment above
const devOrigin = IS_LOCAL_DEV ? process.env.NEXT_PUBLIC_ORIGIN : undefined
const allowedDevOrigins = devOrigin ? [new URL(devOrigin).hostname] : undefined

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  allowedDevOrigins,
  /**
   * Standalone output emits a minimal self-contained server at
   * .next/standalone/ with only the required runtime files. The resulting
   * Docker image requires no node_modules and no yarn at startup.
   * See: https://nextjs.org/docs/app/getting-started/deploying#docker
   */
  output: "standalone",
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
        source: "/video-playlist/detail/:id",
        destination: "/video/:id",
        permanent: true,
      },
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
      /* The "html-pages" Surrogate-Key tag (for HTML/page routes and sitemaps)
       * is set at runtime in src/proxy.ts, alongside Cache-Control and driven
       * by the same isPageRoute() test, so the tag and the cache policy can
       * never diverge. It cannot live here because page detection (and the
       * Cache-Control value) depend on runtime state that is unavailable at
       * build time. The rules below are genuinely static and immutable.
       */

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
    // Image optimisation is disabled: the app passes images through as-is.
    // Production uses Fastly for image transformations. Disabling also avoids
    // baking a per-environment flag (previously NEXT_PUBLIC_OPTIMIZE_IMAGES)
    // into the Docker image at build time.
    unoptimized: true,
  },

  experimental: {
    // Turbopack filesystem caching is enabled by default in Next.js 16.1+
    // Explicitly enable it for clarity (optional - already default)
    turbopackFileSystemCacheForDev: true,
  },

  /**
   * Pin the build ID to the git SHA / version tag for traceability — the
   * BUILD_ID embedded in manifests and page-data paths then identifies which
   * commit a running pod was built from.
   *
   * NEXT_PUBLIC_VERSION is set as a Kubernetes env var (and as a Docker build
   * arg for the standalone build). GIT_REF is the full commit SHA passed by
   * Concourse. The 'dev' fallback is for local builds.
   */
  generateBuildId: async () =>
    // eslint-disable-next-line no-restricted-syntax -- NEXT_PUBLIC_VERSION is guaranteed present at build time by devops (set as a Docker build arg); other NEXT_PUBLIC_* are not
    process.env.NEXT_PUBLIC_VERSION || process.env.GIT_REF || "dev",
}

const { withSentryConfig } = require("@sentry/nextjs")
/** @param {import('next').NextConfig} config */
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
