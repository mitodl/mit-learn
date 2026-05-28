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
  // Strip trailing slashes with a linear scan rather than a regex. The regex
  // /\/+$/ backtracks polynomially on inputs with many trailing slashes (ReDoS);
  // baseUrl comes from env, which static analysis treats as uncontrolled.
  let end = value.length
  while (end > 0 && value[end - 1] === "/") {
    end--
  }
  const normalized = value.slice(0, end)

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
