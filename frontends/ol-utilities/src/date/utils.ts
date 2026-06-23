import padStart from "lodash/padStart"
import moment from "moment"

/* Instances must be wrapped in <NoSSR> to avoid SSR hydration mismatches.
 */
const formatDate = (
  /**
   * Date string or date.
   */
  date: string,
  /**
   * A Moment.js format string. See https://momentjs.com/docs/#/displaying/format/
   */
  format = "MMM D, YYYY",
) => {
  return moment(date).format(format)
}

/**
 * Format an ISO-8601 duration string so to a readable format
 * The logic here ensures that if there is a colon (:) to the left
 * of a time component (minutes, seconds) it is zero-padded
 * hours are not included if they are zero
 * this follows what most humans would consider a reasonable "clock display" format
 * Examples of output of this function:
 *
 *  3:00:01
 *  43:07
 *  3:09
 *  0:47
 */
const formatDurationClockTime = (value: string | moment.Duration) => {
  const duration = moment.duration(value)
  const values = []

  if (duration.asHours() >= 1) {
    // never zero-pad this as it will always be the first component, if it present
    values.push(duration.hours().toString())
  }

  if (values.length) {
    // zero-pad the minutes if they're not the first time component
    values.push(padStart(duration.minutes().toString(), 2, "0"))
  } else {
    // otherwise it's not padded
    values.push(duration.minutes().toString())
  }

  // always zero-pad the seconds, because there's always at least a minutes component ahead of it
  values.push(padStart(duration.seconds().toString(), 2, "0"))

  return values.join(":")
}

/**
 * Format an ISO-8601 duration string in a compact human-readable form.
 * Suitable for displaying total collection/playlist durations.
 * Seconds are omitted; only the two largest non-zero units are shown.
 *
 * Examples:
 *  PT8H24M  → "8h 24m"
 *  PT1H     → "1h"
 *  PT45M    → "45m"
 *  PT0S     → ""
 */
const formatDurationHuman = (value: string | moment.Duration): string => {
  const duration = moment.duration(value)
  const totalSeconds = duration.asSeconds()
  if (!totalSeconds) return ""

  const hours = Math.floor(duration.asHours())
  const minutes = duration.minutes()

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  return parts.join(" ")
}

const calendarDaysUntil = (date: string): number | null => {
  const x = moment(date)
  if (!x.isValid()) return null
  const today = moment().startOf("day")
  return x.startOf("day").diff(today, "days")
}

const isInPast = (date: string): null | boolean => {
  const x = moment(date)
  if (!x.isValid()) return null
  return x.isBefore(moment())
}

/**
 * Converts a `calendarDaysUntil` value to a human-readable relative-day suffix.
 * Positive = future ("Tomorrow" / "in N days"), negative = past ("Yesterday" / "N days ago"), 0 = "Today".
 */
const formatCalendarDays = (days: number): string => {
  const abs = Math.abs(days)
  if (abs === 0) return "Today"
  if (days > 0) return days === 1 ? "Tomorrow" : `in ${days} days`
  return abs === 1 ? "Yesterday" : `${abs} days ago`
}

/** Extracts the short timezone abbreviation from a date string, e.g. "EST". */
const getTimezone = (dateString: string): string => {
  return (
    new Date(dateString)
      .toLocaleString("en-US", { timeZoneName: "short" })
      .split(" ")
      .pop() ?? ""
  )
}

export {
  formatDate,
  formatDurationClockTime,
  formatDurationHuman,
  isInPast,
  calendarDaysUntil,
  formatCalendarDays,
  getTimezone,
}
