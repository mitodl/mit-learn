import * as Sentry from "@sentry/nextjs"
import type { ErrorEvent } from "@sentry/nextjs"
import { onRequestError } from "./instrumentation"

/**
 * Initialise the real Sentry SDK (no mock) so these tests exercise the actual
 * scope machinery, and return the array that beforeSend pushes captured events
 * into. beforeSend runs after scope tags are merged onto the event, so it sees
 * the final tags.
 *
 * Hermetic: the noop transport makes any network send impossible, and
 * beforeSend drops events before transport regardless. The DSN is Sentry's docs
 * placeholder (project "0" does not exist) and is never contacted.
 */
const initTestSentry = (): ErrorEvent[] => {
  const captured: ErrorEvent[] = []
  Sentry.init({
    dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
    // Tag merging is core behavior, independent of integrations; disabling the
    // defaults avoids browser-tracing / web-vitals instrumentation that errors
    // under jsdom.
    defaultIntegrations: false,
    transport: () => ({
      send: () => Promise.resolve({}),
      flush: () => Promise.resolve(true),
    }),
    beforeSend(event) {
      captured.push(event)
      return null // drop — we only want to inspect, not transmit
    },
  })
  return captured
}

let captured: ErrorEvent[]

beforeAll(() => {
  captured = initTestSentry()
})

beforeEach(() => {
  captured.length = 0
})

const REQUEST = { path: "/courses/x", method: "GET", headers: {} }
const CONTEXT = {
  routerKind: "App Router",
  routePath: "/courses/[id]",
  routeType: "render",
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 10))

test("tags Axios errors with the upstream HTTP status", async () => {
  const axiosError = { isAxiosError: true, response: { status: 502 } }

  onRequestError(axiosError, REQUEST, CONTEXT)
  await flush()

  expect(captured).toHaveLength(1)
  expect(captured[0].tags?.ssr_fetch_status).toBe("502")
})

test("tags Axios network errors (no response) as 'network'", async () => {
  const networkError = { isAxiosError: true, code: "ECONNREFUSED" }

  onRequestError(networkError, REQUEST, CONTEXT)
  await flush()

  expect(captured).toHaveLength(1)
  expect(captured[0].tags?.ssr_fetch_status).toBe("network")
})

test("captures non-Axios errors without a status tag", async () => {
  onRequestError(new Error("boom"), REQUEST, CONTEXT)
  await flush()

  expect(captured).toHaveLength(1)
  expect(captured[0].tags?.ssr_fetch_status).toBeUndefined()
})
