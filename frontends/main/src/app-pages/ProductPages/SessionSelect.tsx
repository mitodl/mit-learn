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
}))

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

const buildOptionLabel = (
  run: CourseRunV2,
  enrolledRunIds: number[] | undefined,
): string => {
  let dates: string
  if (runStartsAnytime(run)) {
    dates = "Anytime"
  } else {
    const parts = [run.start_date, run.end_date]
      .filter((d): d is string => typeof d === "string")
      .map((d) => formatDate(d))
    dates = parts.join(" - ")
  }

  const enrolled = enrolledRunIds?.includes(run.id)
  return enrolled ? `${dates} — Enrolled` : dates
}

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
