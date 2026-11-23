"use client"

import React from "react"
import { RiArrowRightLine } from "@remixicon/react"
import { Skeleton, styled, Typography } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { formatCount } from "./format"
import SectionError from "./SectionError"

/**
 * The "Needs attention" count and the follow-up it calls for, for one contract.
 *
 * `count` is the `total_count` of the same `/learners` request the CTA's
 * Learners page makes, so the number matches the list it opens, one row per
 * learner with each module behind flagged. It has no anonymity floor: the
 * manager can open that list.
 *
 * The copy promises review, not sending: there is no reminder action yet.
 */

const Card = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "20px 24px",
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderLeft: `4px solid ${theme.custom.colors.mitRed}`,
  borderRadius: "8px",
  [theme.breakpoints.up("md")]: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "baseline",
    columnGap: "24px",
  },
}))

const Eyebrow = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle4,
  color: theme.custom.colors.mitRed,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  gridColumn: "1 / -1",
})) as typeof Typography

const Count = styled(Typography)(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.darkGray2,
  fontVariantNumeric: "tabular-nums",
})) as typeof Typography

const Body = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
})) as typeof Typography

const Unit = styled.span(({ theme }) => ({
  ...theme.typography.h5,
}))

const Action = styled.div(({ theme }) => ({
  paddingTop: "4px",
  [theme.breakpoints.up("md")]: {
    paddingTop: 0,
    alignSelf: "center",
  },
}))

const learners = (count: number) => (count === 1 ? "learner" : "learners")

const NeedsAttentionCard: React.FC<{
  count: number | undefined
  isLoading: boolean
  isError?: boolean
  learnersHref: string
}> = ({ count, isLoading, isError, learnersHref }) => {
  if (isError) {
    return (
      <Card role="group" aria-label="Needs attention">
        <Eyebrow component="p">Needs attention</Eyebrow>
        <SectionError />
      </Card>
    )
  }

  if (isLoading || count === undefined) {
    return (
      <Card role="group" aria-label="Needs attention" aria-busy="true">
        <Eyebrow component="p">Needs attention</Eyebrow>
        <Skeleton width="48px" height="36px" />
        <Skeleton width="100%" height="40px" />
      </Card>
    )
  }

  return (
    <Card role="group" aria-label="Needs attention">
      <Eyebrow component="p">Needs attention</Eyebrow>
      <Count component="p">
        {formatCount(count)}
        <Unit> {learners(count)}</Unit>
      </Count>
      {count === 0 ? (
        <Body component="p">No learners need attention right now.</Body>
      ) : (
        <Body component="p">Not started, or inactive for 30+ days.</Body>
      )}
      {count !== 0 ? (
        <Action>
          <ButtonLink
            size="small"
            href={learnersHref}
            aria-label="Review learners who need attention"
            endIcon={<RiArrowRightLine aria-hidden="true" />}
          >
            Review learners
          </ButtonLink>
        </Action>
      ) : null}
    </Card>
  )
}

export default NeedsAttentionCard
