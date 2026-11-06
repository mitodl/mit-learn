import React from "react"
import { auth } from "@/common/urls"
import type { EnrollActionKind } from "./enrollTypes"

/*
 * The marker is read from window.location inside an effect, never during
 * render, so it cannot change server-rendered output. That is why these params
 * are not in the @/common/searchParams registry or the CDN cache key: a cached
 * product page is the same page with or without them.
 */
const ENROLL_PARAM = "enroll"
const RUN_PARAM = "run"

/**
 * Where a signed-out enroll click goes: login/sign-up, then back to this page
 * with a marker that finishes the enrollment the learner started. A purchase
 * skips onboarding so a new learner goes straight on to the cart.
 */
const signupToEnrollUrl = (kind: EnrollActionKind, runId?: number): string => {
  const searchParams = new URLSearchParams(window.location.search)
  searchParams.set(ENROLL_PARAM, kind)
  if (runId === undefined) {
    searchParams.delete(RUN_PARAM)
  } else {
    searchParams.set(RUN_PARAM, String(runId))
  }
  const next = { pathname: window.location.pathname, searchParams }
  const url = new URL(auth({ next, signupNext: next }))
  if (kind === "paid") {
    url.searchParams.set("skip_onboarding", "1")
  }
  return url.toString()
}

/**
 * Once `ready`, take the marker left by `signupToEnrollUrl` off the URL and
 * hand it to `onResume`. The marker is removed first so that returning from
 * the cart, or reloading, does not start the enrollment again.
 */
const useResumeEnrollment = ({
  enabled,
  ready,
  onResume,
}: {
  enabled: boolean
  ready: boolean
  onResume: (kind: EnrollActionKind, runId: number | null) => void
}) => {
  const resumed = React.useRef(false)

  React.useEffect(() => {
    if (!enabled || !ready || resumed.current) return
    const url = new URL(window.location.href)
    const kind = url.searchParams.get(ENROLL_PARAM)
    if (kind !== "paid" && kind !== "free") return
    resumed.current = true
    const runId = Number(url.searchParams.get(RUN_PARAM))
    url.searchParams.delete(ENROLL_PARAM)
    url.searchParams.delete(RUN_PARAM)
    window.history.replaceState(window.history.state, "", url)
    onResume(kind, Number.isInteger(runId) && runId > 0 ? runId : null)
  }, [enabled, ready, onResume])
}

export { signupToEnrollUrl, useResumeEnrollment }
