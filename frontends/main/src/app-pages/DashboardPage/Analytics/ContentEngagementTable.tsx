"use client"

import React from "react"
import { Skeleton, styled } from "ol-components"
import type { ContentEngagementDepth } from "api/analytics-hooks/organizations"
import {
  EmptyTableMessage,
  MobileLabel,
  TableCard,
  TableCell,
  TableFooter,
  TableFootnote,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from "@/components/B2BTable/B2BTable"
import {
  formatAverage,
  formatCount,
  formatPercent,
  SUPPRESSED_EXPLANATION,
  SuppressibleValue,
} from "./format"
import SectionError from "./SectionError"

/**
 * All-time content engagement per course run, from
 * `mv_b2b_content_engagement_depth`.
 *
 * # Why there is no chart here
 *
 * The view carries two kinds of number that cannot share a y-axis: counts of
 * *people* (enrolled, engaged, chatbot users, certificates) and counts of
 * *events* (videos watched, problems attempted, chatbot interactions), which
 * run three or four orders of magnitude larger. That is the same reason the
 * event totals were kept off `EngagementTrendChart` — see the axis note there.
 * Plotting them together needs a dual axis, which invites exactly the
 * comparison the scales do not support, and splitting them into two charts
 * would say less than the columns below already do. So this section is a
 * table.
 *
 * # Two numbers per cell
 *
 * Thirteen metrics will not fit as thirteen columns at this table's density.
 * Each activity column therefore leads with the rate — the figure that is
 * comparable across course runs of different sizes — and prints the raw total
 * under it, rather than dropping either.
 *
 * The total is printed with the cohort that produced it ("22 learners, 800
 * watched"), not alone. A bare activity total invites the reader to divide it
 * by the learners they can see, which is the wrong denominator: only the
 * learners who did that particular thing contributed to it, and that is a
 * narrower group than `engaged_learners`. It is also the group the anonymity
 * floor is applied to, so showing it is what makes a suppressed total legible
 * rather than arbitrary.
 *
 * Every metric except `total_enrolled_learners` is nullable under the
 * k-anonymity floor, and each figure in a cell is suppressed on its own, so
 * every one of them goes through `SuppressibleValue`. A suppressed number is
 * never a zero.
 *
 * # Denominators
 *
 * Read off `mv_b2b_content_engagement_depth.sql` in ol-data-platform, not
 * guessed from the field names — the two families do not share a base:
 *
 *  - `engagement_rate_pct` and `chatbot_adoption_pct` divide by
 *    `total_enrolled_learners`, which is why the engaged cell says
 *    "of enrolled".
 *  - `avg_videos_per_engaged_learner` and `avg_problems_per_engaged_learner`
 *    divide by `engaged_learners`, so their columns must say "per engaged
 *    learner". "Per learner" would read as per *enrolled* learner and quietly
 *    overstate the figure on any run where engagement is weak.
 */

const CourseTitle = styled.span(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkGray2,
  display: "block",
}))

const CourseId = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  display: "block",
}))

/** The secondary figure in an activity cell: the raw total under its rate. */
const Detail = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  display: "block",
}))

/**
 * Every cell here carries two lines of value, which the shared cell's mobile
 * layout is not built for: it sets the label beside the value, and a label as
 * long as "Problems per engaged learner" leaves so little room that
 * "96 learners, 9,134 attempted" breaks across four lines. Below `md` the
 * label therefore sits above its value rather than beside it, giving the pair
 * the full width of the row. Applied to every labelled cell in the table, not
 * only the two-line ones, so the column of labels stays straight.
 */
const StackedCell = styled(TableCell)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "2px",
  },
}))

const COLUMN_FLEX = {
  course: 2.6,
  enrolled: 1,
  engaged: 1.2,
  videos: 1.3,
  problems: 1.3,
  chatbot: 1.4,
  certificates: 1.2,
}

