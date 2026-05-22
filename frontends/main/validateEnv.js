/**
 * Validate the environment variables we use throughout the app.
 *
 * This only validates them. It does not transform them (e.g., into a boolean).
 * Env vars should still be accessed via process.env.ENV_VAR
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yup = require("yup")

/**
 * NEXT_PUBLIC_* vars that must be present at runtime. Shared between:
 *  - validateEnv() below (local dev check at `next build` / `next start`)
 *  - src/instrumentation-node.ts (Docker startup check in Kubernetes)
 *
 * Keep this list in sync with the `.required()` fields in the schema below.
 */
const REQUIRED_PUBLIC_ENV_VARS = /** @type {const} */ ([
  "NEXT_PUBLIC_ORIGIN",
  "NEXT_PUBLIC_MITOL_API_BASE_URL",
  "NEXT_PUBLIC_SITE_NAME",
  "NEXT_PUBLIC_MITOL_SUPPORT_EMAIL",
  "NEXT_PUBLIC_CSRF_COOKIE_NAME",
])

const schema = yup.object().shape({
  // Server-only env vars
  MITOL_NOINDEX: yup.string().oneOf(["true", "false"]),
  NEXT_CACHE_S_MAXAGE_SECONDS: yup
    .string()
    .matches(/^\d+$/, { excludeEmptyString: true }),
  // Required client/server vars — must be present in local dev and at runtime.
  // The list is defined above as REQUIRED_PUBLIC_ENV_VARS so that
  // instrumentation-node.ts can import it as a single source of truth.
  NEXT_PUBLIC_ORIGIN: yup.string().required(),
  NEXT_PUBLIC_MITOL_API_BASE_URL: yup.string().required(),
  NEXT_PUBLIC_SITE_NAME: yup.string().required(),
  NEXT_PUBLIC_MITOL_SUPPORT_EMAIL: yup.string().required(),
  NEXT_PUBLIC_CSRF_COOKIE_NAME: yup.string().required(),
  // Optional client or server vars
  NEXT_PUBLIC_APPZI_URL: yup.string(),
  NEXT_PUBLIC_EMBEDLY_KEY: yup.string(),
  NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS: yup
    .string()
    .oneOf(["true", "false"]),
  NEXT_PUBLIC_POSTHOG_API_KEY: yup.string(),
  NEXT_PUBLIC_POSTHOG_FEATURE_PREFIX: yup.string(),
  NEXT_PUBLIC_POSTHOG_API_HOST: yup.string(),
  NEXT_PUBLIC_POSTHOG_UI_HOST: yup.string(),
  NEXT_PUBLIC_HUBSPOT_PORTAL_ID: yup.string(),
})

const validateEnv = () => schema.validateSync(process.env)

module.exports = { validateEnv, REQUIRED_PUBLIC_ENV_VARS }
