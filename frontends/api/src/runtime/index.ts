import { learnAxiosClient } from "../axios"
import { mitxAxiosClient } from "../mitxonline/axios"
import type { ConfigurableAxiosConfig } from "../configurableAxios"

export type ApiClientsConfig = {
  learn: ConfigurableAxiosConfig
  mitxonline: ConfigurableAxiosConfig
}

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

export const configureApiClients = (config: ApiClientsConfig): void => {
  if (isApiClientsConfigured()) {
    throw new Error(
      "API clients are already configured. Call resetApiClientsForTests() first if you need to reconfigure.",
    )
  }

  // Normalize before applying so an invalid baseUrl throws without leaving the
  // axios instances half-configured.
  const normalized = normalizeConfig(config)

  learnAxiosClient.applyConfig(normalized.learn)
  mitxAxiosClient.applyConfig(normalized.mitxonline)
}

export const isApiClientsConfigured = (): boolean =>
  learnAxiosClient.isConfigured() && mitxAxiosClient.isConfigured()

export const resetApiClientsForTests = () => {
  learnAxiosClient.resetForTests()
  mitxAxiosClient.resetForTests()
}
