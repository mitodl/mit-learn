"use client"

import React from "react"
import { Skeleton, styled, Typography } from "ol-components"
import type { ContractUtilization } from "api/analytics-hooks/organizations"
import {
  formatCount,
  formatDate,
  formatPercent,
  SuppressibleValue,
} from "./format"

/**
 * Headline numbers from `mv_b2b_contract_utilization`.
 *
 * # Why one card group per contract rather than one org-wide row
 *
 * The view's grain is org x contract, and the three headline figures cannot be
 * honestly rolled up across contracts here:
 *
 *  - `active_learners` counts *distinct* learners per contract, so summing it
 *    double-counts anyone on two contracts.
 *  - `seat_utilization_pct` and `completion_rate_pct` are rates; averaging
 *    rates across contracts of different sizes is simply the wrong number, and
 *    recomputing them from the raw counts is impossible whenever a count has
 *    been suppressed.
 *
 * So each contract gets its own group. Most orgs have exactly one, in which
 * case this reads as a single KPI row.
 */

const Root = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const ContractCard = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  padding: "24px",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
  },
}))

const ContractName = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.darkGray2,
})) as typeof Typography

const ContractMeta = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const StatRow = styled.div(({ theme }) => ({
  display: "flex",
  gap: "64px",
  flexWrap: "wrap",
  paddingTop: "20px",
  [theme.breakpoints.down("md")]: {
    gap: "24px",
  },
}))

const StatBlock = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
})

const StatValue = styled(Typography)(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.darkGray2,
  fontVariantNumeric: "tabular-nums",
})) as typeof Typography

const StatLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const StatSubLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const Stat: React.FC<{
  label: string
  subLabel?: string | null
  value: number | null
  format?: (value: number) => string
}> = ({ label, subLabel, value, format }) => (
  <StatBlock role="group" aria-label={label}>
    <StatValue>
      <SuppressibleValue value={value} format={format} />
    </StatValue>
    <StatLabel>{label}</StatLabel>
    {subLabel ? <StatSubLabel>{subLabel}</StatSubLabel> : null}
  </StatBlock>
)

const contractDates = (row: ContractUtilization): string | null => {
  const start = formatDate(row.b2b_contract_start_date)
  const end = formatDate(row.b2b_contract_end_date)
  if (start && end) return `${start} – ${end}`
  return start ?? end
}

const ContractKpiCards: React.FC<{
  rows: ContractUtilization[] | undefined
  isLoading: boolean
}> = ({ rows, isLoading }) => {
  if (isLoading) {
    return (
      <Root>
        <ContractCard>
          <Skeleton width="260px" height="24px" />
          <StatRow>
            {Array.from({ length: 3 }).map((_, index) => (
              <StatBlock key={index}>
                <Skeleton width="96px" height="40px" />
                <Skeleton width="140px" height="20px" />
              </StatBlock>
            ))}
          </StatRow>
        </ContractCard>
      </Root>
    )
  }

  if (!rows?.length) {
    return null
  }

  return (
    <Root>
      {rows.map((row) => {
        const dates = contractDates(row)
        const seatLimit = row.seat_limit
        return (
          <ContractCard key={row.contract_pk}>
            <ContractName component="h3">{row.b2b_contract_name}</ContractName>
            <ContractMeta>
              {[
                row.b2b_contract_is_active ? "Active" : "Inactive",
                row.b2b_contract_membership_type,
                dates,
              ]
                .filter(Boolean)
                .join(" · ")}
            </ContractMeta>
            <StatRow>
              <Stat
                label="Seat utilization"
                // seat_limit is null on uncapped contracts, where a utilization
                // percentage has no denominator and the API returns null too.
                subLabel={
                  seatLimit
                    ? `${formatCount(row.seats_consumed)} of ${formatCount(seatLimit)} seats`
                    : `${formatCount(row.seats_consumed)} seats used · no cap`
                }
                value={row.seat_utilization_pct}
                format={formatPercent}
              />
              <Stat
                label="Active learners"
                value={row.active_learners}
                format={formatCount}
              />
              <Stat
                label="Completion rate"
                subLabel={
                  row.learners_certified === null
                    ? undefined
                    : `${formatCount(row.learners_certified)} certified`
                }
                value={row.completion_rate_pct}
                format={formatPercent}
              />
            </StatRow>
          </ContractCard>
        )
      })}
    </Root>
  )
}

export default ContractKpiCards
