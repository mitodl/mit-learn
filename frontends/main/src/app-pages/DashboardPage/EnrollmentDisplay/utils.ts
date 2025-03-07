import { ISO_8601_FORMAT } from "ol-utilities"
import moment from "moment"

/**
 * Format the time between two string dates. Example outputs:
 *
 * Example outputs:
 * 13 days
 * 1 day
 * 1:23:03
 * 0:44
 */
const formatTimeUntil = (date: string) => {
  const x = moment(date, ISO_8601_FORMAT)
  if (!x.isValid()) return ""
  const duration = moment.duration(x.diff(moment.utc()))
  const days = Math.floor(duration.asDays())
  if (days === 1) {
    return `${days} day`
  } else if (days > 1) {
    return `${days} days`
  } else {
    return "Less than a day"
  }
}

export { formatTimeUntil }
