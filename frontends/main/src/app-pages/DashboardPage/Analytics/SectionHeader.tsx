"use client"

import React from "react"
import { Skeleton, styled, Typography } from "ol-components"

/**
 * Each analytics section is backed by its own materialized view with its own
 * refresh cycle, so freshness is a per-section fact, not a per-page one. The
 * `as_of` therefore lives in the section header rather than once at the top —
 * one lagging view must never be able to make another section look fresher
 * than it is.
 */

const Root = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
  [theme.breakpoints.down("md")]: {
    gap: "4px",
  },
}))

const TitleGroup = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
})

const Title = styled(Typography)(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.black,
})) as typeof Typography

const Description = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const AsOf = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  whiteSpace: "nowrap",
})) as typeof Typography

const formatAsOf = (iso: string): string | null => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

type SectionHeaderProps = {
  title: string
  description?: string
  /** ISO timestamp of the backing view's last refresh; `null` before its first. */
  asOf?: string | null
  isLoading?: boolean
  /** The section's query failed, so nothing is known about its freshness. */
  isError?: boolean
  /** Heading level, so section headings nest correctly under the page `h1`. */
  component?: React.ElementType
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  asOf,
  isLoading,
  isError,
  component = "h2",
}) => {
  const formatted = asOf ? formatAsOf(asOf) : null

  /**
   * A failed request tells us nothing about when the view last refreshed, so
   * this slot claims nothing at all — "Data not yet refreshed" would be a
   * statement about the view that we are in no position to make. The section
   * body says it could not load.
   */
  const freshness = isError ? null : isLoading ? (
    <Skeleton width="180px" height="18px" />
  ) : formatted && asOf ? (
    <AsOf>
      Data as of <time dateTime={asOf}>{formatted}</time>
    </AsOf>
  ) : (
    // Distinguish "the view has never refreshed" from "we are still
    // loading" — a manager reading a zero needs to know which.
    <AsOf>Data not yet refreshed</AsOf>
  )

  return (
    <Root>
      <TitleGroup>
        <Title component={component}>{title}</Title>
        {description ? <Description>{description}</Description> : null}
      </TitleGroup>
      {freshness}
    </Root>
  )
}

export default SectionHeader
export { formatAsOf }
export type { SectionHeaderProps }
