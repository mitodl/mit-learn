import { applyLearnAxiosConfig, resetLearnAxiosForTests } from "../axios"
import {
  applyMitxOnlineAxiosConfig,
  resetMitxOnlineAxiosForTests,
} from "../mitxonline/axios"

export type LearnApiConfig = {
  baseUrl: string
  csrfCookieName: string
  withCredentials: boolean
}

export type MitxOnlineApiConfig = {
  baseUrl: string
  csrfCookieName: string
  withCredentials: boolean
}

export type ApiClientsConfig = {
  learn: LearnApiConfig
  mitxonline: MitxOnlineApiConfig
}

let currentConfig: ApiClientsConfig | null = null

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "")

const freezeConfig = (config: ApiClientsConfig): ApiClientsConfig =>
  Object.freeze({
    learn: Object.freeze({ ...config.learn }),
    mitxonline: Object.freeze({ ...config.mitxonline }),
  })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const validateBackendConfigShape = (label: string, entry: unknown) => {
  if (!isRecord(entry)) {
    throw new Error(`${label} configuration is required`)
  }

  if (typeof entry.baseUrl !== "string") {
    throw new Error(`${label} baseUrl is required`)
  }

  if (typeof entry.csrfCookieName !== "string" || !entry.csrfCookieName) {
    throw new Error(`${label} csrfCookieName is required`)
  }

  if (typeof entry.withCredentials !== "boolean") {
    throw new Error(`${label} withCredentials must be a boolean`)
  }
}

const validateBackendConfig = (
  label: string,
  entry: LearnApiConfig | MitxOnlineApiConfig,
) => {
  if (!entry.baseUrl) {
    throw new Error(`${label} baseUrl is required`)
  }
}

const normalizeConfig = (config: ApiClientsConfig): ApiClientsConfig => ({
  learn: {
    ...config.learn,
    baseUrl: normalizeBaseUrl(config.learn.baseUrl),
  },
  mitxonline: {
    ...config.mitxonline,
    baseUrl: normalizeBaseUrl(config.mitxonline.baseUrl),
  },
})

// Keep this in sync with ApiClientsConfig so conflicting reconfiguration checks
// cover every runtime-configurable field.
const configsMatch = (left: ApiClientsConfig, right: ApiClientsConfig) =>
  left.learn.baseUrl === right.learn.baseUrl &&
  left.learn.csrfCookieName === right.learn.csrfCookieName &&
  left.learn.withCredentials === right.learn.withCredentials &&
  left.mitxonline.baseUrl === right.mitxonline.baseUrl &&
  left.mitxonline.csrfCookieName === right.mitxonline.csrfCookieName &&
  left.mitxonline.withCredentials === right.mitxonline.withCredentials

const validateConfigShape = (config: ApiClientsConfig) => {
  if (!isRecord(config)) {
    throw new Error("API client configuration is required")
  }

  validateBackendConfigShape("learn", config.learn)
  validateBackendConfigShape("mitxonline", config.mitxonline)
}

const validateConfig = (config: ApiClientsConfig) => {
  validateBackendConfig("learn", config.learn)
  validateBackendConfig("mitxonline", config.mitxonline)
}

export const configureApiClients = (config: ApiClientsConfig) => {
  validateConfigShape(config)
  const normalized = normalizeConfig(config)
  validateConfig(normalized)

  if (currentConfig) {
    if (!configsMatch(currentConfig, normalized)) {
      throw new Error("configureApiClients called with conflicting values")
    }
    return currentConfig
  }

  applyLearnAxiosConfig(normalized.learn)
  applyMitxOnlineAxiosConfig(normalized.mitxonline)
  currentConfig = freezeConfig(normalized)
  return currentConfig
}

export const getApiClientsConfig = () => {
  if (!currentConfig) {
    throw new Error(
      "API clients are not configured. Call configureApiClients(...) before making requests.",
    )
  }
  return currentConfig
}

export const resetApiClientsForTests = () => {
  currentConfig = null
  resetLearnAxiosForTests()
  resetMitxOnlineAxiosForTests()
}
