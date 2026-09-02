import {
  calendarDaysUntil,
  formatCalendarDays,
  formatDate,
  isInPast,
} from "ol-utilities"

export type RunTimeState = "upcoming" | "underway" | "ended"

/**
 * Where a run sits relative to now. Shared by the card's progress badge and the
 * sibling-runs accordion so the two can never disagree about whether the
 * displayed run is still going. Absent or unparseable dates fall back to
 * "underway", which is how the cards behaved before dates were consulted.
 */
export const getRunTimeState = (
  startDate?: string | null,
  endDate?: string | null,
): RunTimeState => {
  if (startDate && isInPast(startDate) === false) return "upcoming"
  if (endDate && isInPast(endDate) === true) return "ended"
  return "underway"
}

/**
 * A run's date range, as shown on the sibling-runs rows and in the unenroll /
 * email settings dialogs. Shared so a dialog names the run the same way the row
 * the learner opened it from does — the whole point of showing it is letting
 * them spot the wrong run, which fails if the two spell it differently.
 *
 * Returns "" when the run has neither date, so callers can omit the label
 * rather than render an empty one.
 */
export const formatRunDateRange = (
  startDate?: string | null,
  endDate?: string | null,
): string => {
  const parts: string[] = []
  if (startDate) parts.push(formatDate(startDate, "MMM D, YYYY"))
  if (endDate) parts.push(formatDate(endDate, "MMM D, YYYY"))
  return parts.join(" – ")
}

export const getCourseDateText = (
  startDate?: string | null,
  endDate?: string | null,
): string | null => {
  if (!startDate && !endDate) return null
  const hasStarted = startDate ? isInPast(startDate) : true
  const daysUntilStart = startDate ? calendarDaysUntil(startDate) : null
  const daysUntilEnd = endDate ? calendarDaysUntil(endDate) : null
  const hasEnded = endDate ? isInPast(endDate) : false

  if (!hasStarted) {
    if (daysUntilStart === null || daysUntilStart < 0) return null
    return `Starts ${formatCalendarDays(daysUntilStart)}`
  }
  if (!hasEnded) {
    if (daysUntilEnd === null || daysUntilEnd < 0) return null
    return `Ends ${formatCalendarDays(daysUntilEnd)}`
  }
  if (daysUntilEnd === null) return null
  return `Ended ${formatCalendarDays(daysUntilEnd)}`
}

const MS_IN_DAY = 1000 * 60 * 60 * 24

const formatDayCount = (days: number): string =>
  `${days} day${days === 1 ? "" : "s"}`

export interface RelativeDateContent {
  anchorLabel: string
  startVerb: "starts" | "started"
  startSuffix: string
  endVerb?: "ends" | "ended"
  endSuffix?: string
}

export const getRelativeDateContent = (
  startDateString?: string | null,
  endDateString?: string | null,
  startDateDisplay?: string | null,
  endDateDisplay?: string | null,
): RelativeDateContent | null => {
  if (!startDateString) return null

  const now = Date.now()
  const startDate = new Date(startDateString)
  if (Number.isNaN(startDate.getTime())) return null

  const endDate = endDateString ? new Date(endDateString) : null
  const hasValidEndDate = Boolean(endDate) && !Number.isNaN(endDate!.getTime())

  if (!hasValidEndDate) {
    if (now < startDate.getTime()) {
      const daysUntilStart = Math.max(
        0,
        Math.ceil((startDate.getTime() - now) / MS_IN_DAY),
      )
      const dayCount = formatDayCount(daysUntilStart)
      return {
        anchorLabel: `${dayCount} until this course starts.`,
        startVerb: "starts",
        startSuffix: `in ${dayCount}${startDateDisplay ? ` on ${startDateDisplay}` : ""}.`,
      }
    }
    const daysSinceStart = Math.max(
      0,
      Math.floor((now - startDate.getTime()) / MS_IN_DAY),
    )
    const dayCount = formatDayCount(daysSinceStart)
    return {
      anchorLabel: `this course started ${dayCount} ago.`,
      startVerb: "started",
      startSuffix: `${dayCount} ago${startDateDisplay ? ` on ${startDateDisplay}` : ""}.`,
    }
  }

  const endTime = endDate!.getTime()

  if (now < startDate.getTime()) {
    const daysUntilStart = Math.max(
      0,
      Math.ceil((startDate.getTime() - now) / MS_IN_DAY),
    )
    const dayCount = formatDayCount(daysUntilStart)
    return {
      anchorLabel: `${dayCount} until this course starts.`,
      startVerb: "starts",
      startSuffix: `in ${dayCount}${startDateDisplay ? ` on ${startDateDisplay}` : ""}.`,
      endVerb: endDateDisplay ? "ends" : undefined,
      endSuffix: endDateDisplay ? `on ${endDateDisplay}.` : undefined,
    }
  }

  if (now <= endTime) {
    const daysUntilEnd = Math.max(0, Math.ceil((endTime - now) / MS_IN_DAY))
    const daysUntilStart = Math.max(
      0,
      Math.floor((now - startDate.getTime()) / MS_IN_DAY),
    )
    return {
      anchorLabel: `${formatDayCount(daysUntilEnd)} until this course ends.`,
      startVerb: "started",
      startSuffix: `${formatDayCount(daysUntilStart)} ago${startDateDisplay ? ` on ${startDateDisplay}` : ""}.`,
      endVerb: "ends",
      endSuffix: `in ${formatDayCount(daysUntilEnd)}${endDateDisplay ? ` on ${endDateDisplay}` : ""}.`,
    }
  }

  const daysSinceEnd = Math.max(0, Math.floor((now - endTime) / MS_IN_DAY))
  const daysSinceStart = Math.max(
    0,
    Math.floor((now - startDate.getTime()) / MS_IN_DAY),
  )
  return {
    anchorLabel: `this course ended ${formatDayCount(daysSinceEnd)} ago.`,
    startVerb: "started",
    startSuffix: `${formatDayCount(daysSinceStart)} ago${startDateDisplay ? ` on ${startDateDisplay}` : ""}.`,
    endVerb: "ended",
    endSuffix: `${formatDayCount(daysSinceEnd)} ago${endDateDisplay ? ` on ${endDateDisplay}` : ""}.`,
  }
}
