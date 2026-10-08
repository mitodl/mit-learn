"use client"

import React from "react"
import { RiArrowRightLine } from "@remixicon/react"
import { Skeleton, styled, Typography } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import type { ContractNeedsAttention } from "api/analytics-hooks/organizations"
import { formatCount, SuppressibleValue } from "./format"
import SectionError from "./SectionError"

/**
 * The "Needs attention" count and the follow-up it calls for, for one contract.
 *
 * Reads `ContractNeedsAttention`, a distinct-learner count. The CTA lands on
 * the learner directory with its needs-attention filter on, which applies the
 * same server-side rule but lists one row per enrollment, so a learner behind
 * in several courses is one learner here and several rows there.
 * `enrollmentCount` says so up front; it is shown only alongside the learner
 * count, never in place of a floored one.
 *
 * The copy promises review, not sending: there is no reminder action yet.
 */

const Card = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  height: "100%",
  padding: "20px 24px",
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderLeft: `4px solid ${theme.custom.colors.mitRed}`,
  borderRadius: "8px",
}))

const Eyebrow = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle4,
  color: theme.custom.colors.mitRed,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
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

const Note = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const Action = styled.div({
  marginTop: "auto",
  paddingTop: "4px",
})

const learners = (count: number) => (count === 1 ? "learner" : "learners")
const enrollments = (count: number) =>
  count === 1 ? "enrollment" : "enrollments"

const NeedsAttentionCard: React.FC<{
  row: ContractNeedsAttention | undefined
  isLoading: boolean
  isError?: boolean
  /** Enrollments needing attention; omitted while loading or on error. */
  enrollmentCount?: number
  learnersHref: string
}> = ({ row, isLoading, isError, enrollmentCount, learnersHref }) => {
  if (isError) {
    return (
      <Card>
        <SectionError />
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <Skeleton width="120px" height="16px" />
        <Skeleton width="48px" height="36px" />
        <Skeleton width="100%" height="40px" />
      </Card>
    )
  }

  /** No row means the contract is under the anonymity floor; a null count means the count itself is. */
  const count = row?.learners_needing_attention ?? null
  /** Null is a floored count, so at least one learner is excluded; zero is a real zero. */
  const withheld = row ? row.learners_outcomes_withheld : 0

  return (
    <Card role="group" aria-label="Needs attention">
      <Eyebrow component="p">Needs attention</Eyebrow>
      <Count component="p">
        <SuppressibleValue value={count} />
        {count === null ? null : <Unit> {learners(count)}</Unit>}
      </Count>
      {count === null ? (
        <Body component="p">
          Too few learners to report how many need attention.
        </Body>
      ) : count === 0 ? (
        <Body component="p">No learners need attention right now.</Body>
      ) : (
        <Body component="p">
          {enrollmentCount === undefined
            ? "Not started, or inactive for 30+ days."
            : `Not started, or inactive for 30+ days, across ${formatCount(
                enrollmentCount,
              )} ${enrollments(enrollmentCount)}.`}
        </Body>
      )}
      {withheld === null ? (
        <Note component="p">
          Excludes some learners who haven't shared their progress.
        </Note>
      ) : withheld > 0 ? (
        <Note component="p">
          {`Excludes ${formatCount(withheld)} ${learners(withheld)} who ${
            withheld === 1 ? "hasn't" : "haven't"
          } shared their progress.`}
        </Note>
      ) : null}
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
