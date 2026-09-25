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
    /* Never redirect /images/*, /static/* or /_next/* here. The image
     * optimizer fetches local images through the router, and a redirect breaks
     * them (see the comment on proxy() in src/proxy.ts). Checked by
     * src/nextConfig.test.ts.
     */
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
      {
        /* Department 21M was renamed "Music and Theater Arts" -> "Music", which
         * changed its channel slug. Without this, existing links
         * hit notFound().
         */
        source: "/c/department/music-and-theater-arts",
        destination: "/c/department/music",
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

      /* Raw public images. The image optimizer also reuses this as the max-age
       * of the optimized /_next/image responses it produces from them.
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
    // Learn aggregates resources whose images live on many third-party hosts
    // (YouTube, SoundCloud, podcast CDNs, partner sites), so any host is
    // allowed. We may want to restrict this to known hosts later.
    remotePatterns: [{ hostname: "**" }],
    // 75 is the next/image default; backgroundSrcSetCSS requests 100.
    qualities: [75, 100],
    // Floor for the max-age on optimized remote images, which Fastly also uses
    // as its TTL. A longer upstream max-age wins.
    minimumCacheTTL: 86400,
    // Unset, Next.js lets the on-disk cache grow to half the node's free disk.
    maximumDiskCacheSize: 500_000_000,
    // Remote sources are buffered in memory up to this size before anything
    // checks they are images, and every distinct URL reaches the pods (the
    // CDN caches per URL). The default is 50MB; the largest real image we've
    // seen is about 14MB.
    maximumResponseBody: 20_000_000,
    // Local dev hostnames resolve to private IPs, which Next.js otherwise
    // refuses to fetch images from.
    dangerouslyAllowLocalIP: IS_LOCAL_DEV,
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
