import { calendarDaysUntil, formatCalendarDays, isInPast } from "ol-utilities"

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
