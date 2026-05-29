import axios, { type AxiosInstance } from "axios"

/**
 * Build an axios instance that lives on globalThis as a process-wide
 * singleton, with helpers to configure it after construction.
 *
 * # Why globalThis?
 *
 * Next.js bundles its instrumentation runtime and server render runtime as
 * separate module graphs that each evaluate the same source files
 * independently. Without sharing, `configureApiClients()` called from
 * instrumentation would only mutate instrumentation's copy of the axios
 * instance, leaving the render graph with a fresh unconfigured one.
 *
 * The fix is to park the instance on globalThis under a namespaced
 * `Symbol.for(...)`. `Symbol.for` goes through the per-process global
 * symbol registry, so every module graph that reaches for the same string
 * key gets the same symbol — and therefore the same slot on globalThis,
 * and therefore the same instance.
 *
 * Standard workaround in the Next.js ecosystem; see Prisma's canonical
 * write-up:
 * https://www.prisma.io/docs/guides/nextjs#27-set-up-prisma-client
 * (Drizzle and Sentry document the same pattern for the same reason.)
 *
 * Nothing outside this file's callers needs to know the slot exists; they
 * just import the returned `instance` and helpers.
 *
 * # registryKey
 *
 * Must be globally unique across the process. Two callers using the same
 * key would share the same axios instance — almost certainly not what you
 * want. Namespace the string (e.g. `"<app>.<package>.<role>"`) to avoid
 * accidental collisions with other libraries that also use the registry.
 */

type ConfigurableAxiosConfig = {
  baseUrl: string
  csrfCookieName: string
  withCredentials: boolean
}

type GlobalSlot = Record<symbol, AxiosInstance | undefined>

export const createConfigurableAxios = (registryKey: string) => {
  const KEY = Symbol.for(registryKey)

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

  const instance: AxiosInstance = ((globalThis as GlobalSlot)[KEY] ??= create())

  const applyConfig = (config: ConfigurableAxiosConfig) => {
    instance.defaults.baseURL = config.baseUrl
    instance.defaults.xsrfCookieName = config.csrfCookieName
    instance.defaults.withCredentials = config.withCredentials
  }

  const resetForTests = () => {
    delete instance.defaults.baseURL
    delete instance.defaults.xsrfCookieName
    delete instance.defaults.withCredentials
  }

  return { instance, applyConfig, resetForTests }
}
