/**
 * Validate the environment variables we use throughout the app.
 *
 * This only validates them. It does not transform them (e.g., into a boolean).
 * NEXT_PUBLIC_* vars should still be accessed via the env()/requiredEnv()
 * helpers (src/env.ts); server-only vars via process.env directly.
 *
 * The `.required()` fields below are the single source of truth for "which
 * vars must be present." validateEnv() is consumed by:
 *  - next.config.js (local-dev check at `next build` / `next start`)
 *  - src/instrumentation-node.ts (server startup check in Kubernetes pods)
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yup = require("yup")

const schema = yup.object().shape({
  // Server-only env vars
  MITOL_NOINDEX: yup.string().oneOf(["true", "false"]),
  NEXT_CACHE_S_MAXAGE_SECONDS: yup
    .string()
    .matches(/^\d+$/, { excludeEmptyString: true }),
  // Required client/server vars — must be present in local dev and at runtime.
  NEXT_PUBLIC_ORIGIN: yup.string().required(),
  NEXT_PUBLIC_MITOL_API_BASE_URL: yup.string().required(),
  NEXT_PUBLIC_SITE_NAME: yup.string().required(),
  NEXT_PUBLIC_MITOL_SUPPORT_EMAIL: yup.string().required(),
  NEXT_PUBLIC_CSRF_COOKIE_NAME: yup.string().required(),
  NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL: yup.string().required(),
  NEXT_PUBLIC_MITX_ONLINE_BASE_URL: yup.string().required(),
  NEXT_PUBLIC_MITX_ONLINE_CSRF_COOKIE_NAME: yup.string().required(),
  // Optional client or server vars
  NEXT_PUBLIC_APPZI_URL: yup.string(),
  NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS: yup
    .string()
    .oneOf(["true", "false"]),
  NEXT_PUBLIC_POSTHOG_API_KEY: yup.string(),
  NEXT_PUBLIC_POSTHOG_FEATURE_PREFIX: yup.string(),
  NEXT_PUBLIC_POSTHOG_API_HOST: yup.string(),
  NEXT_PUBLIC_POSTHOG_UI_HOST: yup.string(),
  NEXT_PUBLIC_HUBSPOT_PORTAL_ID: yup.string(),
  NEXT_PUBLIC_VERSION: yup.string(),
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: yup.string(),
  NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID: yup.string(),
  NEXT_PUBLIC_SENTRY_DSN: yup.string(),
  NEXT_PUBLIC_SENTRY_ENV: yup.string(),
  NEXT_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE: yup.string(),
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: yup.string(),
  NEXT_PUBLIC_LEARN_AI_RECOMMENDATION_ENDPOINT: yup.string(),
  NEXT_PUBLIC_LEARN_AI_SYLLABUS_ENDPOINT: yup.string(),
  NEXT_PUBLIC_LEARN_AI_CSRF_COOKIE_NAME: yup.string(),
  GOOGLE_MAPS_API_KEY: yup.string(),
})

/**
 * Validate process.env against the schema. `abortEarly: false` collects every
 * problem into a single ValidationError (see `.errors`) so a misconfigured pod
 * reports all bad vars at once rather than one per restart.
 */
const validateEnv = () =>
  schema.validateSync(process.env, { abortEarly: false })

module.exports = { validateEnv, schema }
