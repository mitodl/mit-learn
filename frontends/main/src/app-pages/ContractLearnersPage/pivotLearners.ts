import type { LearnerProgress } from "api/analytics-hooks/organizations"

type PivotedLearner = {
  /** The grouping key: the lowercased email, or `learner_id` when there is none. */
  key: string
  name: string | null
  email: string | null
  /** How many of the learner's enrollments the API flagged. */
  needsAttentionCount: number
  /** Keyed by `courserun_readable_id`. A run the learner is not in has no entry. */
  enrollments: Map<string, LearnerProgress>
}

/**
 * Email first, `learner_id` as the fallback. The API has returned a different
 * `learner_id` for each enrollment of one person (same name and email), so
 * keying on the id alone put one learner on several grid rows.
 *
 * This also merges two distinct learners who share an email upstream, and the
 * later enrollment wins if both are in the same run. We accept that as too
 * unlikely to special-case.
 */
const learnerKey = (row: LearnerProgress) =>
  row.email?.trim().toLowerCase() || row.learner_id

/**
 * Groups per-enrollment rows into one entry per learner, sorted by name (then
 * email) so the order matches the API's `full_name` sort across the whole set
 * rather than within one page. Learners with neither sort last.
 */
const pivotLearners = (rows: LearnerProgress[]): PivotedLearner[] => {
  const byLearner = new Map<string, PivotedLearner>()
  for (const row of rows) {
    const key = learnerKey(row)
    let learner = byLearner.get(key)
    if (!learner) {
      learner = {
        key,
        name: row.full_name?.trim() || null,
        email: row.email,
        needsAttentionCount: 0,
        enrollments: new Map(),
      }
      byLearner.set(key, learner)
    }
    learner.enrollments.set(row.courserun_readable_id, row)
  }
  for (const learner of byLearner.values()) {
    learner.needsAttentionCount = [...learner.enrollments.values()].filter(
      (enrollment) => enrollment.needs_attention,
    ).length
  }
  const sortKey = (learner: PivotedLearner) =>
    learner.name ?? learner.email ?? ""
  return [...byLearner.values()].sort((a, b) => {
    const aKey = sortKey(a)
    const bKey = sortKey(b)
    if (!aKey !== !bKey) return aKey ? -1 : 1
    return (
      aKey.localeCompare(bKey) || (a.email ?? "").localeCompare(b.email ?? "")
    )
  })
}

export { pivotLearners }
export type { PivotedLearner }
