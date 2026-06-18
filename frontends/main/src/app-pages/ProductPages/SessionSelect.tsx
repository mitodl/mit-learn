import React from "react"
import { SimpleSelectField } from "ol-components"
import type { SimpleSelectOption } from "ol-components"
import type { CourseRunV2 } from "@mitodl/mitxonline-api-axios/v2"
import { formatDate, isInPast } from "ol-utilities"

type SessionSelectProps = {
  runs: CourseRunV2[]
  selectedRunId: number
  enrolledRunIds?: number[]
  onChange: (runId: number) => void
}

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
  const options: SimpleSelectOption[] = runs.map((run) => ({
    label: buildOptionLabel(run, enrolledRunIds),
    value: String(run.id),
  }))

  return (
    <SimpleSelectField
      label="Session"
      options={options}
      value={String(selectedRunId)}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

export default SessionSelect
export type { SessionSelectProps }