const ContentEngagementTable: React.FC<{
  rows: ContentEngagementDepth[] | undefined
  isLoading: boolean
  isError?: boolean
}> = ({ rows, isLoading, isError }) => {
  if (isError) {
    return (
      <TableCard>
        <SectionError />
      </TableCard>
    )
  }

  if (isLoading) {
    return (
      <TableCard>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            width="100%"
            height="44px"
            style={{ marginBottom: "8px" }}
          />
        ))}
      </TableCard>
    )
  }

  if (!rows?.length) {
    return (
      <TableCard>
        <EmptyTableMessage>
          No content engagement recorded yet.
        </EmptyTableMessage>
      </TableCard>
    )
  }

  const hasSuppressed = rows.some((row) =>
    [
      row.engaged_learners,
      row.engagement_rate_pct,
      row.total_videos_watched,
      row.video_watchers,
      row.avg_videos_per_engaged_learner,
      row.total_problems_attempted,
      row.problem_attempters,
      row.avg_problems_per_engaged_learner,
      row.total_chatbot_interactions,
      row.chatbot_users,
      row.chatbot_adoption_pct,
      row.certificates_earned,
    ].some((value) => value === null),
  )

  return (
    <TableCard>
      <div role="table" aria-label="Content engagement">
        <div role="rowgroup">
          <TableHeaderRow role="row">
            <TableHeaderCell role="columnheader" $flex={COLUMN_FLEX.course}>
              Course
            </TableHeaderCell>
            <TableHeaderCell
              role="columnheader"
              $flex={COLUMN_FLEX.enrolled}
              $numeric
            >
              Enrolled
            </TableHeaderCell>
            <TableHeaderCell
              role="columnheader"
              $flex={COLUMN_FLEX.engaged}
              $numeric
            >
              Engaged
            </TableHeaderCell>
            <TableHeaderCell
              role="columnheader"
              $flex={COLUMN_FLEX.videos}
              $numeric
            >
              Videos per engaged learner
            </TableHeaderCell>
            <TableHeaderCell
              role="columnheader"
              $flex={COLUMN_FLEX.problems}
              $numeric
            >
              Problems per engaged learner
            </TableHeaderCell>
            <TableHeaderCell
              role="columnheader"
              $flex={COLUMN_FLEX.chatbot}
              $numeric
            >
              Chatbot adoption
            </TableHeaderCell>
            <TableHeaderCell
              role="columnheader"
              $flex={COLUMN_FLEX.certificates}
              $numeric
            >
              Certificates
            </TableHeaderCell>
          </TableHeaderRow>
        </div>
        <div role="rowgroup">
          {rows.map((row) => (
            <TableRow role="row" key={row.courserun_readable_id}>
              <TableCell role="cell" $flex={COLUMN_FLEX.course} $primary>
                <span>
                  <CourseTitle>{row.courserun_title}</CourseTitle>
                  <CourseId>{row.courserun_readable_id}</CourseId>
                </span>
              </TableCell>
              <StackedCell role="cell" $flex={COLUMN_FLEX.enrolled} $numeric>
                <MobileLabel>Enrolled</MobileLabel>
                {formatCount(row.total_enrolled_learners)}
              </StackedCell>
              <StackedCell role="cell" $flex={COLUMN_FLEX.engaged} $numeric>
                <MobileLabel>Engaged</MobileLabel>
                <span>
                  <SuppressibleValue value={row.engaged_learners} />
                  <Detail>
                    <SuppressibleValue
                      value={row.engagement_rate_pct}
                      format={formatPercent}
                    />{" "}
                    of enrolled
                  </Detail>
                </span>
              </StackedCell>
              <StackedCell role="cell" $flex={COLUMN_FLEX.videos} $numeric>
                <MobileLabel>Videos per engaged learner</MobileLabel>
                <span>
                  <SuppressibleValue
                    value={row.avg_videos_per_engaged_learner}
                    format={formatAverage}
                  />
                  <Detail>
                    <SuppressibleValue value={row.video_watchers} /> learners,{" "}
                    <SuppressibleValue value={row.total_videos_watched} />{" "}
                    watched
                  </Detail>
                </span>
              </StackedCell>
              <StackedCell role="cell" $flex={COLUMN_FLEX.problems} $numeric>
                <MobileLabel>Problems per engaged learner</MobileLabel>
                <span>
                  <SuppressibleValue
                    value={row.avg_problems_per_engaged_learner}
                    format={formatAverage}
                  />
                  <Detail>
                    <SuppressibleValue value={row.problem_attempters} />{" "}
                    learners,{" "}
                    <SuppressibleValue value={row.total_problems_attempted} />{" "}
                    attempted
                  </Detail>
                </span>
              </StackedCell>
              <StackedCell role="cell" $flex={COLUMN_FLEX.chatbot} $numeric>
                <MobileLabel>Chatbot adoption</MobileLabel>
                <span>
                  <SuppressibleValue
                    value={row.chatbot_adoption_pct}
                    format={formatPercent}
                  />
                  <Detail>
                    <SuppressibleValue value={row.chatbot_users} /> learners,{" "}
                    <SuppressibleValue value={row.total_chatbot_interactions} />{" "}
                    interactions
                  </Detail>
                </span>
              </StackedCell>
              <StackedCell
                role="cell"
                $flex={COLUMN_FLEX.certificates}
                $numeric
              >
                <MobileLabel>Certificates</MobileLabel>
                <SuppressibleValue value={row.certificates_earned} />
              </StackedCell>
            </TableRow>
          ))}
        </div>
      </div>
      {hasSuppressed ? (
        <TableFooter>
          <TableFootnote>{SUPPRESSED_EXPLANATION}</TableFootnote>
        </TableFooter>
      ) : null}
    </TableCard>
  )
}

export default ContentEngagementTable
export { COLUMN_FLEX }
