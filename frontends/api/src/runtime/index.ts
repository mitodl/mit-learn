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

export const configureApiClients = (config: ApiClientsConfig) => {
  if (currentConfig) {
    throw new Error(
      "API clients are already configured. Call resetApiClientsForTests() first if you need to reconfigure.",
    )
  }

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
