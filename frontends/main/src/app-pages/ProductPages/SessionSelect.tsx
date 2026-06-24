import React, { useId } from "react"
import { Select, styled } from "@mitodl/smoot-design"
import type { SelectChangeEvent } from "@mitodl/smoot-design"
import { MenuItem } from "ol-components"
import type { CourseRunV2 } from "@mitodl/mitxonline-api-axios/v2"
import { formatDate, isInPast } from "ol-utilities"

type SessionSelectProps = {
  runs: CourseRunV2[]
  selectedRunId: number
  enrolledRunIds?: number[]
  onChange: (runId: number) => void
}

/**
 * Inline "Session:" label, styled to match the bold metadata labels
 * (Format:, Estimated:). The select gets its accessible name from this label
 * via `labelId` (→ `aria-labelledby`) since the MUI combobox is not a labelable
 * element.
 */
const SessionLabel = styled.label(({ theme }) => ({
  ...theme.typography.subtitle2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
  whiteSpace: "nowrap",
  // In the SessionRow grid, an item's margin adds to the 8px columnGap, making
  // the label→dropdown gap 16px while icon→label stays the row-level 8px.
  marginRight: "8px",
}))

/**
 * Collapsed-value display: truncate with an ellipsis so a long date range (or
 * the "(Starts anytime)" annotation) can't overflow the narrow sidebar column
 * and collide with the dropdown chevron. The full label stays visible in the
 * open menu.
 */
const TruncatedValue = styled.span({
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
})

/** Italic annotation appended to a session label (e.g. "Start Anytime"). */
const Annotation = styled.em({
  fontStyle: "italic",
})

/**
 * Returns true when the run is self-paced, not archived, and its start date is
 * in the past — meaning "enroll anytime".
 */
const runStartsAnytime = (run: CourseRunV2): boolean => {
  return !!(
    !run.is_archived &&
    run.is_self_paced &&
    run.start_date &&
    isInPast(run.start_date)
  )
}

/**
 * "MMM D, YYYY", collapsing the redundant year on the start of a same-year
 * range ("Sep 8 - Dec 12, 2026"). Cross-year ranges keep both years
 * ("Dec 8, 2026 - Feb 12, 2027"). Dates always show — including for self-paced
 * "starts anytime" runs, which would otherwise all render as a bare "Anytime"
 * and be indistinguishable; the anytime nature is annotated separately (see
 * anytimeSuffix).
 */
const formatDateRange = (run: CourseRunV2): string => {
  const start = typeof run.start_date === "string" ? run.start_date : null
  const end = typeof run.end_date === "string" ? run.end_date : null
  if (start && end) {
    const sameYear = formatDate(start, "YYYY") === formatDate(end, "YYYY")
    const startLabel = formatDate(start, sameYear ? "MMM D" : "MMM D, YYYY")
    return `${startLabel} - ${formatDate(end)}`
  }
  const single = start ?? end
  return single ? formatDate(single) : ""
}

/** Italic " — Start Anytime" for a self-paced, already-open run; null otherwise. */
const anytimeAnnotation = (run: CourseRunV2): React.ReactNode =>
  runStartsAnytime(run) ? (
    <>
      {" — "}
      <Annotation>Start Anytime</Annotation>
    </>
  ) : null

// Dropdown option: dates · the self-paced annotation · the enrolled marker (so
// the user can spot a session they're already in — §4g).
const buildOptionLabel = (
  run: CourseRunV2,
  enrolledRunIds: number[] | undefined,
): React.ReactNode => {
  const enrolled = enrolledRunIds?.includes(run.id)
  return (
    <>
      {formatDateRange(run)}
      {anytimeAnnotation(run)}
      {enrolled ? " — Enrolled" : null}
    </>
  )
}

// Collapsed (selected) display: dates + the self-paced annotation only. The
// "— Enrolled" marker is dropped here — when the selected run is enrolled the
// enroll area already collapses to a standalone "Enrolled" button, so repeating
// it is redundant and is the main cause of overflow in the narrow column.
const buildSelectedLabel = (run: CourseRunV2): React.ReactNode => (
  <>
    {formatDateRange(run)}
    {anytimeAnnotation(run)}
  </>
)

const SessionSelect: React.FC<SessionSelectProps> = ({
  runs,
  selectedRunId,
  enrolledRunIds,
  onChange,
}) => {
  const labelId = useId()
  const selectId = useId()
  return (
    <>
      <SessionLabel id={labelId} htmlFor={selectId}>
        Session:
      </SessionLabel>
      <Select
        id={selectId}
        labelId={labelId}
        size="medium"
        fullWidth
        displayEmpty
        value={String(selectedRunId)}
        onChange={(e: SelectChangeEvent<unknown>) =>
          onChange(Number(e.target.value))
        }
        renderValue={(value) => {
          const run = runs.find((r) => String(r.id) === String(value))
          return (
            <TruncatedValue>
              {run ? buildSelectedLabel(run) : ""}
            </TruncatedValue>
          )
        }}
      >
        {runs.map((run) => (
          <MenuItem key={run.id} value={String(run.id)}>
            {buildOptionLabel(run, enrolledRunIds)}
          </MenuItem>
        ))}
      </Select>
    </>
  )
}

export default SessionSelect
export type { SessionSelectProps }
