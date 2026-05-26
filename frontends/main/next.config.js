// @ts-check
const { validateEnv } = require("./validateEnv")

// In CI Docker builds (NEXT_BUILD_CI=1), NEXT_PUBLIC_* vars are not available
// at build time — they are injected at runtime via PublicEnvScript. Skip
// build-time validation; validateEnv() runs at server startup instead (see
// src/instrumentation-node.ts).
if (!process.env.NEXT_BUILD_CI) {
  validateEnv()
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
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
      {
        source: "/sitemaps/:path*.xml",
        headers: [
          // Tag sitemaps with "html-pages" so Fastly can purge them on deploy
          // without also purging immutable /_next/static/ chunks.
          // Cache-Control is set at runtime in src/middleware.ts so that
          // NEXT_CACHE_S_MAXAGE_SECONDS is read from the Kubernetes env
          // rather than baked in at Docker build time.
          { key: "Surrogate-Key", value: "html-pages" },
        ],
      },
      /* This is intended to target the base HTML responses and streamed RSC
       * content. Some routes are dynamically rendered, so NextJS by default
       * sets no-cache. However we are currently serving public content that is
       * cacheable.
       *
       * Excludes everything with a file extension (so /_next/static/*.js is
       * never matched) and also excludes /healthcheck, which returns JSON and
       * should not be tagged as an HTML page for Fastly surrogate-key purges.
       */
      {
        source: "/((?!.*\\.[a-zA-Z0-9]+$)(?!healthcheck$).*)",
        headers: [
          // Tag all HTML/page routes so Fastly can purge them on deploy
          // without also purging immutable /_next/static/ chunks.
          // Cache-Control is set at runtime in src/middleware.ts so that
          // NEXT_CACHE_S_MAXAGE_SECONDS is read from the Kubernetes env
          // rather than baked in at Docker build time.
          { key: "Surrogate-Key", value: "html-pages" },
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
   * Stable, deterministic build ID based on the git SHA / version tag.
   *
   * Next.js embeds the build ID in manifest filenames (_buildManifest.js,
   * _ssgManifest.js) and in page-data paths. Using the same ID across
   * rebuilds of the same commit reduces inter-build hash drift.
   *
   * NEXT_PUBLIC_VERSION is set as a Kubernetes env var (and as a Docker
   * build arg in future standalone builds). GIT_REF is the full commit SHA
   * passed by Concourse. The 'dev' fallback is for local builds.
   */
  generateBuildId: async () =>
    process.env.NEXT_PUBLIC_VERSION || process.env.GIT_REF || "dev",

  /**
   * Replace webpack's [chunkhash] with [contenthash].
   *
   * [chunkhash] is influenced by module ordering and internal IDs, so two
   * builds of identical code can produce different filenames. [contenthash]
   * is derived purely from the file's content, making chunk names stable
   * across rebuilds when code is unchanged.
   *
   * See: https://github.com/vercel/next.js/discussions/65856
   */
  webpack: (config) => {
    if (config.output.filename) {
      config.output.filename = config.output.filename.replace(
        "[chunkhash]",
        "[contenthash]",
      )
    }
    if (config.output.chunkFilename) {
      config.output.chunkFilename = config.output.chunkFilename.replace(
        "[chunkhash]",
        "[contenthash]",
      )
    }
    return config
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
