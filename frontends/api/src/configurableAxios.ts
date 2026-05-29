import axios, { type AxiosInstance } from "axios"

type GlobalRegistry = Record<symbol, unknown>

/**
 * Get-or-create a process-wide singleton parked on globalThis under
 * `Symbol.for(registryKey)`.
 *
 * # Why globalThis?
 *
 * Next.js bundles its instrumentation runtime and its server render runtime as
 * separate module graphs that each evaluate the same source files
 * independently. A plain module-level singleton is therefore duplicated: state
 * written in one graph is invisible to the other, so `configureApiClients()`
 * called from instrumentation would mutate only instrumentation's copy and
 * leave the render graph with a fresh, unconfigured instance.
 *
 * Parking the value on globalThis under a namespaced `Symbol.for(...)` gives
 * every module graph the same slot — `Symbol.for` routes through the
 * per-process global symbol registry, so the same string key always resolves
 * to the same symbol, and therefore the same globalThis property, and
 * therefore the same value. (As a bonus the value survives Fast Refresh, which
 * re-evaluates modules but keeps globalThis intact.)
 *
 * Standard pattern in the Next.js ecosystem; see Prisma's canonical write-up:
 * https://www.prisma.io/docs/guides/nextjs#27-set-up-prisma-client
 * (Drizzle and Sentry document the same pattern for the same reason.)
 *
 * `registryKey` must be globally unique across the process — two callers using
 * the same key would share one value. Namespace it (e.g.
 * `"<app>.<package>.<role>"`) to avoid colliding with other libraries.
 */
const globalSingleton = <T>(registryKey: string, create: () => T): T => {
  const KEY = Symbol.for(registryKey)
  const registry = globalThis as GlobalRegistry
  return (registry[KEY] ??= create()) as T
}

export type ConfigurableAxiosConfig = {
  baseUrl: string
  csrfCookieName: string
  withCredentials: boolean
}

/**
 * Build a configure-after-construction axios instance. The instance is a
 * process-wide singleton (see `globalSingleton`), so config applied in Next's
 * instrumentation runtime is visible to the server render runtime.
 *
 * The instance's own `defaults` are the single source of truth for whether the
 * client is configured (`isConfigured`) — there is no separate state to keep
 * in sync.
 */
export const createConfigurableAxios = (registryKey: string) => {
  const create = (): AxiosInstance => {
    const inst = axios.create({
      xsrfHeaderName: "X-CSRFToken",
      withXSRFToken: true,
    })
    inst.interceptors.request.use((request) => {
      if (!inst.defaults.baseURL) {
        throw new Error(
          "API clients are not configured. Call configureApiClients(...) before making requests.",
        )
      }
      return request
    })
    return inst
  }

  const instance = globalSingleton(registryKey, create)

  const applyConfig = (config: ConfigurableAxiosConfig) => {
    instance.defaults.baseURL = config.baseUrl
    instance.defaults.xsrfCookieName = config.csrfCookieName
    instance.defaults.withCredentials = config.withCredentials
  }

  const isConfigured = (): boolean => Boolean(instance.defaults.baseURL)

  const resetForTests = () => {
    delete instance.defaults.baseURL
    delete instance.defaults.xsrfCookieName
    delete instance.defaults.withCredentials
  }

  return { instance, applyConfig, isConfigured, resetForTests }
}
