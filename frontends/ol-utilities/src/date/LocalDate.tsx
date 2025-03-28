import React from "react"
import { NoSSR } from "../ssr/NoSSR"
import { formatDate } from "./utils"

type LocalDateProps = {
  date?: string | null
  /**
   * A Moment.js format string. See https://momentjs.com/docs/#/displaying/format/
   */
  format?: string
}

/* Component to render dates only on the client as these are displayed
 * according to the user's locale (generally, not all Moment.js format tokens
 * are localized) causing an error due to hydration mismatch.
 */
export const LocalDate = ({ date, format = "MMM D, YYYY" }: LocalDateProps) => {
  if (!date) return null
  return <NoSSR>{formatDate(date, format)}</NoSSR>
}
