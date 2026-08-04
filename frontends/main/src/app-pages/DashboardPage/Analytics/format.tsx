"use client"

import React from "react"
import { styled, Tooltip } from "ol-components"

/**
 * The analytics API nulls out any learner count below its k-anonymity floor,
 * along with every rate and average derived from it. A `null` from these
 * endpoints therefore means "withheld to protect learner privacy" — it is not
 * zero, and it is not missing data.
 *
 * Everything in this module exists to keep that distinction visible: a
 * suppressed value renders as a marked placeholder that says why, and no
 * formatter silently turns `null` into `0`.
 */

/** Copy used by both the tooltip and the per-section footnote, so they agree. */
const SUPPRESSED_EXPLANATION =
  "Withheld: too few learners in this group to report without identifying them."

/** Thousands-separated integer. */
const formatCount = (value: number): string => value.toLocaleString("en-US")

/** One decimal place, because the API's rates are already rounded percentages. */
const formatPercent = (value: number): string =>
  `${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`

/** One decimal place, for per-learner averages. */
const formatAverage = (value: number): string =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })

/**
 * `activity_year_and_month` arrives as a `YYYY-MM` string. Parsed by hand
 * rather than with `new Date("2026-03")` — that parses as UTC midnight and then
 * renders as the *previous* month for anyone west of Greenwich.
 */
const parseYearMonth = (yearMonth: string): Date | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, 1)
}

/** Month and year, e.g. "Mar 2026". */
const formatYearMonth = (yearMonth: string): string =>
  parseYearMonth(yearMonth)?.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  }) ?? yearMonth

/** Short month for a dense axis, e.g. "Mar". */
const formatYearMonthShort = (yearMonth: string): string =>
  parseYearMonth(yearMonth)?.toLocaleDateString("en-US", { month: "short" }) ??
  yearMonth

/**
 * Contract start/end dates, which arrive as date-only `YYYY-MM-DD` strings.
 *
 * Built as a local date for the same reason as `parseYearMonth`: `new
 * Date("2026-01-15")` is parsed as UTC midnight, so `toLocaleDateString`
 * renders it as the 14th for any reader west of Greenwich. A contract that
 * starts on the 15th must not display as starting on the 14th.
 */
const formatDate = (iso: string | null | undefined): string | null => {
  if (!iso) return null
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const date = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const SuppressedMark = styled.span(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  // Dotted underline marks it as explained-on-hover rather than an em dash the
  // reader is meant to interpret as "zero".
  borderBottom: `1px dotted ${theme.custom.colors.silverGray}`,
  cursor: "help",
}))

/**
 * Placeholder for a value the API suppressed. Carries its explanation to
 * pointer users via the tooltip and to assistive tech via the accessible label,
 * so the meaning never depends on hover alone.
 */
const Suppressed: React.FC = () => (
  <Tooltip title={SUPPRESSED_EXPLANATION}>
    <SuppressedMark aria-label={SUPPRESSED_EXPLANATION} tabIndex={0}>
      —
    </SuppressedMark>
  </Tooltip>
)

/**
 * Render a possibly-suppressed value: the formatted number when present, the
 * suppression marker when not.
 */
const SuppressibleValue: React.FC<{
  value: number | null | undefined
  format?: (value: number) => string
}> = ({ value, format = formatCount }) =>
  value === null || value === undefined ? <Suppressed /> : <>{format(value)}</>

export {
  formatAverage,
  formatCount,
  formatDate,
  formatPercent,
  formatYearMonth,
  formatYearMonthShort,
  Suppressed,
  SUPPRESSED_EXPLANATION,
  SuppressibleValue,
}
