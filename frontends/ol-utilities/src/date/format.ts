import moment from "moment"

/* Instances must be wrapped in <NoSSR> to avoid SSR hydration mismatches.
 */
export const formatDate = (
  /**
   * Date string or date.
   */
  date: string | Date,
  /**
   * A Moment.js format string. See https://momentjs.com/docs/#/displaying/format/
   */
  format = "MMM D, YYYY",
) => {
  return moment(date).format(format)
}
