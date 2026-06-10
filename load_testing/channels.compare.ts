import { IGNORE_HTTPS_ERRORS, BACKEND_BASE_URL } from "./config.ts"
import { discoverChannels, testChannels } from "./backend/channels.ts"

export { testChannels }

const VUS = Number(__ENV.VUS ?? 15)
const DURATION = __ENV.DURATION ?? "3m"
const LABEL = __ENV.RUN_LABEL ?? "run"

export const options = {
  scenarios: {
    channels: {
      exec: "testChannels",
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    checks: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
  },
  insecureSkipTLSVerify: IGNORE_HTTPS_ERRORS,
}

export function setup() {
  return discoverChannels(BACKEND_BASE_URL)
}

export function handleSummary(data) {
  // Absolute path: k6's in-container cwd is not /app, so a relative path would
  // write to an ephemeral location lost when the --rm container exits.
  const out = `/app/results/channels.${LABEL}.json`
  return {
    [out]: JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  }
}

// Minimal stdout summary of the per-endpoint trends.
function textSummary(data) {
  const lines: string[] = ["", `=== channels load test: ${LABEL} ===`]
  const names = Object.keys(data.metrics)
    .filter((n) => n.startsWith("channels_"))
    .sort()
  // A trend with no recorded samples has no percentile keys, so guard each.
  const ms = (x: number | undefined) =>
    typeof x === "number" ? `${x.toFixed(1)}ms` : "n/a"
  for (const name of names) {
    const v = data.metrics[name].values ?? {}
    lines.push(
      `${name.padEnd(48)} ` +
        `avg=${ms(v.avg)} p50=${ms(v.med)} ` +
        `p95=${ms(v["p(95)"])} p99=${ms(v["p(99)"])}`,
    )
  }
  const reqs = data.metrics.http_reqs?.values?.count ?? 0
  const failed = data.metrics.http_req_failed?.values?.rate ?? 0
  lines.push(`http_reqs=${reqs} http_req_failed=${(failed * 100).toFixed(2)}%`)
  lines.push("")
  return lines.join("\n")
}
