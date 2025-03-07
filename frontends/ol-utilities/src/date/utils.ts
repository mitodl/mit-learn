import padStart from "lodash/padStart"
import moment from "moment"

const EXPECTED_FORMAT = "YYYY-MM-DD[T]HH:mm:ss[Z]"
/**
 * Parse date string into a moment object.
 *
 * If date is null or undefined, a Moment<Invalid date> object is returned.
 * Invalid dates return false for all comparisons.
 */
const asMoment = (date?: string | null) => moment(date, EXPECTED_FORMAT)

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
  return asMoment(date).format(format)
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
const formatDurationClockTime = (value: string) => {
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

export { formatDate, asMoment, formatDurationClockTime }
