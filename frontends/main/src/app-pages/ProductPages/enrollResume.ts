import React from "react"
import { auth } from "@/common/urls"
import type { EnrollActionKind } from "./enrollTypes"

/*
 * The marker is read from window.location inside an effect, never during
 * render, so it cannot change server-rendered output. That is why these params
 * are not in the @/common/searchParams registry or the CDN cache key (see the
 * registry's known exceptions).
 */
const ENROLL_PARAM = "enroll"
const RUN_PARAM = "run"

/*
 * The click that sent the learner to sign-up, remembered in this browser. The
 * marker alone is only a URL, which anyone can link to; acting on it only when
 * it matches this record keeps a crafted link from enrolling a signed-in
 * learner who never clicked. localStorage rather than sessionStorage, because
 * the verification email's link opens in a new tab.
 */
const STORAGE_KEY = "mitlearn.pendingEnrollment"
const MAX_AGE_MS = 24 * 60 * 60 * 1000

type PendingEnrollment = {
  kind: EnrollActionKind
  runId: number | null
  pathname: string
  at: number
}

const remember = (pending: PendingEnrollment) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
  } catch {
    // Without storage the learner still signs up; they just click again after.
  }
}

/** Read and forget the remembered click. */
const takePending = (): PendingEnrollment | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    window.localStorage.removeItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PendingEnrollment) : null
  } catch {
    return null
  }
}

/**
 * Where a signed-out enroll click goes: login/sign-up, then back to this page
 * with a marker that finishes the enrollment the learner started. A purchase
 * skips onboarding so a new learner goes straight on to the cart.
 */
const signupToEnrollUrl = (kind: EnrollActionKind, runId?: number): string => {
  const { pathname } = window.location
  remember({ kind, runId: runId ?? null, pathname, at: Date.now() })
  const searchParams = new URLSearchParams(window.location.search)
  searchParams.set(ENROLL_PARAM, kind)
  if (runId === undefined) {
    searchParams.delete(RUN_PARAM)
  } else {
    searchParams.set(RUN_PARAM, String(runId))
  }
  const next = { pathname, searchParams }
  const url = new URL(auth({ next, signupNext: next }))
  if (kind === "paid") {
    url.searchParams.set("skip_onboarding", "1")
  }
  return url.toString()
}

/**
 * Once `ready`, take the marker left by `signupToEnrollUrl` off the URL and,
 * if this browser made that click, hand it to `onResume`. The marker is
 * removed first so that returning from the cart, or reloading, does not start
 * the enrollment again.
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
    const parsedRunId = Number(url.searchParams.get(RUN_PARAM))
    const runId =
      Number.isInteger(parsedRunId) && parsedRunId > 0 ? parsedRunId : null
    url.searchParams.delete(ENROLL_PARAM)
    url.searchParams.delete(RUN_PARAM)
    window.history.replaceState(window.history.state, "", url)

    const pending = takePending()
    const clicked =
      pending?.kind === kind &&
      pending.runId === runId &&
      pending.pathname === url.pathname &&
      Date.now() - pending.at < MAX_AGE_MS
    if (clicked) onResume(kind, runId)
  }, [enabled, ready, onResume])
}

export { signupToEnrollUrl, useResumeEnrollment }
