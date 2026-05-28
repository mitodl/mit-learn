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

const normalizeBaseUrl = (label: string, value: string) => {
  const normalized = value.replace(/\/+$/, "")

  if (!normalized) {
    throw new Error(`${label} baseUrl is invalid after normalization`)
  }

  return normalized
}

const freezeConfig = (config: ApiClientsConfig): ApiClientsConfig =>
  Object.freeze({
    learn: Object.freeze({ ...config.learn }),
    mitxonline: Object.freeze({ ...config.mitxonline }),
  })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const validateApiConfigShape = (label: string, entry: unknown) => {
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

const normalizeConfig = (config: ApiClientsConfig): ApiClientsConfig => ({
  learn: {
    ...config.learn,
    baseUrl: normalizeBaseUrl("learn", config.learn.baseUrl),
  },
  mitxonline: {
    ...config.mitxonline,
    baseUrl: normalizeBaseUrl("mitxonline", config.mitxonline.baseUrl),
  },
})

const validateConfig = (config: ApiClientsConfig) => {
  if (!isRecord(config)) {
    throw new Error("API client configuration is required")
  }

  validateApiConfigShape("learn", config.learn)
  validateApiConfigShape("mitxonline", config.mitxonline)
}

export const configureApiClients = (config: ApiClientsConfig) => {
  if (currentConfig) {
    throw new Error(
      "API clients are already configured. Call resetApiClientsForTests() first if you need to reconfigure.",
    )
  }

  validateConfig(config)
  const normalized = normalizeConfig(config)

  applyLearnAxiosConfig(normalized.learn)
  applyMitxOnlineAxiosConfig(normalized.mitxonline)
  currentConfig = freezeConfig(normalized)
  return currentConfig
}

export const isApiClientsConfigured = (): boolean => currentConfig !== null

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
