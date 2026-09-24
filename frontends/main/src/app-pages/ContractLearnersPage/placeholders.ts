import type { LearnerProgress } from "api/analytics-hooks/organizations"

/**
 * Every fabricated value on this page, in one file.
 *
 * Nothing else in ContractLearnersPage invents data — each column below has a
 * real field coming, and each export here names the field that will replace
 * it. Removing a placeholder is therefore: delete its function, follow the
 * type errors to its call sites, read the real field instead.
 *
 * Every cell rendered from one of these also carries a `data-placeholder`
 * attribute (see PLACEHOLDER_ATTR) so the fake ones can be found in the DOM
 * during review, and so a removal PR can grep for the render sites rather
 * than reasoning about them.
 *
 * ## What is fake, and what replaces it
 *
 * - `placeholderProgress` — lesson counts and percent complete. The function
 *   stays exported and tested, like `placeholderNeedsAttention` below, but
 *   nothing currently calls it: both LearnerRow.tsx's Progress cell and
 *   ContractLearnersPage.tsx's CSV columns for it are built and commented out
 *   (see each file's "Disabled:" comment) rather than shipped with invented
 *   numbers. Blocked on a data-platform aggregation over
 *   `stg__mitxonline__openedx__blockcompletion`, which also needs a decision
 *   on what a "lesson" is (subsection or unit) and whether progress counts
 *   all blocks or only graded ones.
 * - `placeholderLastActiveOn` — `LearnerProgress.last_active_on` exists in the
 *   response but the API hardcodes it null for every row. Replaced by reading
 *   that field once mitodl/ol-data-platform#2672 is wired into the views.
 * - `placeholderNeedsAttention` — becomes a backend `needs_attention` field,
 *   defined as `not_enrolled OR now() - last_activity_at > 30 days`. Only the
 *   inactive half is computable here, since the activity half is the field
 *   above. Note the "not enrolled" half cannot be represented at all from this
 *   endpoint: it returns enrollments, so someone who never redeemed a seat has
 *   no row to flag.
 *
 * Values are derived from each row's own identity rather than `Math.random()`,
 * so a learner's numbers stay put across re-renders, refetches and paging
 * instead of reshuffling on every render.
 */

/** Marks a cell whose value is fabricated. Not exposed to assistive tech. */
const PLACEHOLDER_ATTR = "data-placeholder"

const INACTIVE_DAYS_THRESHOLD = 30

/** Small deterministic hash; only needs to be stable, not well-distributed. */
const seed = (key: string): number => {
  let hash = 0
  for (let index = 0; index < key.length; index++) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

const rowKey = (
  row: Pick<LearnerProgress, "learner_id" | "courserun_readable_id">,
) => `${row.learner_id}:${row.courserun_readable_id}`

const PLACEHOLDER_LESSON_TOTAL = 6

type PlaceholderProgress = {
  percent: number
  lessonsCompleted: number
  lessonsTotal: number
}

/**
 * Returns null for a learner who has not consented: their real status is
 * withheld, so inventing a progress figure next to a "No consent given" pill
 * would both contradict it and leak a shape of the data they declined to
 * share.
 */
const placeholderProgress = (
  row: LearnerProgress,
): PlaceholderProgress | null => {
  if (!row.outcomes_shared) return null

  // Anchored to the real completion_status so the bar never contradicts the
  // pill beside it — a "Not started" row must read 0%.
  if (row.completion_status === "not_started") {
    return {
      percent: 0,
      lessonsCompleted: 0,
      lessonsTotal: PLACEHOLDER_LESSON_TOTAL,
    }
  }
  if (
    row.completion_status === "passed" ||
    row.completion_status === "certified"
  ) {
    return {
      percent: 100,
      lessonsCompleted: PLACEHOLDER_LESSON_TOTAL,
      lessonsTotal: PLACEHOLDER_LESSON_TOTAL,
    }
  }

  // in_progress: strictly between 0 and 100, so it can't be mistaken for
  // either terminal state.
  const lessonsCompleted =
    1 + (seed(rowKey(row)) % (PLACEHOLDER_LESSON_TOTAL - 1))
  return {
    percent: Math.round((lessonsCompleted / PLACEHOLDER_LESSON_TOTAL) * 100),
    lessonsCompleted,
    lessonsTotal: PLACEHOLDER_LESSON_TOTAL,
  }
}

const placeholderDaysInactive = (row: LearnerProgress): number =>
  seed(`${rowKey(row)}:activity`) % 45

/** Null for a never-active learner, mirroring the real field's nullability. */
const placeholderLastActiveOn = (row: LearnerProgress): string | null => {
  if (!row.outcomes_shared) return null
  if (row.completion_status === "not_started") return null

  const date = new Date()
  date.setDate(date.getDate() - placeholderDaysInactive(row))
  return date.toISOString()
}

/**
 * The inactive half of the planned rule. A deactivated enrollment stands in for
 * the "not enrolled" half, which this endpoint cannot express (see file
 * header).
 */
const placeholderNeedsAttention = (row: LearnerProgress): boolean => {
  if (!row.outcomes_shared) return false
  if (!row.enrollment_is_active) return true
  return placeholderDaysInactive(row) > INACTIVE_DAYS_THRESHOLD
}

export {
  PLACEHOLDER_ATTR,
  placeholderProgress,
  placeholderLastActiveOn,
  placeholderNeedsAttention,
}
export type { PlaceholderProgress }
