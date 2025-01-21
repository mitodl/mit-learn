/**
 * Validate the environment variables we use throughout the app.
 *
 * This only validates them. It does not transform them (e.g., into a boolean).
 * Env vars should still be accessed via process.env.ENV_VAR
 */
import { object, string } from "yup"

const schema = object().shape({
  // Server-only env vars
  MITOL_NOINDEX: string().oneOf(["true", "false"]),
  // Client or Server env vars
  NEXT_PUBLIC_APPZI_URL: string(),
  NEXT_PUBLIC_ORIGIN: string().required(),
  NEXT_PUBLIC_MITOL_API_BASE_URL: string().required(),
  NEXT_PUBLIC_SITE_NAME: string().required(),
  NEXT_PUBLIC_MITOL_SUPPORT_EMAIL: string().required(),
  NEXT_PUBLIC_EMBEDLY_KEY: string(),
  NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS: string().oneOf(["true", "false"]),
  NEXT_PUBLIC_CSRF_COOKIE_NAME: string().required(),
  NEXT_PUBLIC_POSTHOG_API_KEY: string(),
  NEXT_PUBLIC_POSTHOG_FEATURE_PREFIX: string(),
  NEXT_PUBLIC_POSTHOG_API_HOST: string(),
})

export const validateEnv = () => schema.validateSync(process.env)
